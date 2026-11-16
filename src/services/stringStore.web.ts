/** localStorage for the web preview (tools/screenshot.ts). Missing storage (a private window) reads as empty and writes nowhere. */
import type { StringStore } from './stringStore';

const ls = typeof localStorage === 'undefined' ? null : localStorage;

export const store: StringStore = {
  get: (key) => ls?.getItem(key) ?? null,
  set: (key, value) => ls?.setItem(key, value),
  remove: (key) => ls?.removeItem(key),
};
