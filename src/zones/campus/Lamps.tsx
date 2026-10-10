import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { AdditiveBlending, Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh, Mesh } from 'three';
import { Label } from '../../components/Label.tsx';
import { modelScale } from '../../components/Model.tsx';
import { ZONE_BY_ID } from '../../config/layout.ts';
import { CAMERA, screenToWorld } from '../../config/world.ts';
import { coursework } from '../../data/profile.ts';
import { car } from '../../state/car.ts';
import { events, playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { glowTexture, normals } from './geometry.ts';
import { InstancedModel } from './Instanced.tsx';
import { LAMP_RING } from './layout.ts';

const LAMP = 'lamp-post-lantern';
const LAMP_S = 0.8;
const K = modelScale(LAMP) * LAMP_S; // native -> metres
// The lantern glass, measured from the GLB (native units), slightly enlarged so it covers the glass.
const GLASS = { y0: 1.17, y1: 1.46, hx: 0.125, hz: 0.105 };
const GLASS_Y = ((GLASS.y0 + GLASS.y1) / 2) * K;
const LIGHT_RADIUS = 6; // the car lights a lamp when it passes this close (m)
const HOLD = 9; // seconds a lamp stays lit after the car leaves (daytime)

const [CU, CV] = ZONE_BY_ID.campus.center;

type LampSpot = { x: number; z: number; lx: number; lz: number; course: string };

function lampSpots(): LampSpot[] {
  const ring = LAMP_RING;
  const ns = normals(ring, true);
  const n = ring.length;
  const step = 0.25;
  const perimeter = n * step;
  // Lamps run from low on the right side, over the top, to low on the left side (counter-clockwise),
  // so every label lies in front of or beside its own post, never behind it.
  const from = perimeter - 4.9;
  const span = 4.9 + 27.8;
  const gap = span / (coursework.length - 1);
  return coursework.map((course, i) => {
    const k = Math.round((from + i * gap) / step) % n;
    const [x, z] = ring[k];
    const [nx, nz] = ns[k]; // left of travel = towards the lawn centre
    return { x, z, lx: x + nx * 1.65, lz: z + nz * 1.65, course };
  });
}

const OFF = new Color('#000000');
const WARM = new Color('#ffcf73');
const GLASS_ON = new Color('#fff2c4');
const _c = new Color();
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

const LABEL_OFF = '#2f343d';
const LABEL_ON = '#9a5c00';
const LABEL_NIGHT = '#ffe2a0';

export function Lamps() {
  const spots = useMemo(lampSpots, []);
  const items = useMemo(() => spots.map((s) => ({ x: s.x, z: s.z, s: LAMP_S })), [spots]);
  const glass = useRef<InstancedMesh>(null);
  const halo = useRef<InstancedMesh>(null);
  const pool = useRef<InstancedMesh>(null);
  const labels = useRef<(Mesh & { color?: string })[]>([]);
  const st = useRef({ level: new Float32Array(spots.length), timer: new Float32Array(spots.length), lastShown: new Float32Array(spots.length).fill(-1), celebrated: false, wasNight: false });
  const tex = useMemo(glowTexture, []);
  const night = useStore((s) => s.night);

  useLayoutEffect(() => {
    const h = halo.current;
    const p = pool.current;
    const g = glass.current;
    if (!h || !p || !g) return;
    _q.identity();
    spots.forEach((sp, i) => {
      g.setMatrixAt(i, _m.compose(_p.set(sp.x, GLASS_Y, sp.z), _q, _s.set(0, 0, 0)));
      g.setColorAt(i, GLASS_ON);
      h.setMatrixAt(i, _m.makeRotationX(-CAMERA.elevation).setPosition(sp.x, GLASS_Y, sp.z));
      h.setColorAt(i, OFF);
      p.setMatrixAt(i, _m.makeRotationX(-Math.PI / 2).setPosition(sp.x, 0.07, sp.z));
      p.setColorAt(i, OFF);
    });
    for (const m of [g, h, p]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [spots]);

  useFrame((_, delta) => {
    const s = st.current;
    const g = glass.current;
    const h = halo.current;
    const p = pool.current;
    if (!g || !h || !p) return;
    const dt = Math.min(delta, 0.1);
    const store = useStore.getState();
    const isNight = store.night;
    const playing = store.phase === 'play' && car.ready;
    const lx = car.u - CU;
    const lz = -(car.v - CV);
    let lit = 0;
    let changed = false;
    for (let i = 0; i < spots.length; i++) {
      const sp = spots[i];
      if (playing && Math.hypot(lx - sp.x, lz - sp.z) < LIGHT_RADIUS) {
        if (s.timer[i] <= 0 && !isNight) playSound('click', 0.35);
        s.timer[i] = HOLD;
      } else if (s.timer[i] > 0) s.timer[i] -= dt;
      if (s.timer[i] > 0) lit++;
      const target = isNight || s.timer[i] > 0 ? 1 : 0;
      const rate = target > s.level[i] ? 7 : 1.4;
      s.level[i] += Math.max(-rate * dt, Math.min(rate * dt, target - s.level[i]));
      const lv = s.level[i];
      // Quantise so instance buffers only re-upload while a lamp is fading.
      const shown = Math.round(lv * 40) / 40;
      if (shown === s.lastShown[i] && isNight === s.wasNight) continue;
      s.lastShown[i] = shown;
      changed = true;
      const glow = isNight ? 1 : 0.42;
      const pop = shown > 0 ? 1 + 0.18 * Math.sin(Math.min(1, shown) * Math.PI) : 0;
      g.setMatrixAt(i, _m.compose(_p.set(sp.x, GLASS_Y, sp.z), _q.identity(), _s.set(GLASS.hx * 2 * K * pop, (GLASS.y1 - GLASS.y0) * K * pop, GLASS.hz * 2 * K * pop)));
      h.setColorAt(i, _c.copy(WARM).multiplyScalar(shown * glow));
      p.setColorAt(i, _c.copy(WARM).multiplyScalar(shown * (isNight ? 0.6 : 0.17)));
      const label = labels.current[i];
      if (label) label.color = isNight ? LABEL_NIGHT : shown > 0.5 ? LABEL_ON : LABEL_OFF;
    }
    s.wasNight = isNight;
    if (changed) {
      g.instanceMatrix.needsUpdate = true;
      if (h.instanceColor) h.instanceColor.needsUpdate = true;
      if (p.instanceColor) p.instanceColor.needsUpdate = true;
    }
    if (!isNight && lit === spots.length && !s.celebrated) {
      s.celebrated = true;
      const [wx, wz] = screenToWorld(CU, CV);
      store.toast(`All ${spots.length} coursework lamps lit`, 'win');
      playSound('win');
      events.emit('confetti', { x: wx, y: 1, z: wz, count: 70 });
    } else if (lit === 0) s.celebrated = false;
  });

  return (
    <group name="campus-lamps">
      <InstancedModel name={LAMP} items={items} />
      <RigidBody type="fixed" colliders={false}>
        {spots.map((sp, i) => (
          <CylinderCollider key={i} args={[2, 0.22]} position={[sp.x, 2, sp.z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={glass} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshBasicMaterial map={tex} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pool} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial map={tex} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {spots.map((sp, i) => (
        <Label
          key={sp.course}
          ref={(el: Mesh | null) => {
            if (el) labels.current[i] = el;
          }}
          flat
          font="bodyBold"
          size={0.43}
          maxWidth={3.1}
          textAlign="center"
          lineHeight={1.05}
          color={night ? LABEL_NIGHT : LABEL_OFF}
          outlineWidth={night ? 0.045 : 0}
          outlineColor="#2a2312"
          position={[sp.lx, 0.06, sp.lz]}
        >
          {sp.course}
        </Label>
      ))}
    </group>
  );
}

