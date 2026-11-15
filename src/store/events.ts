/**
 * CONTRACT FILE. Owned by the lead.
 * Game event bus. The store emits every engine event here; UI components subscribe to play animations, show toasts or open panels.
 */
import { useEffect, useRef } from 'react';

import type { GameEvent } from '@/engine';

type Listener = (event: GameEvent) => void;
const listeners = new Set<Listener>();

export function onGameEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitGameEvents(events: readonly GameEvent[]): void {
  for (const e of events) {
    for (const l of listeners) {
      try {
        l(e);
      } catch (err) {
        console.warn('game event listener failed', err);
      }
    }
  }
}

/** Subscribes for the lifetime of the component. The latest handler is always used. */
export function useGameEvent(handler: Listener): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => onGameEvent((e) => ref.current(e)), []);
}
