/** The synchronous string store behind the save. Metro picks stringStore.native.ts on the phone and stringStore.web.ts on the web. */
export interface StringStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export declare const store: StringStore;
