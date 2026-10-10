import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, CatmullRomCurve3, Color, DoubleSide, Euler, Matrix4, PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Board } from '../../components/Board.tsx';
import { Model, modelScale } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { useStore } from '../../state/store.ts';
import { cylinder, mergeParts } from './boxes.ts';
import { rod } from './Easel.tsx';
import { pathLength, sampleAt } from './geometry.ts';
import type { P2 } from './geometry.ts';
import { Y } from './Ground.tsx';
import { InstancedModel } from './Instanced.tsx';
import type { Placement } from './Instanced.tsx';
import { KICKER, TRAIL, TRAIL_WIDTH, TRAILHEAD } from './layout.ts';

// Sign wording from panels.activities: 'Led rides for the Mountain Biking Club (MTB) at IIT Mandi.'
const SIGN = { title: 'Mountain Biking Club', line: 'Led club rides', width: 6.5, lift: 1.2 };
const SIGN_TOP = SIGN.lift + 0.8 + 0.6 * 1.3 + 0.42 * 1.45; // Board height formula

// ramp-kicker is a quarter-pipe end (native x -1..0, lip at z = 0, curve dropping towards +z).
// Two of them back to back make a tabletop: up-ramp, flat top, down-ramp, rideable both ways.
// Colliders are convex hulls: the real curve goes vertical at the top, and the car's overhang
// would hit it before its wheels climb.
function Kicker() {
  const k = modelScale('ramp-kicker');
  const scale: [number, number, number] = [KICKER.width / k, KICKER.height / (0.3 * k), KICKER.curve / (0.3 * k)];
  const half: [number, number, number] = [KICKER.width / 2, 0, 0];
  return (
    <RigidBody type="fixed" colliders="hull" position={[KICKER.x, 0, KICKER.z]} friction={1}>
      <group rotation={[0, Math.PI, 0]}>
        <Model name="ramp-kicker" scale={scale} position={half} />
      </group>
      <Model name="ramp-kicker" scale={scale} position={half} />
    </RigidBody>
  );
}

const LOG = 'log';
const LOG_K = modelScale(LOG);
const LOG_NATIVE_D = 0.249;
const LOG_BOTTOM = 0.106; // native distance from the axis-ish origin to the underside

type LogSpec = { s: number; side: number; length: number; diameter: number; across?: boolean };
// s = arc length along the trail; side = -1/1 for the trail edges, 0 for across the trail.
const LOGS: LogSpec[] = [
  { s: 2.6, side: 0, length: TRAIL_WIDTH + 0.8, diameter: 0.3, across: true },
  { s: 7.5, side: 1, length: 3.2, diameter: 0.52 },
  { s: 13.4, side: -1, length: 2.8, diameter: 0.5 },
  { s: 22.5, side: -1, length: 3.4, diameter: 0.55 },
  { s: 29.2, side: 0, length: TRAIL_WIDTH + 0.8, diameter: 0.3, across: true },
  { s: 33.6, side: 1, length: 3, diameter: 0.5 },
];

const _q = new Quaternion();
const _q2 = new Quaternion();
const _e = new Euler();
const _x = new Vector3(1, 0, 0);
const _yAxis = new Vector3(0, 1, 0);

function Logs() {
  const items = useMemo(() => {
    const total = pathLength(TRAIL);
    return LOGS.map((l) => {
      const { p, t } = sampleAt(TRAIL, Math.min(l.s, total));
      const nx = t[1], nz = -t[0]; // left normal
      const off = l.side * (TRAIL_WIDTH / 2 + 0.55);
      // log long axis is model +Z: along the trail, or across it
      const dir: P2 = l.across ? [nx, nz] : t;
      const ry = Math.atan2(dir[0], dir[1]);
      const sxy = l.diameter / (LOG_NATIVE_D * LOG_K);
      const placement: Placement = { x: p[0] + nx * off, z: p[1] + nz * off, y: LOG_BOTTOM * LOG_K * sxy, ry, sx: sxy, sy: sxy, sz: l.length / LOG_K };
      // Cylinder collider along the log: rotate Y onto the log axis.
      _q.setFromAxisAngle(_x, Math.PI / 2);
      _q2.setFromAxisAngle(_yAxis, ry);
      _e.setFromQuaternion(_q2.multiply(_q), 'XYZ');
      return { placement, length: l.length, radius: l.diameter / 2, rot: [_e.x, _e.y, _e.z] as [number, number, number] };
    });
  }, []);
  return (
    <>
      <InstancedModel name={LOG} items={items.map((i) => i.placement)} />
      <RigidBody type="fixed" colliders={false}>
        {items.map((it, i) => (
          <CylinderCollider key={i} args={[it.length / 2, it.radius]} position={[it.placement.x, it.radius, it.placement.z]} rotation={it.rot} />
        ))}
      </RigidBody>
    </>
  );
}

// A mountain bike from rods and tori (no bicycle model exists in the kits). Side-on to the camera,
// leaning on its kickstand.
function Bike() {
  const geo = useMemo(() => {
    const R = 0.33, tube = 0.05, hub = R + tube;
    const rear: [number, number, number] = [-0.52, hub, 0];
    const front: [number, number, number] = [0.57, hub, 0];
    const bb: [number, number, number] = [0, 0.36, 0];
    const seatTop: [number, number, number] = [-0.12, 0.86, 0];
    const headTop: [number, number, number] = [0.45, 0.93, 0];
    const headLow: [number, number, number] = [0.48, 0.77, 0];
    const frame: BufferGeometry[] = [
      rod(bb, seatTop, 0.03),
      rod([-0.11, 0.82, 0], [0.45, 0.88, 0], 0.028),
      rod(bb, headLow, 0.034),
      rod(headLow, headTop, 0.035),
      ...[-0.05, 0.05].flatMap((z) => [
        rod([bb[0], bb[1], z], [rear[0], rear[1], z], 0.018),
        rod([-0.11, 0.8, z], [rear[0], rear[1], z], 0.017),
        rod([headLow[0], headLow[1], z * 1.3], [front[0], front[1], z * 1.3], 0.022),
      ]),
    ];
    const dark: BufferGeometry[] = [
      ...[rear, front].map((c) => {
        const g = new TorusGeometry(R, tube, 8, 28);
        g.translate(c[0], c[1], c[2]);
        return g;
      }),
      ...[rear, front].map((c) => rod([c[0], c[1], -0.07], [c[0], c[1], 0.07], 0.035, 8)),
      rod([0.43, 0.98, -0.34], [0.43, 0.98, 0.34], 0.022),
      rod(headTop, [0.43, 0.98, 0], 0.024),
      rod([-0.12, 0.86, 0], [-0.14, 0.95, 0], 0.02),
      (() => {
        const g = new BoxGeometry(0.26, 0.06, 0.13);
        g.translate(-0.15, 0.98, 0);
        return g;
      })(),
      rod([-0.09, 0.27, 0.09], [0.09, 0.45, 0.09], 0.018),
      rod([0.09, 0.27, -0.09], [-0.09, 0.45, -0.09], 0.018),
      rod([-0.04, 0.34, 0.05], [-0.2, 0.02, 0.2], 0.014), // kickstand
    ];
    return mergeParts([
      { geo: mergeGeometries(frame.map((g) => g.toNonIndexed())), color: COLORS.accent },
      { geo: mergeGeometries(dark.map((g) => (g.index ? g.toNonIndexed() : g))), color: '#2b2e36' },
    ]);
  }, []);
  return (
    <group position={[TRAILHEAD.bike[0], 0, TRAILHEAD.bike[1]]} rotation={[0.1, 0.12, 0]} scale={1.4}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.1} />
      </mesh>
    </group>
  );
}

type V3 = [number, number, number];
const FLAG_W = 0.46;
const FLAG_H = 0.54;
const _m = new Matrix4();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const _qf = new Quaternion();
const _c = new Color();

// Prayer flags on a sagging string: blue, white, red, green, yellow, repeating.
function FlagString({ a, b, count, sag = 0.7, seed = 0 }: { a: V3; b: V3; count: number; sag?: number; seed?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const quality = useStore((s) => s.quality);
  const still = reducedMotion || quality === 'low';
  const data = useMemo(() => {
    const at = (t: number) => new Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t);
    const pts = Array.from({ length: 13 }, (_, i) => at(i / 12));
    const string = new TubeGeometry(new CatmullRomCurve3(pts), 24, 0.022, 5, false);
    const axis = new Vector3(b[0] - a[0], 0, b[2] - a[2]).normalize();
    const base = new Quaternion().setFromAxisAngle(_yAxis, -Math.atan2(axis.z, axis.x));
    const flags = Array.from({ length: count }, (_, i) => at((i + 0.6) / (count + 0.2)));
    const plane = new PlaneGeometry(FLAG_W, FLAG_H);
    plane.translate(0, -FLAG_H / 2 - 0.02, 0);
    return { string, axis, base, flags, plane };
  }, [a, b, count, sag]);

  const pose = (i: number, angle: number) => {
    _qf.setFromAxisAngle(data.axis, angle).multiply(data.base);
    return _m.compose(_p.copy(data.flags[i]), _qf, _s);
  };

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    data.flags.forEach((_, i) => {
      m.setMatrixAt(i, pose(i, 0.18));
      m.setColorAt(i, _c.set(COLORS.flags[(i + seed) % COLORS.flags.length]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  });

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m || still) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < data.flags.length; i++) m.setMatrixAt(i, pose(i, 0.2 + 0.22 * Math.sin(t * 2.1 + i * 0.85 + seed)));
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={data.string}>
        <meshStandardMaterial color="#e8e1d0" roughness={1} />
      </mesh>
      <instancedMesh ref={mesh} args={[data.plane, undefined, count]} castShadow>
        <meshStandardMaterial side={DoubleSide} roughness={1} />
      </instancedMesh>
    </>
  );
}

// White flag poles with a brass knob on top.
function Poles({ poles }: { poles: V3[] }) {
  const geo = useMemo(() => mergeParts(poles.flatMap(([x, h, z]) => [
    { geo: cylinder(0.06, 0.08, h, 8), color: '#f1ece0', position: [x, h / 2, z] as V3 },
    { geo: new SphereGeometry(0.11, 10, 8), color: '#e2b23a', position: [x, h + 0.08, z] as V3 },
  ])), [poles]);
  return (
    <>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {poles.map(([x, h, z], i) => (
          <CylinderCollider key={i} args={[h / 2, 0.12]} position={[x, h / 2, z]} />
        ))}
      </RigidBody>
    </>
  );
}

const [SX, SZ] = TRAILHEAD.sign;
const L: V3 = [SX - 5.1, 4.5, SZ + 0.5];
const R: V3 = [SX + 6.2, 4.3, SZ + 0.9];
const CORNER_L: V3 = [SX - SIGN.width / 2 + 0.2, SIGN_TOP, SZ];
const CORNER_R: V3 = [SX + SIGN.width / 2 - 0.2, SIGN_TOP, SZ];
const POLES: V3[] = [L, R];

export function Trail() {
  return (
    <group name="campus-trail">
      <Kicker />
      <Logs />
      <Bike />
      <Board
        title={SIGN.title}
        lines={[SIGN.line]}
        width={SIGN.width}
        titleSize={0.6}
        lineSize={0.42}
        accent={COLORS.accent}
        color="#f3e3c4"
        lift={SIGN.lift}
        position={[SX, 0, SZ]}
      />
      <Poles poles={POLES} />
      <FlagString a={L} b={CORNER_L} count={7} sag={0.55} />
      <FlagString a={CORNER_R} b={R} count={9} sag={0.6} seed={2} />
      <Model name="banner-darchog-blue" scale={0.7} position={[-13.6, 0, -8.1]} rotation={[0, 0.3, 0]} />
      <Model name="banner-darchog-red" scale={0.66} position={[-12.4, 0, -7.4]} rotation={[0, -0.2, 0]} />
      <Model name="banner-darchog-green" scale={0.72} position={[-27.9, 0, -2.4]} rotation={[0, 0.5, 0]} />
      <Pad
        id="campus-activities"
        label="Read about clubs and projects at IIT Mandi"
        action={{ kind: 'panel', panel: 'activities' }}
        position={[TRAILHEAD.pad[0], Y.pad, TRAILHEAD.pad[1]]}
        radius={2.2}
        icon="MTB club"
      />
    </group>
  );
}
