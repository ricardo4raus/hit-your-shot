/** Every label on screen (docs/design-rules.md section 10: nouns and verbs, no adjectives). */
export const strings = {
  upgrades: {
    accuracy: 'Accuracy',
    fireRate: 'Fire rate',
    income: 'Income',
    upgrade: 'Upgrade',
    max: 'Max',
    level: (level: number) => `Level ${level}`,
    /** The level chip on a card (display lettering). */
    levelShort: (level: number) => `Lv ${level}`,
  },
  round: {
    dragToAim: 'DRAG TO AIM',
    play: 'Play',
    playAgain: 'Play again',
    hits: (hits: number, shots: number) => `${hits} of ${shots}`,
    shots: 'shots',
    best: 'Best',
    newTag: 'NEW!',
    /** The crooked tag beside the round's money on a best round. */
    newBest: 'NEW BEST!',
    /** Display lettering on the play button; the accessibility labels stay `play` and `playAgain`. */
    playButton: 'PLAY',
    playAgainButton: 'PLAY AGAIN',
  },
  /** Rewarded-ad offers on the left (owner 2026-11-22) and the boost timer above them. */
  offers: {
    /** The ×2 on the offer's badge and on the timer. */
    x2: '×2',
    boostTime: (minutes: number) => `+${minutes} min`,
    boostLabel: (minutes: number, free: boolean) =>
      free ? `×2 money for ${minutes} more minutes, free` : `Watch an ad: ×2 money for ${minutes} more minutes`,
    doubleTitle: 'Double',
    doubleLabel: (free: boolean) => (free ? 'Double the money from while you were away, free' : 'Watch an ad: double the money from while you were away'),
    watch: 'Watch',
    free: 'Free',
    timerLabel: (time: string) => `×2 money, ${time} left`,
  },
  shop: {
    title: 'Shop',
    balls: 'Balls',
    characters: 'Trainers',
    perRound: (money: string) => `about ${money} per round`,
    buy: 'Buy',
    useOnAll: 'Use on all',
    owned: 'Owned',
    inUse: 'In use',
    next: 'Next',
    removeAds: 'Remove ads',
    restore: 'Restore purchases',
    close: 'Close',
  },
  offline: {
    title: 'While you were away',
    away: (time: string) => `${time} away`,
    /** Short display title over the offline money. */
    welcome: 'Welcome back',
    double: 'Double',
    keep: 'Keep',
  },
  settings: {
    title: 'Settings',
    menu: 'Menu',
    sound: 'Sound',
    haptics: 'Haptics',
    privacy: 'Privacy',
    privacyNote: 'Nothing leaves your phone in this version. Progress is saved on the device only. There are no accounts, no analytics and no tracking.',
    restoreDone: (count: number) => (count === 1 ? '1 purchase restored.' : `${count} purchases restored.`),
    restoreNone: 'Nothing to restore.',
    restoreFailed: 'Restore did not work. Try again later.',
    reset: 'Start over',
    resetConfirm: 'This deletes every sport and every upgrade. There is no undo.',
    cancel: 'Cancel',
    confirmReset: 'Delete and start over',
    close: 'Close',
  },
} as const;
