/**
 * CONTRACT FILE. Owned by the lead.
 * Service registry. Phase 1 (Expo Go) implementations. Replace entries here in phase 2.
 */
import { expoAudio } from './audio';
import type { AdsService, AudioService, PurchaseService, SaveService, Services, SfxId } from './types';
import { store } from './stringStore';

export * from './types';

const SAVE_KEY = 'hit-your-shot/save';
const BACKUP_KEY = 'hit-your-shot/save-backup';
const BACKUP_EVERY_MS = 60_000;
let lastBackupAt = 0;

/** Save in the platform's synchronous string store (SQLite on the phone, localStorage on the web preview). Keeps an older backup copy, at most once a minute. */
export const kvSave: SaveService = {
  load() {
    return store.get(SAVE_KEY);
  },
  loadBackup() {
    return store.get(BACKUP_KEY);
  },
  save(data) {
    try {
      const now = Date.now();
      if (now - lastBackupAt >= BACKUP_EVERY_MS) {
        const previous = store.get(SAVE_KEY);
        if (previous) store.set(BACKUP_KEY, previous);
        lastBackupAt = now;
      }
      store.set(SAVE_KEY, data);
    } catch (e) {
      console.warn('save failed', e);
    }
  },
  clear() {
    try {
      store.remove(SAVE_KEY);
      store.remove(BACKUP_KEY);
    } catch (e) {
      console.warn('clear failed', e);
    }
  },
};

/** Phase 1: pretends an ad was watched after a short wait. Replaced by AdMob in a development build. */
export const fakeAds: AdsService = {
  isTest: true,
  showRewarded() {
    return new Promise((resolve) => setTimeout(() => resolve({ rewarded: true }), 800));
  },
};

/** Phase 1: pretends a purchase succeeds. Replaced by RevenueCat in a development build. */
export const fakePurchases: PurchaseService = {
  isTest: true,
  async buy(productId) {
    return { ok: true, transactionId: `test-${productId}-${Date.now()}` };
  },
  async restore() {
    return [];
  },
  priceText() {
    return null;
  },
};

/** Silent audio, for tests and as a fallback. The game uses expoAudio (services/audio.ts). */
export const silentAudio: AudioService = {
  play(_id: SfxId) {},
  setEnabled(_on: boolean) {},
};

export const services: Services = {
  save: kvSave,
  ads: fakeAds,
  purchases: fakePurchases,
  audio: expoAudio,
};
