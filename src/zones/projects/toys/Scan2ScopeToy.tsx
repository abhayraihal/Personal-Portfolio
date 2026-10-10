import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, CanvasTexture, DoubleSide, Matrix4, PlaneGeometry, Quaternion, Shape, ShapeGeometry, Vector3 } from 'three';
import type { InstancedMesh, Mesh, MeshBasicMaterial } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { useStore } from '../../../state/store.ts';
import { carNearZone, worldX, worldZ } from '../frame.ts';
import { mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';
import { scanSignal } from './signals.ts';

// A toy house on a model base. Parking on the scan2scope pad lowers a scan sheet over it, then a
// pen draws the house's floor plan on the ground in front of it. The plan is the toy's own room
// layout, so it is labelled as an illustration.

type Seg = { ax: number; az: number; bx: number; bz: number };

const HX = 1.8;
const HZ = 1.4;
// Drawn in this order: the outside walls as one stroke from the front door, then the inner walls.
const WALLS: Seg[] = [
  { ax: -1.2, az: HZ, bx: -HX, bz: HZ },
  { ax: -HX, az: HZ, bx: -HX, bz: -HZ },
  { ax: -HX, az: -HZ, bx: HX, bz: -HZ },
  { ax: HX, az: -HZ, bx: HX, bz: HZ },
  { ax: HX, az: HZ, bx: -0.4, bz: HZ },
  { ax: 0.4, az: -HZ, bx: 0.4, bz: -0.2 },
  { ax: 0.4, az: 0.6, bx: 0.4, bz: HZ },
  { ax: 0.4, az: 0, bx: 1.0, bz: 0 },
  { ax: 1.6, az: 0, bx: HX, bz: 0 },
];
// Door swings (ring angles: angle a points along (cos a, -sin a) in x, z).
const DOORS = [
  { x: -0.4, z: HZ, r: 0.8, a0: Math.PI / 2 },
  { x: 0.4, z: -0.2, r: 0.8, a0: -Math.PI / 2 },
  { x: 1.0, z: 0, r: 0.6, a0: 0 },
];
const ROOMS = [
  { x0: -HX, z0: -HZ, x1: 0.4, z1: HZ, color: '#f6e3b4' },
  { x0: 0.4, z0: -HZ, x1: HX, z1: 0, color: '#d3e1f2' },
  { x0: 0.4, z0: 0, x1: HX, z1: HZ, color: '#e3d9f0' },
];

const BASE_H = 0.28;
const PLAN_SCALE = 1.2;
const PLAN_Z = 5.7; // plan centre, in front of the house
const PLAN_Y = 0.024;
const WALL_T = 0.14;
const SCAN_S = 2.0; // sheet comes down
const DRAW_START = 0.5;
const DRAW_S = 3.0;
const FILL_S = 0.7;
const TOTAL = DRAW_START + DRAW_S + FILL_S;
const HOLD_S = 7; // the plan stays this long after the car leaves the pad
const SHEET_TOP = 3.7;
const CAMERA_ID = 'projects-scan2scope';
const SHEET_BOTTOM = BASE_H + 0.05;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

function sheetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let y = 8; y < 128; y += 16) g.fillRect(0, y, 128, 3);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  g.strokeRect(4, 4, 120, 120);
  return new CanvasTexture(c);
}

const flat = (w: number, d: number) => new PlaneGeometry(w, d).rotateX(-Math.PI / 2);

// The toy house on its plinth, as one vertex-coloured mesh.
function houseGeometry() {
  const gable = new Shape();
  gable.moveTo(-HZ - 0.08, 0);
  gable.lineTo(HZ + 0.08, 0);
  gable.lineTo(0, 1.05);
  gable.closePath();
  const wallH = 1.5;
  const top = BASE_H + wallH;
  // Roof slabs rest on the gable edges and overhang the eaves.
  const half = HZ + 0.08;
  const rise = 1.05;
  const slope = Math.atan2(rise, half);
  const edge = Math.hypot(rise, half);
  const T = 0.16;
  const over = 0.4;
  const glass = '#9fd3e6';
  const parts: Part[] = [
    { g: new BoxGeometry(HX * 2 + 1.3, BASE_H, HZ * 2 + 1.3), color: '#b98a5e', at: [0, BASE_H / 2, 0] },
    { g: flat(HX * 2 + 1.1, HZ * 2 + 1.1), color: '#8fbf6a', at: [0, BASE_H + 0.006, 0] },
    { g: flat(0.6, 0.62), color: '#e9dcc4', at: [-0.8, BASE_H + 0.012, HZ + 0.3] },
    { g: new BoxGeometry(HX * 2, wallH, HZ * 2), color: COLORS.paper, at: [0, BASE_H + wallH / 2, 0] },
    ...[-1, 1].map((side): Part => ({ g: new ShapeGeometry(gable), color: COLORS.paperShade, at: [side * HX, top, 0], rot: [0, (side * Math.PI) / 2, 0] })),
    ...[-1, 1].map((side): Part => ({
      g: new BoxGeometry(HX * 2 + 0.5, T, edge + over),
      color: COLORS.accent,
      at: [0, top + rise / 2 + (T / 2) * Math.cos(slope) - (over / 2) * Math.sin(slope), side * (half / 2 + (T / 2) * Math.sin(slope) + (over / 2) * Math.cos(slope))],
      rot: [side * slope, 0, 0],
    })),
    { g: new BoxGeometry(0.36, 0.9, 0.36), color: COLORS.accentDark, at: [1.0, top + 0.75, -0.45] },
    { g: new PlaneGeometry(0.7, 1.16), color: '#9a6b45', at: [-0.8, BASE_H + 0.58, HZ + 0.005] },
    { g: new PlaneGeometry(0.42, 0.5), color: glass, at: [0.75, BASE_H + 0.95, HZ + 0.005] },
    { g: new PlaneGeometry(0.42, 0.5), color: glass, at: [1.35, BASE_H + 0.95, HZ + 0.005] },
    { g: new PlaneGeometry(0.8, 0.5), color: glass, at: [HX + 0.005, BASE_H + 0.95, 0.5], rot: [0, Math.PI / 2, 0] },
  ];
  return mergeParts(parts);
}

function House() {
  const geometry = useMemo(houseGeometry, []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[HX + 0.65, 1.45, HZ + 0.65]} position={[0, 1.45, 0]} />
      </RigidBody>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
    </group>
  );
}

export function Scan2ScopeToy({ position, pad }: { position: [number, number, number]; pad: [number, number] }) {
  // camera target while parked: between the pad and the house with its plan
  const VIEW: [number, number] = [(pad[0] + position[0]) / 2, (pad[1] + position[2] + PLAN_Z / 2) / 2];
  const walls = useRef<InstancedMesh>(null);
  const ghost = useRef<InstancedMesh>(null);
  const sheet = useRef<Mesh>(null);
  const pen = useRef<Mesh>(null);
  const fills = useRef<MeshBasicMaterial[]>([]);
  const arcs = useRef<MeshBasicMaterial[]>([]);
  const sheetMap = useMemo(sheetTexture, []);
  const quad = useMemo(() => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const st = useRef({ t: -1, fade: 0, wasParked: false, drawn: 0 });

  const segs = useMemo(() => {
    let acc = 0;
    const out = WALLS.map((w) => {
      const dx = w.bx - w.ax;
      const dz = w.bz - w.az;
      const len = Math.hypot(dx, dz);
      const s = { ...w, len, ux: dx / len, uz: dz / len, start: acc };
      acc += len;
      return s;
    });
    return { list: out, total: acc };
  }, []);

  // Writes segment transforms for a drawn length `upTo` (metres of wall, in house units) and
  // returns the pen tip position in plan coordinates.
  const writeWalls = (mesh: InstancedMesh | null, upTo: number, tip?: Vector3) => {
    if (!mesh) return;
    for (let i = 0; i < segs.list.length; i++) {
      const s = segs.list[i];
      const p = Math.min(1, Math.max(0, (upTo - s.start) / s.len));
      const ox = s.ax - s.ux * (WALL_T / 2);
      const oz = s.az - s.uz * (WALL_T / 2);
      const L = (s.len + WALL_T) * p;
      _p.set((ox + s.ux * (L / 2)) * PLAN_SCALE, 0, (oz + s.uz * (L / 2)) * PLAN_SCALE + PLAN_Z);
      _q.setFromAxisAngle(_up, Math.atan2(-s.uz, s.ux));
      _s.set(Math.max(L, 0.0001) * PLAN_SCALE, 1, WALL_T * PLAN_SCALE);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      if (tip && p > 0 && p < 1) tip.set((ox + s.ux * L) * PLAN_SCALE, PLAN_Y + 0.05, (oz + s.uz * L) * PLAN_SCALE + PLAN_Z);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    writeWalls(walls.current, 0);
    writeWalls(ghost.current, segs.total + 1);
    return () => useStore.getState().clearCameraOverride(CAMERA_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const s = st.current;
    const dt = Math.min(delta, 0.1);
    const parked = scanSignal.parked;
    if (parked !== s.wasParked) {
      const store = useStore.getState();
      if (parked) {
        s.t = store.reducedMotion ? TOTAL : 0;
        s.fade = 1;
        // Frame the house, its plan and the bay together while parked. Narrow screens step back.
        if (!store.reducedMotion) {
          const narrow = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
          store.setCameraOverride({ id: CAMERA_ID, target: [worldX(VIEW[0], VIEW[1]), 1, worldZ(VIEW[0], VIEW[1])], distance: narrow ? 40 : undefined, blend: 1.2 });
        }
      } else store.clearCameraOverride(CAMERA_ID);
    }
    s.wasParked = parked;
    if (s.t < 0 || !carNearZone()) return;

    s.t = Math.min(s.t + dt, TOTAL + 100);
    const scanK = Math.min(s.t / SCAN_S, 1);
    if (sheet.current) {
      sheet.current.visible = scanK < 1;
      sheet.current.position.y = SHEET_TOP + (SHEET_BOTTOM - SHEET_TOP) * (scanK * scanK * (3 - 2 * scanK));
      (sheet.current.material as MeshBasicMaterial).opacity = Math.min(1, Math.sin(scanK * Math.PI) * 1.6);
    }
    const drawK = Math.min(Math.max((s.t - DRAW_START) / DRAW_S, 0), 1);
    if (drawK !== s.drawn) {
      s.drawn = drawK;
      writeWalls(walls.current, drawK * segs.total, pen.current?.position);
      if (pen.current) pen.current.visible = drawK > 0 && drawK < 1;
    }

    if (!parked && performance.now() / 1000 - scanSignal.changedAt > HOLD_S) s.fade = Math.max(0, s.fade - dt / 1.2);
    const fillK = Math.min(Math.max((s.t - DRAW_START - DRAW_S) / FILL_S, 0), 1) * s.fade;
    for (const f of fills.current) if (f) f.opacity = fillK * 0.92;
    for (const a of arcs.current) if (a) a.opacity = fillK;
    if (walls.current) (walls.current.material as MeshBasicMaterial).opacity = s.fade;
    if (s.fade <= 0) {
      s.t = -1;
      s.drawn = 0;
      writeWalls(walls.current, 0);
      if (walls.current) (walls.current.material as MeshBasicMaterial).opacity = 1;
    }
  });

  return (
    <group position={position}>
      <House />
      <mesh ref={sheet} visible={false} position={[0, SHEET_TOP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HX * 2 + 1.6, HZ * 2 + 1.6]} />
        <meshBasicMaterial color="#2fc6f0" map={sheetMap} transparent opacity={0} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      {/* floor plan: faint guide, rooms, door swings, drawn walls and the pen tip */}
      <instancedMesh ref={ghost} args={[undefined, undefined, WALLS.length]} position={[0, PLAN_Y - 0.002, 0]} frustumCulled={false}>
        <primitive object={quad} attach="geometry" />
        <meshBasicMaterial color={COLORS.ink} transparent opacity={0.12} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {ROOMS.map((r, i) => (
        <mesh key={i} position={[((r.x0 + r.x1) / 2) * PLAN_SCALE, PLAN_Y, ((r.z0 + r.z1) / 2) * PLAN_SCALE + PLAN_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[(r.x1 - r.x0) * PLAN_SCALE, (r.z1 - r.z0) * PLAN_SCALE]} />
          <meshBasicMaterial ref={(m) => void (fills.current[i] = m!)} color={r.color} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {DOORS.map((d, i) => (
        <mesh key={i} position={[d.x * PLAN_SCALE, PLAN_Y + 0.002, d.z * PLAN_SCALE + PLAN_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[d.r * PLAN_SCALE - 0.035, d.r * PLAN_SCALE, 20, 1, d.a0, Math.PI / 2]} />
          <meshBasicMaterial ref={(m) => void (arcs.current[i] = m!)} color={COLORS.inkSoft} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <instancedMesh ref={walls} args={[undefined, undefined, WALLS.length]} position={[0, PLAN_Y + 0.004, 0]} frustumCulled={false}>
        <primitive object={quad} attach="geometry" />
        <meshBasicMaterial color={COLORS.ink} transparent toneMapped={false} />
      </instancedMesh>
      <mesh ref={pen} visible={false} position={[0, PLAN_Y + 0.05, 0]}>
        <sphereGeometry args={[0.16, 12, 8]} />
        <meshBasicMaterial color="#5fdcff" toneMapped={false} />
      </mesh>
      <Label flat size={0.42} color={COLORS.inkSoft} anchorX="left" position={[-HX * PLAN_SCALE, PLAN_Y + 0.01, PLAN_Z + HZ * PLAN_SCALE + 0.55]}>
        illustration
      </Label>
    </group>
  );
}
