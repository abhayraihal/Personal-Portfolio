import type { CollisionEnterPayload } from '@react-three/rapier';
import { events } from '../../../state/events.ts';
import type { Events } from '../../../state/events.ts';

type ImpactMaterial = NonNullable<Events['impact']['material']>;

// Collision handler that reports impacts on the events bus (the audio module turns them into
// thuds). Strength is the relative speed along the contact normal, measured just after the solver
// step, so it reads a little low; below `min` m/s it is ignored, and each body reports at most
// every 0.15 s (a rolling ball would otherwise tick on every small bounce).
export function impactReporter(material: ImpactMaterial, min = 1.5) {
  const last = new Map<number, number>();
  return (e: CollisionEnterPayload) => {
    const a = e.target.rigidBody;
    if (!a) return;
    const va = a.linvel();
    const vb = e.other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 };
    const n = e.manifold.normal();
    const strength = Math.abs((va.x - vb.x) * n.x + (va.y - vb.y) * n.y + (va.z - vb.z) * n.z);
    if (strength < min) return;
    const now = performance.now();
    if (now - (last.get(a.handle) ?? -1e9) < 150) return;
    last.set(a.handle, now);
    const t = a.translation();
    events.emit('impact', { strength, x: t.x, y: t.y, z: t.z, material });
  };
}
