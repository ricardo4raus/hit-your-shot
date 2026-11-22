/**
 * The world behind everything, one backdrop per kind of target: the indoor arena for the hoop, the stadium for the goal, the course for
 * the hole (layers/court/). Static per sport and screen size: each backdrop is built once from the camera projection in useMemo, so it
 * follows any reframing of the camera and costs no work per frame beyond replaying its paths.
 * Owner of this file: the "court" agent. Props are fixed by layers/shared.ts.
 */
import { ArenaWorld } from './court/Arena';
import { CourseWorld } from './court/Course';
import { StadiumWorld } from './court/Stadium';
import type { SceneProps } from './shared';

export function WorldLayer({ def, cam, width, height }: SceneProps) {
  if (def.target.kind === 'goal') return <StadiumWorld def={def} cam={cam} width={width} height={height} />;
  if (def.target.kind === 'hole') return <CourseWorld def={def} cam={cam} width={width} height={height} />;
  return <ArenaWorld def={def} cam={cam} width={width} height={height} />;
}
