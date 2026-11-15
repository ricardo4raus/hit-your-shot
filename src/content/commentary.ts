/**
 * The commentator (docs/design-rules.md section 10). Deadpan, at most eight words, never encourages, never exclaims.
 * One line per round result, chosen by situation. The picker never repeats a line within a session and never shows the same line twice in
 * a row. Add lines here only; review them against the voice rules.
 */
import type { Rng } from '@/engine';

export type Situation =
  | 'zero'
  | 'perfect'
  | 'newBest'
  | 'heavyLow'
  | 'firstTwoArms'
  | 'firstThreeArms'
  | 'firstManyLimbs'
  | 'firstTwoFeet'
  | 'firstThreeFeet'
  | 'manyBalls'
  | 'plain';

export const LINES: Record<Situation, readonly string[]> = {
  zero: ['Zero for eleven. The hoop sends regards.', 'Nothing went in. Something went out.', 'The net remains dry.', 'A quiet round for the net.'],
  perfect: ['Textbook. Whose textbook, unclear.', 'All of them. Suspicious.', 'Not a single miss. Noted.'],
  newBest: ['A new personal best. Modest, but personal.', 'Best yet. The bar was on the floor.', 'A record. Nobody else is keeping count.'],
  heavyLow: ['Heavy ball. Heavy round.', 'The ball did arrive, eventually.', 'That one had opinions.'],
  firstTwoArms: ['Both hands. Interesting choice.'],
  firstThreeArms: ['The league has been informed.'],
  firstManyLimbs: ['No comment.'],
  firstTwoFeet: ['Both feet. Still standing. Somehow.'],
  firstThreeFeet: ['Three feet. One ball. Fair.'],
  manyBalls: ['That is a lot of ball.', 'The floor is mostly ball now.', 'Someone will have to collect those.'],
  plain: [
    'Three off the rim. Rim is fine.',
    'Wind: none. Excuses: none.',
    'He is not getting tired. We checked.',
    'Adequate.',
    'The hoop moved. It does that.',
    'Some went in.',
    'A round happened.',
    'The crowd would have liked that. If present.',
  ],
};

export interface CommentaryInput {
  shots: number;
  hits: number;
  newBest: boolean;
  limbs: number;
  limbKind: 'arm' | 'foot';
  /** First round after a character with this many limbs arrived. */
  firstRoundWithLimbs: boolean;
  heavyBall: boolean;
}

/** Which pool fits the round. The reveal lines win; then the extremes; then plain. `manyBallsShots` comes from balance.commentary. */
export function situationFor(input: CommentaryInput, manyBallsShots: number): Situation {
  if (input.firstRoundWithLimbs) {
    if (input.limbKind === 'foot') {
      if (input.limbs === 2) return 'firstTwoFeet';
      if (input.limbs === 3) return 'firstThreeFeet';
    } else {
      if (input.limbs === 2) return 'firstTwoArms';
      if (input.limbs === 3) return 'firstThreeArms';
    }
    if (input.limbs >= 4) return 'firstManyLimbs';
  }
  if (input.shots >= manyBallsShots) return 'manyBalls';
  if (input.shots > 0 && input.hits === 0) return 'zero';
  if (input.newBest) return 'newBest';
  if (input.shots >= 4 && input.hits === input.shots) return 'perfect';
  if (input.heavyBall && input.hits <= 2) return 'heavyLow';
  return 'plain';
}

/** Picks a line, avoiding ones already used this session; when a pool is exhausted it reopens except for the last line shown. */
export function pickLine(situation: Situation, used: Set<string>, last: string | null, rng: Rng): string {
  const pool = LINES[situation];
  let candidates = pool.filter((l) => !used.has(l) && l !== last);
  if (candidates.length === 0) candidates = pool.filter((l) => l !== last);
  if (candidates.length === 0) candidates = [...pool];
  const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return candidates[index] ?? pool[0] ?? '';
}
