/**
 * CONTRACT FILE. Owned by the lead.
 * The game store: holds GameState and the live round, runs the round clock, resolves shots, saves, and exposes every player action.
 *
 * Rules for UI code:
 * - Read with narrow selectors: `useGame((s) => s.state.sports[s.state.currentSport].money)`. Never select whole objects in components
 *   that render often.
 * - The aim is NOT React state. The play field writes it with `setAim(yaw)` every frame; the store reads it when a limb fires.
 * - Shots arrive through `onShots` in store/shotBus.ts, never through React state.
 * - Call actions through `useGame.getState().actions.xxx(...)`. Every action returns `{ ok }` or `{ ok: false, error }`.
 * - Nothing can be bought while a round plays (`between_rounds_only`); the UI disables the buttons and the store refuses anyway.
 * - Animations and toasts react to events: `useGameEvent` from store/events.ts.
 * - Offers (owner 2026-11-22): rewarded-ad cards that pop in on the left between rounds and stack from the top (`offers`, oldest first).
 *   A "boost" offer adds balance.ads.boostMinutes of ×boostMult income per ad, stacking to the cap; an "offlineDouble" offer doubles the
 *   money from while the app was closed. Each offer goes away after balance.ads.offerSeconds (`until`); the UI calls `dropOffer` then.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import { pickLine, situationFor } from '@/content/commentary';
import * as E from '@/engine';
import type { Balance, BallId, GameState, Rng, RoundState, SportId, UpgradeId } from '@/engine';
import { services } from '@/services';
import { heavyHaptic, mediumHaptic, setHapticsGetter, tickHaptic } from '@/ui/feedback';

import { emitGameEvents } from './events';
import { clearShots, flushShots, pushShot } from './shotBus';

export const balance: Balance = E.defaultBalance;

export type ActionStatus = { ok: true } | { ok: false; error: string };

export type Phase = 'idle' | 'playing' | 'result';

export interface RoundResultView {
  money: number;
  shots: number;
  hits: number;
  newBest: boolean;
  line: string;
  doubled: boolean;
}

export interface OfflineView {
  money: number;
  seconds: number;
  canDouble: boolean;
}

export type OfferKind = 'boost' | 'offlineDouble';

/** A rewarded-ad offer card. `until` is the wall time (ms) it goes away. */
export interface Offer {
  id: number;
  kind: OfferKind;
  until: number;
}

const TICK_MS = 1000 / 30;
const SAVE_EVERY_MS = 5000;
const HIT_HAPTIC_MIN_GAP_MS = 120;
const TWO_PI = 2 * Math.PI;
/** Owner decision 2026-11-15: the round is for shooting, the pause after it is for buying. */
const BETWEEN_ROUNDS_ONLY: ActionStatus = { ok: false, error: 'between_rounds_only' };

export interface GameActions {
  init(): void;
  /** Starts a round in the current sport. No-op while one is playing. */
  startRound(): ActionStatus;
  /** Called from the play field on every drag frame. Yaw in radians, 0 = straight at the target, positive = right. */
  setAim(yaw: number): void;
  /** Dismisses the round result without starting a round (a sport switch, for example). */
  dismissResult(): void;
  buyUpgrade(id: UpgradeId): ActionStatus;
  buyBall(id: BallId): ActionStatus;
  assignLimbBall(limb: number, id: BallId): ActionStatus;
  assignAllLimbs(id: BallId): ActionStatus;
  buyCharacter(): ActionStatus;
  unlockSport(id: SportId): ActionStatus;
  selectSport(id: SportId): ActionStatus;
  /** Shows the ad for an offer (free with removeAds) and pays it: more boost time, or the offline double. */
  takeOffer(id: number): Promise<ActionStatus>;
  /** An offer ran out or was waved away. An offline double that goes away is gone for good. */
  dropOffer(id: number): void;
  /** Shows the ad and doubles the pending offline payout. */
  watchOfflineDouble(): Promise<ActionStatus>;
  dismissOffline(): void;
  buyRemoveAds(): Promise<ActionStatus>;
  restorePurchases(): Promise<{ ok: boolean; restored: number }>;
  setSetting(key: keyof GameState['settings'], value: boolean): void;
  resetGame(): void;
}

export interface GameStore {
  ready: boolean;
  state: GameState;
  phase: Phase;
  round: RoundState | null;
  /** Seconds left in the live round, updated every tick (cheap to select: a number). */
  secondsLeft: number;
  /** Money of the live round, updated every tick. */
  roundMoney: number;
  result: RoundResultView | null;
  offline: OfflineView | null;
  /** Rewarded-ad offers on the left, oldest (top) first. */
  offers: Offer[];
  /** An ad is being shown. */
  busy: boolean;
  actions: GameActions;
}

/** The 30 Hz round clock runs only while a round is playing; the slow loop saves while idle. */
let fastLoop: ReturnType<typeof setInterval> | null = null;
let slowLoop: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove(): void } | null = null;
let aim = 0;
let roundRng: Rng = E.createRng(1);
let lastSaveAt = 0;
let lastHitHapticAt = 0;
let limbsAtLastRound = 0;
let nextOfferId = 1;
const usedLines = new Set<string>();
let lastLine: string | null = null;

function loadState(now: number): GameState {
  for (const read of [() => services.save.load(), () => services.save.loadBackup()]) {
    try {
      const raw = read();
      if (!raw) continue;
      const parsed = E.deserialize(raw, balance);
      if (parsed) return parsed;
    } catch (e) {
      console.warn('save slot unreadable', e);
    }
  }
  return E.createInitialState(balance, now);
}

export const useGame = create<GameStore>((set, get) => {
  function apply(result: E.ActionResult): ActionStatus {
    if (!result.ok) {
      services.audio.play('error');
      return { ok: false, error: result.error };
    }
    set({ state: result.state });
    emitGameEvents(result.events);
    return { ok: true };
  }

  /** Adds an offer at the bottom of the stack, unless one of that kind is already showing (then its time starts again). */
  function popOffer(kind: OfferKind, now: number): void {
    const until = now + balance.ads.offerSeconds * 1000;
    const offers = get().offers;
    if (offers.some((o) => o.kind === kind)) {
      set({ offers: offers.map((o) => (o.kind === kind ? { ...o, until } : o)) });
      return;
    }
    set({ offers: [...offers, { id: nextOfferId++, kind, until }] });
  }

  function removeOffers(kind: OfferKind): void {
    set({ offers: get().offers.filter((o) => o.kind !== kind) });
  }

  /** Between rounds, once nothing covers the screen: the boost offer while one more step fits, the offline double while it is pending. */
  function popIdleOffers(now: number): void {
    if (get().offline) return;
    const state = get().state;
    if (state.offline.pendingDouble > 0) popOffer('offlineDouble', now);
    // A new player sees "DRAG TO AIM" first; the boost offer waits for the first finished round.
    if (state.sports[state.currentSport].roundsPlayed > 0 && E.canAddBoost(state, balance, now)) popOffer('boost', now);
  }

  /** The offline payout. A short absence pays nothing and keeps the double that is still waiting as an offer. */
  function payOffline(state: GameState, now: number): E.ActionResult {
    const res = E.applyOfflineEarnings(state, balance, now);
    if (!res.ok || res.events.some((e) => e.type === 'offlineEarned')) return res;
    return { ...res, state: { ...res.state, offline: state.offline } };
  }

  function saveNow(now: number): void {
    const state = E.touchClock(get().state, now);
    set({ state });
    services.save.save(E.serialize(state, now));
    lastSaveAt = now;
  }

  /** After a successful upgrade, ball or character purchase: Trophy milestones, sound, immediate save. */
  function afterPurchase(sound: 'buy' | 'footsteps'): void {
    const awarded = E.awardMilestones(get().state, balance, get().state.currentSport);
    set({ state: awarded.state });
    emitGameEvents(awarded.events);
    services.audio.play(sound);
    saveNow(Date.now());
  }

  function finishRound(round: RoundState): void {
    const before = get().state;
    const res = E.settleRound(before, balance, round);
    if (!res.ok) return;
    const sportId = round.sport;
    const sport = res.state.sports[sportId];
    const newBest = res.events.some((e) => e.type === 'newBest');
    const ballOfLimb0 = E.ballDefOf(balance, sportId, sport.limbBalls[0] ?? '');
    const heavy = ballOfLimb0 ? ballOfLimb0.accuracyPenaltyDeg >= balance.commentary.heavyBallPenaltyDeg : false;
    const situation = situationFor(
      {
        shots: round.shots,
        hits: round.hits,
        newBest,
        limbs: sport.limbs,
        limbKind: balance.sports[sportId].limb,
        firstRoundWithLimbs: sport.limbs !== limbsAtLastRound && sport.limbs > 1,
        heavyBall: heavy,
      },
      balance.commentary.manyBallsShots,
    );
    if (newBest) mediumHaptic();
    // The round's phase stays with the finished round so the play field keeps a still target (golf) where it was.
    stopFastLoop();
    limbsAtLastRound = sport.limbs;
    const [roll, withRoll] = E.rollFromState(res.state);
    const line = pickLine(situation, usedLines, lastLine, () => roll);
    usedLines.add(line);
    lastLine = line;
    set({
      state: withRoll,
      phase: 'result',
      round: { ...round, finished: true },
      secondsLeft: 0,
      roundMoney: round.money,
      result: { money: round.money, shots: round.shots, hits: round.hits, newBest, line, doubled: round.doubled },
    });
    emitGameEvents(res.events);
    services.audio.play(newBest ? 'newBest' : 'roundEnd');
    const now = Date.now();
    if (E.canAddBoost(get().state, balance, now)) popOffer('boost', now);
    saveNow(now);
  }

  function stopFastLoop(): void {
    if (fastLoop) {
      clearInterval(fastLoop);
      fastLoop = null;
    }
  }

  function startFastLoop(): void {
    if (!fastLoop) fastLoop = setInterval(onTick, TICK_MS);
  }

  /** Ends a live round without pay: the player left, or the tick failed. */
  function abandonRound(): void {
    clearShots();
    stopFastLoop();
    set({ phase: 'idle', round: null, secondsLeft: 0, roundMoney: 0 });
  }

  function onTick(): void {
    const { phase, round, state } = get();
    if (phase !== 'playing' || !round || round.finished) {
      stopFastLoop();
      return;
    }
    const now = Date.now();
    try {
      const t = (now - round.startedAt) / 1000;
      if (t >= round.seconds) {
        flushShots();
        finishRound(round);
        return;
      }
      const due = E.dueShots(round, state, balance, t);
      let r = due.round;
      let hitNow = false;
      for (const limb of due.limbs) {
        const input = E.shotInputFor(state, balance, r, limb, aim, t);
        const result = E.resolveShot(input, roundRng, balance);
        result.limb = limb;
        r = E.recordShot(r, result);
        pushShot(result);
        if (result.hit) hitNow = true;
      }
      if (hitNow && now - lastHitHapticAt > HIT_HAPTIC_MIN_GAP_MS) {
        tickHaptic();
        lastHitHapticAt = now;
      }
      flushShots();
      set({ round: r, secondsLeft: Math.max(0, round.seconds - t), roundMoney: r.money });
    } catch (err) {
      // A failing tick must not red-box 30 times a second with the round stuck. The round is abandoned; the state is untouched.
      console.warn('round tick failed, round abandoned', err);
      abandonRound();
    }
  }

  function onSlowTick(): void {
    const now = Date.now();
    if (get().phase !== 'playing' && now - lastSaveAt > SAVE_EVERY_MS) saveNow(now);
  }

  function onAppState(next: AppStateStatus): void {
    const now = Date.now();
    if (next === 'inactive') {
      // Control Center, a notification banner, the app switcher: the round keeps running, only the save is refreshed.
      saveNow(now);
      return;
    }
    if (next === 'active') {
      const res = payOffline(get().state, now);
      if (res.ok) {
        set({ state: res.state });
        emitGameEvents(res.events);
        const earned = res.events.find((e) => e.type === 'offlineEarned');
        if (earned && earned.type === 'offlineEarned') {
          // A new payout replaces the one an old offer would have doubled.
          removeOffers('offlineDouble');
          set({ offline: { money: earned.money, seconds: earned.seconds, canDouble: true } });
        }
      }
    } else {
      // Background: a live round is abandoned without pay (the player left), the clock is touched, the game saved.
      if (get().phase === 'playing') abandonRound();
      saveNow(now);
    }
  }

  return {
    ready: false,
    state: E.createInitialState(balance, 0),
    phase: 'idle',
    round: null,
    secondsLeft: 0,
    roundMoney: 0,
    result: null,
    offline: null,
    offers: [],
    busy: false,
    actions: {
      init() {
        if (get().ready) return;
        const now = Date.now();
        let state = loadState(now);
        const res = payOffline(state, now);
        let offline: OfflineView | null = null;
        if (res.ok) {
          state = res.state;
          const earned = res.events.find((e) => e.type === 'offlineEarned');
          if (earned && earned.type === 'offlineEarned') offline = { money: earned.money, seconds: earned.seconds, canDouble: true };
        }
        limbsAtLastRound = state.sports[state.currentSport].limbs;
        setHapticsGetter(() => get().state.settings.haptics);
        services.audio.setEnabled(state.settings.sound);
        set({ state, ready: true, offline });
        popIdleOffers(now);
        if (!slowLoop) slowLoop = setInterval(onSlowTick, SAVE_EVERY_MS);
        if (!appStateSub) appStateSub = AppState.addEventListener('change', onAppState);
        saveNow(now);
      },

      startRound() {
        const { phase, state, busy, offline } = get();
        if (phase === 'playing' || busy || offline) return { ok: false, error: 'invalid' };
        const now = Date.now();
        clearShots();
        const [seed, seeded] = E.rollFromState(state);
        roundRng = E.createRng(Math.floor(seed * 4294967296));
        let round = E.createRound(seeded, balance, now, roundRng);
        // A moving target keeps its phase continuous with the idle motion the play field shows, so nothing jumps when the round starts:
        // the idle motion is sin(2π · wallSeconds / period), so the round's phase is that same angle at startedAt.
        const motion = balance.sports[round.sport].target.motion;
        if (motion.periodSec > 0) round = { ...round, targetPhase: ((TWO_PI * (now / 1000)) / motion.periodSec) % TWO_PI };
        // The boost pays the whole round when it runs at the start, even if it runs out during the round.
        const doubled = E.boostActive(seeded, balance, now);
        set({ state: seeded, phase: 'playing', round: { ...round, doubled }, secondsLeft: round.seconds, roundMoney: 0, result: null });
        startFastLoop();
        return { ok: true };
      },

      setAim(yaw) {
        if (Number.isFinite(yaw)) aim = yaw;
      },

      dismissResult() {
        if (get().phase === 'result') set({ phase: 'idle', result: null, round: null });
      },

      buyUpgrade(id) {
        if (get().phase === 'playing') return BETWEEN_ROUNDS_ONLY;
        const status = apply(E.buyUpgrade(get().state, balance, id));
        if (status.ok) afterPurchase('buy');
        return status;
      },

      buyBall(id) {
        if (get().phase === 'playing') return BETWEEN_ROUNDS_ONLY;
        const status = apply(E.buyBall(get().state, balance, id));
        if (status.ok) afterPurchase('buy');
        return status;
      },

      assignLimbBall(limb, id) {
        if (get().phase === 'playing') return BETWEEN_ROUNDS_ONLY;
        const status = apply(E.assignLimbBall(get().state, balance, limb, id));
        if (status.ok) saveNow(Date.now());
        return status;
      },

      assignAllLimbs(id) {
        if (get().phase === 'playing') return BETWEEN_ROUNDS_ONLY;
        const status = apply(E.assignAllLimbs(get().state, balance, id));
        if (status.ok) saveNow(Date.now());
        return status;
      },

      buyCharacter() {
        if (get().phase === 'playing') return BETWEEN_ROUNDS_ONLY;
        const status = apply(E.buyCharacter(get().state, balance));
        if (status.ok) {
          heavyHaptic();
          afterPurchase('footsteps');
        }
        return status;
      },

      unlockSport(id) {
        const status = apply(E.unlockSport(get().state, balance, id));
        if (status.ok) saveNow(Date.now());
        return status;
      },

      selectSport(id) {
        if (get().phase === 'playing') return { ok: false, error: 'invalid' };
        const status = apply(E.selectSport(get().state, balance, id));
        if (status.ok) {
          limbsAtLastRound = get().state.sports[id].limbs;
          // The offline double pays the sport it was earned in; switching drops it.
          removeOffers('offlineDouble');
          const s = get().state;
          set({ phase: 'idle', result: null, round: null, state: { ...s, offline: { ...s.offline, pendingDouble: 0 } } });
          saveNow(Date.now());
        }
        return status;
      },

      async takeOffer(id) {
        const { busy, phase, offers } = get();
        const offer = offers.find((o) => o.id === id);
        if (!offer || busy || phase === 'playing') return { ok: false, error: 'invalid' };
        if (offer.kind === 'offlineDouble') {
          const status = await get().actions.watchOfflineDouble();
          if (status.ok) removeOffers('offlineDouble');
          return status;
        }
        if (!E.canAddBoost(get().state, balance, Date.now())) {
          removeOffers('boost');
          return { ok: false, error: 'not_available' };
        }
        set({ busy: true });
        try {
          if (!get().state.removeAds) {
            const result = await services.ads.showRewarded('boost');
            if (!result.rewarded) return { ok: false, error: 'not_available' };
          }
          const now = Date.now();
          const status = apply(E.addBoost(get().state, balance, now));
          if (status.ok) {
            services.audio.play('buy');
            // The offer stays while one more step fits, with its time started again, so ads can be stacked one after another.
            if (E.canAddBoost(get().state, balance, now)) popOffer('boost', now);
            else removeOffers('boost');
            saveNow(now);
          }
          return status;
        } finally {
          set({ busy: false });
        }
      },

      dropOffer(id) {
        const offer = get().offers.find((o) => o.id === id);
        if (!offer) return;
        set({ offers: get().offers.filter((o) => o.id !== id) });
        if (offer.kind === 'offlineDouble') {
          const s = get().state;
          set({ state: { ...s, offline: { ...s.offline, pendingDouble: 0 } } });
        }
      },

      async watchOfflineDouble() {
        const { state, busy } = get();
        if (busy) return { ok: false, error: 'invalid' };
        if (state.offline.pendingDouble <= 0) return { ok: false, error: 'not_available' };
        set({ busy: true });
        try {
          if (!state.removeAds) {
            const result = await services.ads.showRewarded('offline_double');
            if (!result.rewarded) return { ok: false, error: 'not_available' };
          }
          const status = apply(E.claimOfflineDouble(get().state, balance));
          if (status.ok) {
            set({ offline: null });
            removeOffers('offlineDouble');
            popIdleOffers(Date.now());
            saveNow(Date.now());
          }
          return status;
        } finally {
          set({ busy: false });
        }
      },

      dismissOffline() {
        // "Keep" closes the panel; the double waits as an offer on the left until it runs out.
        set({ offline: null });
        popIdleOffers(Date.now());
      },

      async buyRemoveAds() {
        if (get().state.removeAds) return { ok: false, error: 'already_owned' };
        const res = await services.purchases.buy(balance.shop.removeAdsProductId);
        if (!res.ok) return { ok: false, error: res.error ?? 'failed' };
        const status = apply(E.buyRemoveAds(get().state));
        if (status.ok) saveNow(Date.now());
        return status;
      },

      async restorePurchases() {
        try {
          const items = await services.purchases.restore();
          let restored = 0;
          for (const item of items) {
            if (item.productId === balance.shop.removeAdsProductId && !get().state.removeAds) {
              if (apply(E.buyRemoveAds(get().state)).ok) restored++;
            }
          }
          if (restored > 0) saveNow(Date.now());
          return { ok: true, restored };
        } catch {
          return { ok: false, restored: 0 };
        }
      },

      setSetting(key, value) {
        const state = get().state;
        set({ state: { ...state, settings: { ...state.settings, [key]: value } } });
        if (key === 'sound') services.audio.setEnabled(value);
        saveNow(Date.now());
      },

      resetGame() {
        abandonRound();
        services.save.clear();
        const now = Date.now();
        const state = E.createInitialState(balance, now);
        usedLines.clear();
        lastLine = null;
        limbsAtLastRound = 1;
        set({ state, phase: 'idle', round: null, result: null, offline: null, offers: [], secondsLeft: 0, roundMoney: 0 });
        services.save.save(E.serialize(state, now));
      },
    },
  };
});

/** Selector helpers for components. */
export const selectSport = (s: GameStore) => s.state.sports[s.state.currentSport];
/** Banked money plus what the live round has earned so far, so the pill moves during a round. */
export const selectMoney = (s: GameStore) => s.state.sports[s.state.currentSport].money + (s.phase === 'playing' ? s.roundMoney : 0);
export const selectSportId = (s: GameStore) => s.state.currentSport;
