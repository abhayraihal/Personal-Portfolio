import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Model, modelSize } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { hubAt, SPOT } from './layout.ts';

// A bench at the bottom edge of the hub with a small pad for the site credits.
export function Credits() {
  const [bu, bv] = SPOT.bench;
  const [pu, pv] = SPOT.creditsPad;
  const [w, h, d] = modelSize('bench-wood');
  return (
    <>
      <group position={hubAt(bu, bv)}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[w / 2, h / 2, d / 2]} position={[0, h / 2, 0]} />
        </RigidBody>
        <Model name="bench-wood" />
      </group>
      <Pad
        id="hub-credits"
        label="Read the site credits"
        icon="Credits"
        action={{ kind: 'panel', panel: 'credits' }}
        position={hubAt(pu, pv)}
        radius={1.7}
        color={COLORS.inkSoft}
      />
    </>
  );
}
