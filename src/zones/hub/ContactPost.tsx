import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, BufferAttribute, CylinderGeometry, Euler, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { BufferGeometry, Group, Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Board } from '../../components/Board.tsx';
import { Model, modelScale, modelUrl, useMerged } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import type { ModelName } from '../../config/models.ts';
import { DEG } from '../../config/world.ts';
import { contact, panels } from '../../data/profile.ts';
import { useStore } from '../../state/store.ts';
import { hubAt, SPOT } from './layout.ts';
import { mergeParts } from './merge.ts';

// Log hut from scripts/asset-manifest.json hutRecipe (2 x 2 cells, door on +Z), merged into one
// mesh, plus the door leaf on its own so it can swing open while the car waits on the pad.
const HUT_SCALE = 2.5; // walls 2.5 m, door 2 m
type Part = { model: ModelName; p: [number, number, number]; r: number; mirror?: boolean };
const HUT_PARTS: Part[] = [
  { model: 'hut-floor', p: [-0.5, 0, 0], r: 0 },
  { model: 'hut-floor', p: [0.5, 0, 0], r: 0 },
  { model: 'hut-floor', p: [-0.5, 0, -1], r: 0 },
  { model: 'hut-floor', p: [0.5, 0, -1], r: 0 },
  { model: 'hut-wall-window', p: [0.5, 0, 0], r: 0 },
  { model: 'hut-wall', p: [-0.5, 0, -1], r: 180 },
  { model: 'hut-wall', p: [0.5, 0, -1], r: 180 },
  { model: 'hut-wall-window', p: [-0.5, 0, 0], r: -90 },
  { model: 'hut-wall', p: [-0.5, 0, -1], r: -90 },
  { model: 'hut-wall', p: [0.5, 0, 0], r: 90 },
  { model: 'hut-wall-window', p: [0.5, 0, -1], r: 90 },
  { model: 'hut-corner-logs', p: [-0.5, 0, 0], r: 0 },
  { model: 'hut-corner-logs', p: [0.5, 0, 0], r: 90 },
  { model: 'hut-corner-logs', p: [-0.5, 0, -1], r: -90 },
  { model: 'hut-corner-logs', p: [0.5, 0, -1], r: 180 },
  { model: 'hut-gable-half', p: [-0.5, 1, 0], r: 0, mirror: true },
  { model: 'hut-gable-half', p: [0.5, 1, 0], r: 0 },
  { model: 'hut-gable-half', p: [-0.5, 1, -1], r: 180 },
  { model: 'hut-gable-half', p: [0.5, 1, -1], r: 180, mirror: true },
  { model: 'hut-roof-snow', p: [0.5, 1, 0], r: 0 },
  { model: 'hut-roof-snow', p: [0.5, 1, -1], r: 0 },
  { model: 'hut-roof-snow', p: [-0.5, 1, 0], r: 180 },
  { model: 'hut-roof-snow', p: [-0.5, 1, -1], r: 180 },
];
// The door wall is listed in the recipe at (-0.5, 0, 0), rotation 0.
const DOOR_WALL_AT: [number, number, number] = [-0.5, 0, 0];
const DOOR_OPEN = -100 * DEG; // the GLB's 'open' clip ends here

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();
const _t = new Vector3();

function partMatrix(p: [number, number, number], r: number, mirror = false) {
  _q.setFromEuler(_e.set(0, r * DEG, 0));
  _s.set(mirror ? -1 : 1, 1, 1);
  return _m.compose(_t.set(p[0], p[1], p[2]), _q, _s);
}

// A mirrored part needs its triangles flipped to stay front-facing.
function flipWinding(g: BufferGeometry) {
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.getAttribute(name) as BufferAttribute | undefined;
    if (!a) continue;
    const n = a.itemSize;
    const arr = a.array as Float32Array;
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const t = arr[(i + 1) * n + k];
        arr[(i + 1) * n + k] = arr[(i + 2) * n + k];
        arr[(i + 2) * n + k] = t;
      }
    }
    a.needsUpdate = true;
  }
}

function prepare(src: BufferGeometry, m: Matrix4, mirror: boolean) {
  const g = (src.index ? src.toNonIndexed() : src.clone()) as BufferGeometry;
  for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
  g.applyMatrix4(m);
  if (mirror) flipWinding(g);
  return g;
}

function useHut() {
  const floor = useMerged('hut-floor');
  const wall = useMerged('hut-wall');
  const windowWall = useMerged('hut-wall-window');
  const corner = useMerged('hut-corner-logs');
  const gable = useMerged('hut-gable-half');
  const roof = useMerged('hut-roof-snow');
  const doorGltf = useGLTF(modelUrl('hut-wall-door'), false);
  return useMemo(() => {
    const byModel: Partial<Record<ModelName, BufferGeometry>> = {
      'hut-floor': floor.geometry, 'hut-wall': wall.geometry, 'hut-wall-window': windowWall.geometry,
      'hut-corner-logs': corner.geometry, 'hut-gable-half': gable.geometry, 'hut-roof-snow': roof.geometry,
    };
    const parts = HUT_PARTS.map((part) => prepare(byModel[part.model]!, partMatrix(part.p, part.r, part.mirror), !!part.mirror));
    // The door GLB holds the frame and the leaf ('door'); bake the frame in, keep the leaf apart.
    const root = doorGltf.scene;
    root.updateMatrixWorld(true);
    const rootInv = new Matrix4().copy(root.matrixWorld).invert();
    const wallAt = partMatrix(DOOR_WALL_AT, 0).clone();
    let leaf: BufferGeometry | null = null;
    const leafAt = new Vector3();
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const local = new Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
      if (mesh.name === 'door') {
        leaf = mesh.geometry;
        leafAt.setFromMatrixPosition(local).add(_t.set(...DOOR_WALL_AT));
      } else {
        parts.push(prepare(mesh.geometry, new Matrix4().multiplyMatrices(wallAt, local), false));
      }
    });
    const merged = mergeGeometries(parts, false)!;
    merged.computeBoundingSphere();
    return { geometry: merged, material: floor.material, leaf: leaf as BufferGeometry | null, leafAt };
  }, [floor, wall, windowWall, corner, gable, roof, doorGltf]);
}

function slug(url: string) {
  return url.split('/').filter(Boolean).pop() ?? url;
}

const red = new MeshStandardMaterial({ color: '#d23b3b', roughness: 0.55, emissive: '#d23b3b', emissiveIntensity: 0.08 });
const darkMetal = new MeshStandardMaterial({ color: '#2a2c33', roughness: 0.7 });
const plate = new MeshStandardMaterial({ color: COLORS.paper, roughness: 0.8 });
const glow = new MeshBasicMaterial({ color: '#ffd27a', toneMapped: false });
const LANTERN_SCALE = 0.7;
// The lantern's glass is an octagonal frustum between 1.29 and 1.55 in the model's units, about
// 0.12 to 0.16 across; the glow wraps it slightly.
const LS = modelScale('lamp-post-lantern') * LANTERN_SCALE;
const GLASS = { y: ((1.29 + 1.55) / 2) * LS, h: 0.25 * LS, bottom: 0.13 * LS, top: 0.17 * LS };

const T = (x: number, y: number, z: number, rx = 0) => new Matrix4().compose(_t.set(x, y, z), _q.setFromEuler(_e.set(rx, 0, 0)), _s.set(1, 1, 1));

// Round red pillar box, as on Indian streets: one mesh for the red parts, one for the dark ones.
const BOX_RED = mergeParts([
  { geometry: new CylinderGeometry(0.38, 0.4, 1.24, 20), matrix: T(0, 0.78, 0) },
  { geometry: new SphereGeometry(0.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), matrix: T(0, 1.45, 0) },
]);
const BOX_DARK = mergeParts([
  { geometry: new CylinderGeometry(0.46, 0.5, 0.16, 20), matrix: T(0, 0.08, 0) },
  { geometry: new CylinderGeometry(0.42, 0.42, 0.06, 20), matrix: T(0, 1.42, 0) },
  { geometry: new BoxGeometry(0.36, 0.06, 0.06), matrix: T(0, 1.18, 0.37, -0.08) },
]);

function PillarBox() {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.85, 0.42]} position={[0, 0.85, 0]} />
      </RigidBody>
      <mesh geometry={BOX_RED} material={red} castShadow receiveShadow />
      <mesh geometry={BOX_DARK} material={darkMetal} castShadow receiveShadow />
      <mesh material={plate} position={[0, 0.82, 0.392]}>
        <planeGeometry args={[0.34, 0.24]} />
      </mesh>
    </group>
  );
}

export function ContactPost() {
  const hut = useHut();
  const door = useRef<Group>(null);
  const open = useRef(false);
  const angle = useRef({ value: 0, vel: 0 });
  const [hu, hv] = SPOT.hut;
  const [bu, bv] = SPOT.contactBoard;
  const [mu, mv] = SPOT.mailbox;
  const [lu, lv] = SPOT.lantern;
  const night = useStore((s) => s.night);
  const [pu, pv] = SPOT.contactPad;

  // Spring the door towards open or shut (no spring with reduced motion).
  useFrame((_, delta) => {
    const g = door.current;
    if (!g) return;
    const goal = open.current ? DOOR_OPEN : 0;
    const a = angle.current;
    if (useStore.getState().reducedMotion) {
      a.value = goal;
      a.vel = 0;
    } else {
      const dt = Math.min(delta, 0.05);
      a.vel += ((goal - a.value) * 60 - a.vel * 9) * dt;
      a.value += a.vel * dt;
    }
    g.rotation.y = a.value;
  });

  const lines = [contact.email, `LinkedIn: ${slug(contact.linkedin)}`, `GitHub: ${slug(contact.github)}`];

  return (
    <>
      <group position={hubAt(hu, hv)}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.15 * HUT_SCALE, 0.6 * HUT_SCALE, 1.15 * HUT_SCALE]} position={[0, 0.6 * HUT_SCALE, -0.5 * HUT_SCALE]} />
        </RigidBody>
        <group scale={HUT_SCALE}>
          <mesh geometry={hut.geometry} material={hut.material} castShadow receiveShadow />
          {hut.leaf && (
            <group ref={door} position={hut.leafAt}>
              <mesh geometry={hut.leaf} material={hut.material} castShadow />
            </group>
          )}
        </group>
      </group>
      <group position={hubAt(mu, mv)}>
        <PillarBox />
      </group>
      {/* Light text on a dark face at night: the face is lit, the text is not, so a cream face goes
          grey under the moon while ink text stays dark. */}
      <Board
        title={panels.contact.title}
        lines={lines}
        width={6.8}
        lineSize={0.43}
        titleSize={0.7}
        lift={0.7}
        color={night ? COLORS.ink : COLORS.paper}
        textColor={night ? COLORS.paper : COLORS.ink}
        position={hubAt(bu, bv)}
      />
      <group position={hubAt(lu, lv)}>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[1.8, 0.22]} position={[0, 1.8, 0]} />
        </RigidBody>
        <Model name="lamp-post-lantern" scale={LANTERN_SCALE} />
        {night && (
          <mesh material={glow} position={[0, GLASS.y, 0]}>
            <cylinderGeometry args={[GLASS.top, GLASS.bottom, GLASS.h, 8]} />
          </mesh>
        )}
      </group>
      <Pad
        id="hub-contact"
        label="Open contact details"
        icon="Contact"
        action={{ kind: 'panel', panel: 'contact' }}
        position={hubAt(pu, pv)}
        onEnter={() => {
          open.current = true;
        }}
        onLeave={() => {
          open.current = false;
        }}
      />
    </>
  );
}
