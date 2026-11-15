import { pipsFor } from '../pips';

describe('pipsFor', () => {
  it('starts empty in the first tier', () => {
    expect(pipsFor(0, 5)).toEqual({ filled: 0, total: 5, tier: 1 });
  });

  it('fills one pip per level inside a tier', () => {
    expect(pipsFor(1, 5)).toEqual({ filled: 1, total: 5, tier: 1 });
    expect(pipsFor(3, 5)).toEqual({ filled: 3, total: 5, tier: 1 });
  });

  it('shows a completed tier full rather than the next tier empty', () => {
    expect(pipsFor(5, 5)).toEqual({ filled: 5, total: 5, tier: 1 });
    expect(pipsFor(6, 5)).toEqual({ filled: 1, total: 5, tier: 2 });
    expect(pipsFor(40, 5)).toEqual({ filled: 5, total: 5, tier: 8 });
  });

  it('never breaks on bad input', () => {
    expect(pipsFor(-3, 5)).toEqual({ filled: 0, total: 5, tier: 1 });
    expect(pipsFor(2.7, 5).filled).toBe(2);
    expect(pipsFor(4, 0)).toEqual({ filled: 1, total: 1, tier: 4 });
    expect(pipsFor(Number.NaN, Number.NaN)).toEqual({ filled: 0, total: 1, tier: 1 });
  });
});
