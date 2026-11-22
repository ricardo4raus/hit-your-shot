/**
 * The target, one look per kind (layers/court/): the hoop (stanchion, glass backboard, rim and swishing net), the goal (posts, net and a
 * keeper sliding along the line) or the hole (putting green, cup and flag). The moving part slides sideways with the engine's target
 * motion, smooth on the UI thread and continuous across rounds (court/motion.ts); a target that does not move during a round (golf) sits
 * at the round's phase. Geometry is built once per camera; per frame only a few transforms and opacities change.
 * Owner of this file: the "court" agent. Props are fixed by layers/shared.ts.
 */
import { Goal } from './court/Goal';
import { Hole } from './court/Hole';
import { Hoop } from './court/Hoop';
import type { TargetLayerProps } from './shared';

export function TargetLayer(props: TargetLayerProps) {
  if (props.def.target.kind === 'goal') return <Goal {...props} />;
  if (props.def.target.kind === 'hole') return <Hole {...props} />;
  return <Hoop {...props} />;
}
