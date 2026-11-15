import { formatTimeAway } from '../timeAway';

describe('formatTimeAway', () => {
  it('rounds anything under a minute up to one minute', () => {
    expect(formatTimeAway(0)).toBe('1 min');
    expect(formatTimeAway(59)).toBe('1 min');
    expect(formatTimeAway(60)).toBe('1 min');
  });

  it('shows minutes under an hour', () => {
    expect(formatTimeAway(125)).toBe('2 min');
    expect(formatTimeAway(45 * 60 + 30)).toBe('45 min');
  });

  it('shows hours and minutes, dropping zero minutes', () => {
    expect(formatTimeAway(3600)).toBe('1 h');
    expect(formatTimeAway(4320)).toBe('1 h 12 min');
    expect(formatTimeAway(7200)).toBe('2 h');
  });

  it('shows days and hours past a day', () => {
    expect(formatTimeAway(86400)).toBe('1 d');
    expect(formatTimeAway(90000)).toBe('1 d 1 h');
  });

  it('never breaks on bad input', () => {
    expect(formatTimeAway(Number.NaN)).toBe('1 min');
    expect(formatTimeAway(-50)).toBe('1 min');
  });
});
