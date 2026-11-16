/** SQLite key-value storage: works in Expo Go, synchronous. */
import Storage from 'expo-sqlite/kv-store';

import type { StringStore } from './stringStore';

export const store: StringStore = {
  get: (key) => Storage.getItemSync(key) ?? null,
  set: (key, value) => Storage.setItemSync(key, value),
  remove: (key) => Storage.removeItemSync(key),
};
