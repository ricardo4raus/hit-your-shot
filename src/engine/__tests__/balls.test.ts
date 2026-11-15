import { assignAllLimbs, assignLimbBall, buyBall } from '../balls';
import { balance, makeState, makeStateWith } from '../testing';

const [foam, regulation, medicine] = balance.sports.basketball.balls.map((b) => b.id) as [string, string, string];
const regulationDef = balance.sports.basketball.balls[1]!;

describe('buyBall', () => {
  it('starts with the first ball owned and on the only limb', () => {
    const sport = makeState().sports.basketball;
    expect(sport.ownedBalls).toEqual([foam]);
    expect(sport.limbBalls).toEqual([foam]);
  });

  it('buys a ball, subtracts the cost and leaves the limbs alone', () => {
    const state = makeStateWith('basketball', { money: regulationDef.cost + 2 });
    const result = buyBall(state, balance, regulation);
    expect(result.ok).toBe(true);
    expect(result.state.sports.basketball.money).toBe(2);
    expect(result.state.sports.basketball.ownedBalls).toEqual([foam, regulation]);
    expect(result.state.sports.basketball.limbBalls).toEqual([foam]);
    expect(result.events).toEqual([{ type: 'ballBought', sport: 'basketball', id: regulation }]);
    expect(state.sports.basketball.ownedBalls).toEqual([foam]);
  });

  it('refuses a double buy', () => {
    const state = makeStateWith('basketball', { money: regulationDef.cost * 2, ownedBalls: [foam, regulation] });
    const result = buyBall(state, balance, regulation);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('already_owned');
    expect(result.state).toBe(state);
  });

  it('refuses the starting ball, which is already owned', () => {
    const result = buyBall(makeState(), balance, foam);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('already_owned');
  });

  it('refuses without money', () => {
    const state = makeStateWith('basketball', { money: regulationDef.cost - 1 });
    const result = buyBall(state, balance, regulation);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_enough_money');
  });

  it('refuses an unknown id and a ball of another sport', () => {
    const state = makeStateWith('basketball', { money: Number.MAX_SAFE_INTEGER });
    const unknown = buyBall(state, balance, 'moon-rock');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toBe('unknown_id');
    const otherSport = buyBall(state, balance, balance.sports.football.balls[1]!.id);
    expect(otherSport.ok).toBe(false);
    if (!otherSport.ok) expect(otherSport.error).toBe('unknown_id');
  });
});

describe('assignLimbBall', () => {
  it('puts an owned ball on one limb and leaves the others', () => {
    const state = makeStateWith('basketball', { ownedBalls: [foam, regulation], limbs: 2, limbBalls: [foam, foam] });
    const result = assignLimbBall(state, balance, 1, regulation);
    expect(result.ok).toBe(true);
    expect(result.state.sports.basketball.limbBalls).toEqual([foam, regulation]);
    expect(state.sports.basketball.limbBalls).toEqual([foam, foam]);
  });

  it('refuses an unowned ball', () => {
    const result = assignLimbBall(makeState(), balance, 0, medicine);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_owned');
  });

  it('refuses a limb out of range', () => {
    const state = makeStateWith('basketball', { limbs: 2, limbBalls: [foam, foam] });
    for (const limb of [-1, 2, 1.5, Number.NaN]) {
      const result = assignLimbBall(state, balance, limb, foam);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('invalid');
    }
    expect(assignLimbBall(state, balance, 1, foam).ok).toBe(true);
  });

  it('refuses an unknown id', () => {
    const result = assignLimbBall(makeState(), balance, 0, 'moon-rock');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unknown_id');
  });
});

describe('assignAllLimbs', () => {
  it('puts an owned ball on every limb', () => {
    const state = makeStateWith('basketball', { ownedBalls: [foam, regulation, medicine], limbs: 3, limbBalls: [foam, regulation, foam] });
    const result = assignAllLimbs(state, balance, medicine);
    expect(result.ok).toBe(true);
    expect(result.state.sports.basketball.limbBalls).toEqual([medicine, medicine, medicine]);
    expect(result.events).toEqual([]);
    expect(state.sports.basketball.limbBalls).toEqual([foam, regulation, foam]);
  });

  it('refuses an unowned ball and an unknown id', () => {
    const unowned = assignAllLimbs(makeState(), balance, regulation);
    expect(unowned.ok).toBe(false);
    if (!unowned.ok) expect(unowned.error).toBe('not_owned');
    const unknown = assignAllLimbs(makeState(), balance, 'moon-rock');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toBe('unknown_id');
  });
});
