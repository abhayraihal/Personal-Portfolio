import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BOUNDS, ROADS, ROUNDABOUT, STREAM } from '../config/layout.ts';
import { COLORS } from '../config/palette.ts';
import { FACE_CAMERA_Y } from '../config/world.ts';

// PLACEHOLDER world (spine). The world module replaces this with the valley: gradient ground,
// hills, forest, stream, prayer flags, lighting and night mode.

// Screen-space (u, v) segment drawn as a flat strip inside a group rotated by FACE_CAMERA_Y,
// where local x = u and local z = -v.
function Strip({ a, b, width, color, y = 0.02 }: { a: [number, number]; b: [number, number]; width: number; color: string; y?: number }) {
  const du = b[0] - a[0];
  const dv = b[1] - a[1];
  const len = Math.hypot(du, dv);
  const angle = Math.atan2(dv, du);
  return (
    <mesh position={[(a[0] + b[0]) / 2, y, -(a[1] + b[1]) / 2]} rotation={[-Math.PI / 2, 0, angle]} receiveShadow>
      <planeGeometry args={[len + width, width]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

export function World() {
  const w = BOUNDS.u1 - BOUNDS.u0;
  const h = BOUNDS.v1 - BOUNDS.v0;
  const cu = (BOUNDS.u0 + BOUNDS.u1) / 2;
  const cv = (BOUNDS.v0 + BOUNDS.v1) / 2;
  return (
    <>
      <color attach="background" args={[COLORS.fog]} />
      <fog attach="fog" args={[COLORS.fog, 90, 220]} />
      <hemisphereLight args={['#fff6e8', '#7f9a62', 1.5]} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[400, 0.5, 400]} position={[0, -0.5, 0]} friction={1} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color={COLORS.groundMid} roughness={1} />
      </mesh>
      <group rotation={[0, FACE_CAMERA_Y, 0]}>
        {ROADS.map((r) =>
          r.points.slice(1).map((p, i) => (
            <Strip key={`${r.id}-${i}`} a={r.points[i]} b={p} width={r.width} color={r.kind === 'asphalt' ? COLORS.road : COLORS.dirt} />
          )),
        )}
        <mesh position={[ROUNDABOUT.u, 0.025, -ROUNDABOUT.v]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[ROUNDABOUT.r - ROUNDABOUT.width / 2, ROUNDABOUT.r + ROUNDABOUT.width / 2, 48]} />
          <meshStandardMaterial color={COLORS.road} roughness={1} />
        </mesh>
        {STREAM.points.slice(1).map((p, i) => (
          <Strip key={`stream-${i}`} a={STREAM.points[i]} b={p} width={STREAM.width} color={COLORS.water} y={0.015} />
        ))}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[w / 2, 4, 1]} position={[cu, 4, -BOUNDS.v1 - 1]} />
          <CuboidCollider args={[w / 2, 4, 1]} position={[cu, 4, -BOUNDS.v0 + 1]} />
          <CuboidCollider args={[1, 4, h / 2]} position={[BOUNDS.u0 - 1, 4, -cv]} />
          <CuboidCollider args={[1, 4, h / 2]} position={[BOUNDS.u1 + 1, 4, -cv]} />
        </RigidBody>
      </group>
    </>
  );
}
