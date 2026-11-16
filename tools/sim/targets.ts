/**
 * Pacing targets (docs/analysis.md "Pacing targets to tune toward"). Judged on the median over seeds. The pacing test and the report use
 * the same list, so they never disagree.
 */
import type { Balance } from '../../src/engine';
import { medianMilestone, type CampaignResult } from './core';

export interface TargetResult {
  id: string;
  name: string;
  result: string;
  target: string;
  ok: boolean;
}

const min = (m: number) => m * 60;

export function evaluateTargets(cs: CampaignResult[], balance: Balance): TargetResult[] {
  const out: TargetResult[] = [];
  const fmt = (s: number) => (Number.isFinite(s) ? `${(s / 60).toFixed(1)} min` : 'never');

  const firstUpgrade = medianMilestone(cs, 'firstUpgrade');
  out.push({ id: 'first_upgrade', name: 'First upgrade bought', result: fmt(firstUpgrade), target: 'within 2 rounds (under 0.5 min)', ok: firstUpgrade <= 30 });

  const swap = medianMilestone(cs, 'firstBallSwap');
  out.push({ id: 'ball_swap', name: 'First ball swap pays off', result: fmt(swap), target: '3 to 6 min', ok: swap >= min(3) && swap <= min(6) });

  const l2 = medianMilestone(cs, 'limbs2');
  out.push({ id: 'limbs2', name: 'Second limb', result: fmt(l2), target: '12 to 18 min', ok: l2 >= min(12) && l2 <= min(18) });

  const l3 = medianMilestone(cs, 'limbs3');
  out.push({ id: 'limbs3', name: 'Third limb', result: fmt(l3), target: '25 to 45 min', ok: l3 >= min(25) && l3 <= min(45) });

  const quiet = Math.max(...cs.map((c) => c.longestQuietSec));
  // The greedy bot saves every coin for the next limb; a player buys small things meanwhile, so the bot's quiet stretches overstate the real ones.
  out.push({ id: 'quiet', name: 'Longest stretch without a purchase in hour 1', result: fmt(quiet), target: 'under 8 min', ok: quiet <= min(8) });

  const t10 = medianMilestone(cs, 'trophies10');
  out.push({ id: 'trophies10', name: `Second sport affordable (${balance.sports.football.unlockTrophies} Trophies)`, result: fmt(t10), target: '60 to 90 min', ok: t10 >= min(60) && t10 <= min(90) });

  return out;
}
