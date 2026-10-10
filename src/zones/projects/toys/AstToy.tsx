import { useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, CylinderGeometry, Quaternion, RingGeometry, Vector3 } from 'three';
import type { Group, MeshStandardMaterial } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { useStore } from '../../../state/store.ts';
import { carNearZone } from '../frame.ts';
import { mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';
import { astSignal } from './signals.ts';

// The rule "age > 30 AND department = 'Sales'" as the project stores it: one operator node over
// two comparison leaves. The leaves hang from the operator on rods and sway a little; parking on
// the rule engine pad runs an evaluation glow from the leaves up to the root.

const ROOT_Y = 4.0; // centre of the operator node
const HANG = 1.95; // rod drop from the root to the leaf hooks
const LEAF_X = 1.9;
const TEXT = 0.38;
const LINE = 0.48;
const GLOW = new Color('#ffd23f');
const BLACK = new Color('#000000');

const _q = new Quaternion();
const _y = new Vector3(0, 1, 0);

// A rod between two points as a cylinder part.
function rod(from: Vector3, to: Vector3): Part {
  const dir = to.clone().sub(from).normalize();
  const g = new CylinderGeometry(0.08, 0.08, from.distanceTo(to), 10);
  g.applyQuaternion(_q.setFromUnitVectors(_y, dir));
  const mid = from.clone().add(to).multiplyScalar(0.5);
  return { g, color: COLORS.ink, at: [mid.x, mid.y, mid.z] };
}

// A leaf tile hanging from a hook at its top centre (the group origin).
function Leaf({ lines, width, matRef }: { lines: string[]; width: number; matRef: (m: MeshStandardMaterial | null) => void }) {
  const h = 0.42 + lines.length * LINE;
  return (
    <group>
      <mesh position={[0, -0.12, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color={COLORS.ink} roughness={0.6} />
      </mesh>
      <group position={[0, -0.2 - h / 2, 0]}>
        <RoundedBox args={[width, h, 0.36]} radius={0.14} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial ref={matRef} color={COLORS.paper} roughness={0.85} />
        </RoundedBox>
        {lines.map((l, i) => (
          <Label key={i} font="bodyBold" size={TEXT} color={COLORS.ink} position={[0, ((lines.length - 1) / 2 - i) * LINE, 0.19]}>
            {l}
          </Label>
        ))}
      </group>
    </group>
  );
}

export function AstToy({ position }: { position: [number, number, number] }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const rootMat = useRef<MeshStandardMaterial | null>(null);
  const leafMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const t = useRef(0);
  const evalT = useRef(-1);

  useFrame((_, delta) => {
    if (!carNearZone()) return;
    const dt = Math.min(delta, 0.1);
    t.current += dt;
    const sway = useStore.getState().reducedMotion ? 0 : 0.06;
    if (left.current) left.current.rotation.z = Math.sin(t.current * 1.3) * sway;
    if (right.current) right.current.rotation.z = Math.sin(t.current * 1.3 + 1.7) * sway;

    // Evaluation: the leaves glow, then the root, on a 3.2 s loop while the car is parked.
    if (astSignal.parked && evalT.current < 0) evalT.current = 0;
    if (evalT.current >= 0) {
      evalT.current += dt;
      const k = evalT.current % 3.2;
      const leafK = k < 1.4 ? Math.sin((k / 1.4) * Math.PI) : 0;
      const rootK = k > 0.9 && k < 2.6 ? Math.sin(((k - 0.9) / 1.7) * Math.PI) : 0;
      for (const m of leafMats.current) if (m) m.emissive.copy(BLACK).lerp(GLOW, leafK * 0.55);
      if (rootMat.current) rootMat.current.emissive.copy(BLACK).lerp(GLOW, rootK * 0.45);
      if (!astSignal.parked && k > 3.0) {
        evalT.current = -1;
        for (const m of leafMats.current) m?.emissive.copy(BLACK);
        rootMat.current?.emissive.copy(BLACK);
      }
    }
  });

  const hookY = ROOT_Y - HANG;
  // plinth, accent ring, the post holding the root up, and the two rods
  const base = useMemo(
    () =>
      mergeParts([
        { g: new CylinderGeometry(1.8, 1.95, 0.44, 32), color: COLORS.paperShade, at: [0, 0.22, 0] },
        { g: new RingGeometry(1.45, 1.62, 32), color: COLORS.accent, at: [0, 0.45, 0], rot: [-Math.PI / 2, 0, 0] },
        { g: new BoxGeometry(0.24, ROOT_Y, 0.24), color: COLORS.inkSoft, at: [0, ROOT_Y / 2 + 0.2, -0.45] },
        rod(new Vector3(-0.45, ROOT_Y - 0.4, 0), new Vector3(-LEAF_X, hookY, 0)),
        rod(new Vector3(0.45, ROOT_Y - 0.4, 0), new Vector3(LEAF_X, hookY, 0)),
      ]),
    [hookY],
  );
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.22, 1.9]} position={[0, 0.22, 0]} />
        <CuboidCollider args={[0.14, ROOT_Y / 2, 0.14]} position={[0, ROOT_Y / 2, -0.45]} />
      </RigidBody>
      <mesh geometry={base} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      <group position={[0, ROOT_Y, 0]}>
        <RoundedBox args={[1.9, 1.02, 0.4]} radius={0.16} smoothness={3} castShadow>
          <meshStandardMaterial ref={rootMat} color={COLORS.accent} roughness={0.7} />
        </RoundedBox>
        <Label font="display" size={0.66} color={COLORS.paper} position={[0, 0.03, 0.21]}>
          AND
        </Label>
      </group>
      <group ref={left} position={[-LEAF_X, hookY, 0]}>
        <Leaf lines={['age > 30']} width={2.05} matRef={(m) => void (leafMats.current[0] = m)} />
      </group>
      <group ref={right} position={[LEAF_X, hookY, 0]}>
        <Leaf lines={['department', "= 'Sales'"]} width={2.45} matRef={(m) => void (leafMats.current[1] = m)} />
      </group>
    </group>
  );
}
