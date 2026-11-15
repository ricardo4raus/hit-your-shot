/**
 * CONTRACT FILE. Owned by the lead.
 * Shots of the live round, outside React state: hundreds per second are possible and must never re-render the tree.
 * The store pushes each resolved shot here; the play scene drains the batch once per frame and moves it to the UI thread.
 */
import type { ShotResult } from '@/engine';

type ShotListener = (batch: readonly ShotResult[]) => void;

let pending: ShotResult[] = [];
const listeners = new Set<ShotListener>();

/** Called by the store for every resolved shot. */
export function pushShot(shot: ShotResult): void {
  pending.push(shot);
}

/** Called by the store at the end of a tick: hands the batch to the scene and clears it. */
export function flushShots(): void {
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  for (const l of listeners) {
    try {
      l(batch);
    } catch (err) {
      console.warn('shot listener failed', err);
    }
  }
}

/** Drops pending shots (new round, reset). */
export function clearShots(): void {
  pending = [];
}

export function onShots(listener: ShotListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
