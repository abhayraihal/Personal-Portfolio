import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { ConeCollider, CuboidCollider, CylinderCollider, InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import type { InstancedRigidBodyProps, RapierRigidBody } from '@react-three/rapier';
import { AdditiveBlending, BoxGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Matrix4, MeshBasicMaterial, PlaneGeometry, SpriteMaterial } from 'three';
import type { BufferGeometry, CanvasTexture } from 'three';
import { COLORS } from '../../config/palette.ts';
import { canvasTexture, makeCanvas } from './canvas.ts';
import { ZONE } from './frame.ts';
import { mergeParts } from './geom.ts';
import { Y } from './Plaza.tsx';
import type { InstancedMesh } from 'three';
import { modelScale, modelSize, useMerged } from '../../components/Model.tsx';
import type { ModelName } from '../../config/models.ts';
import { useStore } from '../../state/store.ts';
import { useHomeReset } from './useHomeReset.ts';

// Things to knock around (crates, cones) and the plaza's street lamps.

type Spot = [number, number, number?]; // x, z, yaw
type Place = { x: number; y: number; z: number; yaw?: number };

// The kit's merged geometry with the world scale baked in, so instances and colliders use metres.
function useScaledGeometry(name: ModelName) {
  const { geometry, material } = useMerged(name);
  const s = modelScale(name);
  return useMemo(() => ({ geometry: geometry.clone().scale(s, s, s), material }), [geometry, material, s]);
}

function Knockables({ name, spots, collider, idle = 12 }: { name: ModelName; spots: Place[]; collider: ReactNode; idle?: number }) {
  const { geometry, material } = useScaledGeometry(name);
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  useHomeReset(bodies, idle, 12);
  const instances = useMemo<InstancedRigidBodyProps[]>(
    () =>
      spots.map((p, i) => ({
        key: `${name}-${i}`,
        position: [p.x, p.y, p.z],
        rotation: [0, p.yaw ?? 0, 0],
      })),
    [name, spots],
  );
  return (
    <InstancedRigidBodies ref={bodies} instances={instances} colliders={false} colliderNodes={[collider]}>
      <instancedMesh args={[geometry, material, instances.length]} castShadow receiveShadow frustumCulled={false} />
    </InstancedRigidBodies>
  );
}

const CRATE = modelSize('crate-wood')[0];
const BANDED = modelSize('crate-wood-banded')[0];
const [CONE_W, CONE_H] = modelSize('traffic-cone');

// A small pyramid near the entrance and a banded crate near the turn to the 2022 street, both in
// the lane away from the camera so they never cover the car; cones in a slalom.
const CRATES: Place[] = [
  { x: -5.2, y: 0, z: -2.2, yaw: 0.05 },
  { x: -5.2 + CRATE + 0.02, y: 0, z: -2.2, yaw: -0.04 },
  { x: -5.2 + CRATE / 2, y: CRATE + 0.01, z: -2.2, yaw: 0.2 },
];
const BANDED_CRATES: Place[] = [{ x: 16.9, y: 0, z: -1.9, yaw: 0.3 }];
const CONES: Place[] = [0, 3.2, 6.4, 9.6, 12.8].map((x, i) => ({ x, y: 0, z: i % 2 ? 0.9 : -0.9 }));

// Garage lamps: [x, z, yaw]; the arm points along the lamp's local +X. The last four stand on the
// far side of the 2022 street where a bay meets a toy (a lamp on the near side would cross the
// street on screen).
export const LAMPS: Spot[] = [
  [-7, -5.4, -Math.PI / 2],
  [-7, 5.4, Math.PI / 2],
  [17.4, -5.4, -Math.PI / 2],
  [-21.3, -30.2, -Math.PI / 2],
  [-6.9, -30.2, -Math.PI / 2],
  [14.9, -30.2, -Math.PI / 2],
  [33.4, -30.2, -Math.PI / 2],
];
const LAMP_H = 4.6;
const ARM = 0.95;

function lampGeometry(): BufferGeometry {
  return mergeParts([
    { g: new CylinderGeometry(0.26, 0.3, 0.3, 12), color: COLORS.inkSoft, at: [0, 0.15, 0] },
    { g: new CylinderGeometry(0.085, 0.1, LAMP_H, 10), color: '#3a3f4b', at: [0, LAMP_H / 2, 0] },
    { g: new BoxGeometry(ARM + 0.1, 0.09, 0.09), color: '#3a3f4b', at: [ARM / 2, LAMP_H - 0.05, 0] },
    { g: new ConeGeometry(0.42, 0.34, 14, 1, true), color: ZONE.color, at: [ARM, LAMP_H - 0.24, 0] },
    { g: new CylinderGeometry(0.1, 0.1, 0.12, 8), color: '#3a3f4b', at: [ARM, LAMP_H - 0.03, 0] },
  ]);
}

// Soft round spots, opaque in the middle and fading out: `core` is the share of the radius that
// stays fairly bright. Halos fall off fast; the pools under the lamps keep a wider lit patch.
const glowMaps = new Map<number, CanvasTexture>();
function glowTexture(core: number): CanvasTexture {
  const hit = glowMaps.get(core);
  if (hit) return hit;
  const [c, g] = makeCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(core, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = canvasTexture(c, 1);
  glowMaps.set(core, tex);
  return tex;
}

const WARM = '#ffc977';
const BULB_DAY = new Color('#fff4d6');
const BULB_NIGHT = new Color('#ffe2a8');
const POOL_R = 4.2;
// Bulb centre (zone-local) of each lamp, under its shade.
const HEADS = LAMPS.map(([x, z, yaw = 0]) => [x + Math.cos(yaw) * ARM, LAMP_H - 0.36, z - Math.sin(yaw) * ARM] as const);

function Lamps() {
  const geometry = useMemo(lampGeometry, []);
  const mesh = useRef<InstancedMesh>(null);
  const bulbs = useRef<InstancedMesh>(null);
  const pools = useRef<InstancedMesh>(null);
  const glow = useRef(0);
  const mats = useMemo(() => {
    const glowing = { color: WARM, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, visible: false };
    return {
      bulb: new MeshBasicMaterial({ color: BULB_DAY.clone(), toneMapped: false }),
      halo: new SpriteMaterial({ ...glowing, map: glowTexture(0.35) }),
      pool: new MeshBasicMaterial({ ...glowing, map: glowTexture(0.6) }),
    };
  }, []);
  const poolGeometry = useMemo(() => new PlaneGeometry(POOL_R * 2, POOL_R * 2).rotateX(-Math.PI / 2), []);
  useLayoutEffect(() => {
    const m = new Matrix4();
    LAMPS.forEach(([x, z, yaw = 0], i) => {
      m.makeRotationY(yaw).setPosition(x, 0, z);
      mesh.current?.setMatrixAt(i, m);
      const [hx, hy, hz] = HEADS[i];
      m.makeTranslation(hx, hy, hz);
      bulbs.current?.setMatrixAt(i, m);
      m.makeTranslation(hx, Y.paint + 0.005, hz);
      pools.current?.setMatrixAt(i, m);
    });
    for (const r of [mesh, bulbs, pools]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  }, []);
  // Night fades the halos and pools in over about a second.
  useFrame((_, delta) => {
    const goal = useStore.getState().night ? 1 : 0;
    if (glow.current === goal) return;
    const k = Math.abs(goal - glow.current) < 0.005 ? goal : glow.current + (goal - glow.current) * Math.min(1, delta * 3);
    glow.current = k;
    mats.halo.opacity = k * 0.85;
    mats.pool.opacity = k * 0.6;
    mats.bulb.color.copy(BULB_DAY).lerp(BULB_NIGHT, k);
    mats.halo.visible = mats.pool.visible = k > 0;
  });
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {LAMPS.map(([x, z], i) => (
          <CylinderCollider key={i} args={[LAMP_H / 2, 0.16]} position={[x, LAMP_H / 2, z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={mesh} args={[geometry, undefined, LAMPS.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.6} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, mats.bulb, LAMPS.length]} frustumCulled={false}>
        <sphereGeometry args={[0.17, 12, 8]} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[poolGeometry, mats.pool, LAMPS.length]} frustumCulled={false} />
      {/* halos sit 0.4 m towards the camera so the shade does not cut them */}
      {HEADS.map(([x, y, z], i) => (
        <sprite key={i} material={mats.halo} position={[x, y + 0.28, z + 0.28]} scale={2.6} />
      ))}
    </group>
  );
}

export function Props() {
  return (
    <group>
      <Knockables name="crate-wood" spots={CRATES} collider={<CuboidCollider args={[CRATE / 2, CRATE / 2, CRATE / 2]} position={[0, CRATE / 2, 0]} density={5} />} />
      <Knockables name="crate-wood-banded" spots={BANDED_CRATES} collider={<CuboidCollider args={[BANDED / 2, BANDED / 2, BANDED / 2]} position={[0, BANDED / 2, 0]} density={6} />} />
      <Knockables name="traffic-cone" spots={CONES} idle={8}
        collider={<ConeCollider args={[CONE_H / 2, CONE_W * 0.42]} position={[0, CONE_H / 2, 0]} density={18} />} />
      <Lamps />
    </group>
  );
}
