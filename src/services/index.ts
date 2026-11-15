/**
 * CONTRACT FILE. Owned by the lead.
 * Service registry. Phase 1 (Expo Go) implementations. Replace entries here in phase 2.
 */
import Storage from 'expo-sqlite/kv-store';

import type { AdsService, AudioService, PurchaseService, SaveService, Services, SfxId } from './types';

export * from './types';

const SAVE_KEY = 'hit-your-shot/save';
const BACKUP_KEY = 'hit-your-shot/save-backup';
const BACKUP_EVERY_MS = 60_000;
let lastBackupAt = 0;

/** Save in SQLite key-value storage (works in Expo Go, synchronous). Keeps an older backup copy, at most once a minute. */
export const kvSave: SaveService = {
  load() {
    return Storage.getItemSync(SAVE_KEY) ?? null;
  },
  loadBackup() {
    return Storage.getItemSync(BACKUP_KEY) ?? null;
  },
  save(data) {
    try {
      const now = Date.now();
      if (now - lastBackupAt >= BACKUP_EVERY_MS) {
        const previous = Storage.getItemSync(SAVE_KEY);
        if (previous) Storage.setItemSync(BACKUP_KEY, previous);
        lastBackupAt = now;
      }
      Storage.setItemSync(SAVE_KEY, data);
    } catch (e) {
      console.warn('save failed', e);
    }
  },
  clear() {
    try {
      Storage.removeItemSync(SAVE_KEY);
      Storage.removeItemSync(BACKUP_KEY);
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

/** Phase 1: silent. The audio module arrives with the asset pack. */
export const silentAudio: AudioService = {
  play(_id: SfxId) {},
  setEnabled(_on: boolean) {},
};

export const services: Services = {
  save: kvSave,
  ads: fakeAds,
  purchases: fakePurchases,
  audio: silentAudio,
};
