/**
 * CONTRACT FILE. Owned by the lead.
 * Interfaces for everything that talks to the phone or the internet. Phase 1 (Expo Go) uses fake or Expo Go-compatible versions.
 * Phase 2 (development build) swaps in AdMob and RevenueCat without changing any caller.
 */

export interface SaveService {
  /** Synchronous so the app can save when it goes to the background. Returns null for an empty slot; throws when the slot cannot be read. */
  load(): string | null;
  loadBackup(): string | null;
  save(data: string): void;
  clear(): void;
}

export interface AdResult {
  rewarded: boolean;
}

export interface AdsService {
  /** Shows a rewarded ad. Resolves rewarded=true only when the user earned the reward. */
  showRewarded(placement: 'x2_round' | 'offline_double'): Promise<AdResult>;
  readonly isTest: boolean;
}

export interface PurchaseResult {
  ok: boolean;
  transactionId?: string;
  error?: 'cancelled' | 'failed' | 'not_available';
}

export interface PurchaseService {
  buy(productId: string): Promise<PurchaseResult>;
  /** Product ids the store says the user owns. */
  restore(): Promise<{ productId: string; transactionId: string }[]>;
  /** Local price text, or null if unknown (show the balance price then). */
  priceText(productId: string): string | null;
  readonly isTest: boolean;
}

export type SfxId = 'shot' | 'hit' | 'rim' | 'floor' | 'buy' | 'roundEnd' | 'newBest' | 'footsteps' | 'error';

export interface AudioService {
  play(id: SfxId): void;
  setEnabled(on: boolean): void;
}

export interface Services {
  save: SaveService;
  ads: AdsService;
  purchases: PurchaseService;
  audio: AudioService;
}
