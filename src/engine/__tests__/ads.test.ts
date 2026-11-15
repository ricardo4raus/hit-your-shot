import { buyRemoveAds, canWatchX2, markX2Used } from '../ads';
import { balance, makeState } from '../testing';

describe('canWatchX2', () => {
  it('is on cooldown right after a ×2 and opens after x2EveryRounds rounds', () => {
    expect(canWatchX2(makeState({ ads: { roundsSinceX2: 0 } }), balance)).toBe(false);
    expect(canWatchX2(makeState({ ads: { roundsSinceX2: balance.ads.x2EveryRounds - 1 } }), balance)).toBe(false);
    expect(canWatchX2(makeState({ ads: { roundsSinceX2: balance.ads.x2EveryRounds } }), balance)).toBe(true);
    expect(canWatchX2(makeState({ ads: { roundsSinceX2: balance.ads.x2EveryRounds + 5 } }), balance)).toBe(true);
  });

  it('is always available with remove-ads', () => {
    expect(canWatchX2(makeState({ removeAds: true, ads: { roundsSinceX2: 0 } }), balance)).toBe(true);
  });
});

describe('markX2Used', () => {
  it('restarts the cooldown without touching the input', () => {
    const before = makeState({ ads: { roundsSinceX2: 7 } });
    const snapshot = JSON.stringify(before);
    const after = markX2Used(before);
    expect(after.ads.roundsSinceX2).toBe(0);
    expect(canWatchX2(after, balance)).toBe(false);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(after).not.toBe(before);
  });

  it('keeps ×2 available with remove-ads even right after use', () => {
    expect(canWatchX2(markX2Used(makeState({ removeAds: true })), balance)).toBe(true);
  });
});

describe('buyRemoveAds', () => {
  it('turns remove-ads on once and reports the event', () => {
    const before = makeState();
    const snapshot = JSON.stringify(before);
    const result = buyRemoveAds(before);
    expect(result.ok).toBe(true);
    expect(result.state.removeAds).toBe(true);
    expect(result.events).toEqual([{ type: 'removeAdsBought' }]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('refuses a second purchase', () => {
    const owned = buyRemoveAds(makeState()).state;
    const again = buyRemoveAds(owned);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('already_owned');
    expect(again.state).toBe(owned);
    expect(again.events).toEqual([]);
  });
});
