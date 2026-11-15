/**
 * CONTRACT FILE. Owned by the lead.
 * The game store: holds GameState and the live round, runs the round clock, resolves shots, saves, and exposes every player action.
 *
 * Rules for UI code:
 * - Read with narrow selectors: `useGame((s) => s.state.sports[s.state.currentSport].money)`. Never select whole objects in components
 *   that render often.
 * - The aim is NOT React state. The play field writes it with `setAim(angle)` every frame; the store reads it when a limb fires.
 * - Shots arrive through `onShots` in store/shotBus.ts, never through React state.
 * - Call actions through `useGame.getState().actions.xxx(...)`. Every action returns `{ ok }` or `{ ok: false, error }`.
 * - Animations and toasts react to events: `useGameEvent` from store/events.ts.
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

const TICK_MS = 1000 / 30;
const SAVE_EVERY_MS = 5000;
const HIT_HAPTIC_MIN_GAP_MS = 120;
const TWO_PI = 2 * Math.PI;

export interface GameActions {
  init(): void;
  /** Starts a round in the current sport. No-op while one is playing. */
  startRound(): ActionStatus;
  /** Called from the play field on every drag frame. Radians, 0 = right, positive = up. */
  setAim(angle: number): void;
  /** Dismisses the result panel without starting a round (the shop opens, for example). */
  dismissResult(): void;
  buyUpgrade(id: UpgradeId): ActionStatus;
  buyBall(id: BallId): ActionStatus;
  assignLimbBall(limb: number, id: BallId): ActionStatus;
  assignAllLimbs(id: BallId): ActionStatus;
  buyCharacter(): ActionStatus;
  unlockSport(id: SportId): ActionStatus;
  selectSport(id: SportId): ActionStatus;
  /** Shows the ad (free with removeAds) and doubles the next round. */
  watchX2(): Promise<ActionStatus>;
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
  /** The ×2 ad is being shown. */
  busy: boolean;
  actions: GameActions;
}

/** The 30 Hz round clock runs only while a round is playing; the slow loop saves while idle. */
let fastLoop: ReturnType<typeof setInterval> | null = null;
let slowLoop: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove(): void } | null = null;
let aim = Math.PI / 4;
let roundRng: Rng = E.createRng(1);
let lastSaveAt = 0;
let lastHitHapticAt = 0;
let pendingDouble = false;
let limbsAtLastRound = 0;
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
    saveNow(Date.now());
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
      const res = E.applyOfflineEarnings(get().state, balance, now);
      if (res.ok) {
        set({ state: res.state });
        emitGameEvents(res.events);
        const earned = res.events.find((e) => e.type === 'offlineEarned');
        if (earned && earned.type === 'offlineEarned') {
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
    busy: false,
    actions: {
      init() {
        if (get().ready) return;
        const now = Date.now();
        let state = loadState(now);
        const res = E.applyOfflineEarnings(state, balance, now);
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
        // The ×2 ad counts as used only now, when the round it pays for actually starts.
        const doubled = pendingDouble;
        pendingDouble = false;
        const next = doubled ? E.markX2Used(seeded) : seeded;
        set({ state: next, phase: 'playing', round: { ...round, doubled }, secondsLeft: round.seconds, roundMoney: 0, result: null });
        startFastLoop();
        return { ok: true };
      },

      setAim(angle) {
        if (Number.isFinite(angle)) aim = angle;
      },

      dismissResult() {
        if (get().phase === 'result') set({ phase: 'idle', result: null, round: null });
      },

      buyUpgrade(id) {
        const status = apply(E.buyUpgrade(get().state, balance, id));
        if (status.ok) afterPurchase('buy');
        return status;
      },

      buyBall(id) {
        const status = apply(E.buyBall(get().state, balance, id));
        if (status.ok) afterPurchase('buy');
        return status;
      },

      assignLimbBall(limb, id) {
        const status = apply(E.assignLimbBall(get().state, balance, limb, id));
        if (status.ok) saveNow(Date.now());
        return status;
      },

      assignAllLimbs(id) {
        const status = apply(E.assignAllLimbs(get().state, balance, id));
        if (status.ok) saveNow(Date.now());
        return status;
      },

      buyCharacter() {
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
          pendingDouble = false;
          set({ phase: 'idle', result: null, round: null });
          saveNow(Date.now());
        }
        return status;
      },

      async watchX2() {
        const { state, busy, phase } = get();
        if (busy || phase === 'playing') return { ok: false, error: 'invalid' };
        if (!E.canWatchX2(state, balance)) return { ok: false, error: 'not_available' };
        if (pendingDouble) return { ok: false, error: 'already_owned' };
        set({ busy: true });
        try {
          if (!state.removeAds) {
            const result = await services.ads.showRewarded('x2_round');
            if (!result.rewarded) return { ok: false, error: 'not_available' };
          }
          // Marked as used when the doubled round starts (startRound), so a kill before that does not burn the cooldown.
          pendingDouble = true;
          emitGameEvents([{ type: 'x2Applied', sport: state.currentSport }]);
          return { ok: true };
        } finally {
          set({ busy: false });
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
          if (status.ok) set({ offline: null });
          return status;
        } finally {
          set({ busy: false });
        }
      },

      dismissOffline() {
        set({ offline: null, state: { ...get().state, offline: { ...get().state.offline, pendingDouble: 0 } } });
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
        pendingDouble = false;
        limbsAtLastRound = 1;
        set({ state, phase: 'idle', round: null, result: null, offline: null, secondsLeft: 0, roundMoney: 0 });
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
