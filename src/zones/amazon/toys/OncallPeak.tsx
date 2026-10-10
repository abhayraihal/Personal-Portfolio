import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedBufferAttribute, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { Group, InstancedMesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { playSound } from '../../../state/events.ts';
import { useStore } from '../../../state/store.ts';
import { TOY_TEXT } from '../copy.ts';
import { M } from '../materials.ts';
import { Static } from '../merge.tsx';
import { StationBoard } from '../parts.tsx';
import { fixBounds, frameDt, seg } from '../shared.ts';
import type { ToyProps, ToySpec } from '../Station.tsx';

// Peak-season banners and a ring of 30 beacons. Each beacon flashes red like a page coming in,
// then turns green once it is handled, one after another around the ring.

const RING = { x: -1.0, z: 0.95, r: 1.9 };
const N = 30;
const T0 = 0.3;
const GAP = 0.15;
const RED_FOR = 0.5;
const T_DONE = T0 + (N - 1) * GAP + RED_FOR;

const DIM = new Color('#2c4a3a');
const RED = new Color('#ff3b3b');
const GREEN = new Color('#3ee07a');
const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _c = new Color();

const BANNERS = [
  { color: COLORS.ink, text: '#ff9900', h: 0.98, y: 3.1 },
  { color: '#5b4bdb', text: '#ffffff', h: 0.62, y: 2.22 },
  { color: '#1f8fd6', text: '#ffffff', h: 0.62, y: 1.5 },
];
const BANNER_X = 2.95;
const BANNER_Z = -1.85;

function Banners() {
  const group = useRef<Group>(null);
  const mats = useMemo(() => BANNERS.map((b) => new MeshStandardMaterial({ color: b.color, roughness: 0.85 })), []);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || useStore.getState().reducedMotion) return;
    g.children.forEach((c, i) => {
      if (c.userData.banner) c.rotation.z = Math.sin(clock.elapsedTime * 1.3 + i * 1.9) * 0.025;
    });
  });
  return (
    <group ref={group} position={[BANNER_X, 0, BANNER_Z]}>
      <Static>
        <mesh position={[0, 1.95, -0.1]} material={M.slate}>
          <boxGeometry args={[0.13, 3.9, 0.13]} />
        </mesh>
        <mesh position={[0, 3.95, -0.1]} material={M.orange}>
          <sphereGeometry args={[0.11, 12, 8]} />
        </mesh>
      </Static>
      {BANNERS.map((b, i) => (
        <group key={i} position={[0, b.y, 0]} userData={{ banner: true }}>
          <mesh position={[0, 0, 0]} material={mats[i]} castShadow>
            <boxGeometry args={[2.6, b.h, 0.06]} />
          </mesh>
          <Label font="bodyBold" size={0.3} color={b.text} lineHeight={0.38 / 0.3} textAlign="center" position={[0, 0, 0.035]}>
            {TOY_TEXT.peaks[i].join('\n')}
          </Label>
        </group>
      ))}
    </group>
  );
}

function OncallPeakToy({ clock }: ToyProps) {
  const bases = useRef<InstancedMesh>(null);
  const domes = useRef<InstancedMesh>(null);
  const count = useRef<Group>(null);
  const fired = useRef(0);
  const domeMat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => () => domeMat.dispose(), [domeMat]);
  const spots = useMemo(() => Array.from({ length: N }, (_, k) => {
    const a = Math.PI / 2 - (k / N) * Math.PI * 2; // clockwise from the back of the ring
    return { x: RING.x + Math.cos(a) * RING.r, z: RING.z - Math.sin(a) * RING.r };
  }), []);

  useLayoutEffect(() => {
    const b = bases.current;
    const d = domes.current;
    if (!b || !d) return;
    d.instanceColor = new InstancedBufferAttribute(new Float32Array(N * 3), 3);
    _q.identity();
    spots.forEach((s, i) => {
      b.setMatrixAt(i, _m.compose(_p.set(s.x, 0.11, s.z), _q, _s.set(1, 1, 1)));
      d.setMatrixAt(i, _m.compose(_p.set(s.x, 0.34, s.z), _q, _s.set(1, 1, 1)));
      d.setColorAt(i, DIM);
    });
    b.instanceMatrix.needsUpdate = true;
    d.instanceMatrix.needsUpdate = true;
    b.computeBoundingSphere();
    fixBounds(d, RING.r + 0.6, RING.x, 0.3, RING.z);
  }, [spots]);

  useFrame((state, delta) => {
    const dt = frameDt(delta);
    clock.step(dt);
    const t = clock.time;
    const phase = clock.phase;
    const d = domes.current;
    if (!d) return;
    if (phase === 'idle') fired.current = 0;
    const reduced = useStore.getState().reducedMotion;
    // Idle: now and then one beacon blinks, a quiet day on call.
    const now = state.clock.elapsedTime;
    const idleBlink = phase === 'idle' && !reduced && now % 2.2 < 0.28 ? Math.floor(now / 2.2) * 7 % N : -1;
    for (let i = 0; i < N; i++) {
      const ti = T0 + i * GAP;
      let red = 0;
      let green = 0;
      let pop = 1;
      if (phase === 'play' || phase === 'hold') {
        red = seg(t, ti, ti + 0.06) * (1 - seg(t, ti + RED_FOR, ti + RED_FOR + 0.12));
        green = seg(t, ti + RED_FOR, ti + RED_FOR + 0.12);
        pop = 1 + 0.35 * Math.sin(Math.PI * seg(t, ti, ti + 0.3));
      } else if (phase === 'rewind') {
        green = 1 - seg(clock.r, i / N / 2, i / N / 2 + 0.5);
      } else if (i === idleBlink) red = 1;
      _c.copy(DIM).lerp(GREEN, green).lerp(RED, red);
      d.setColorAt(i, _c);
      const s = spots[i];
      d.setMatrixAt(i, _m.compose(_p.set(s.x, 0.34, s.z), _q.identity(), _s.setScalar(pop)));
    }
    d.instanceMatrix.needsUpdate = true;
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
    // One alert sound every few beacons keeps it from turning into noise.
    if (phase === 'play') {
      const lit = Math.min(N, Math.floor((t - T0) / GAP) + 1);
      if (lit > fired.current && lit % 5 === 1) playSound('click', 0.35);
      fired.current = Math.max(fired.current, lit);
    }
    const c = count.current;
    if (c) {
      const k = phase === 'play' || phase === 'hold' ? Math.sin(Math.PI * seg(t, T_DONE, T_DONE + 0.5)) : 0;
      c.scale.setScalar(1 + 0.12 * k);
    }
  });

  return (
    <>
      <StationBoard id="amazon-oncall" position={[-1.6, 0, -2.4]} width={5.2} />
      <Banners />
      <Static>
        <mesh position={[RING.x, 0.02, RING.z]} rotation={[-Math.PI / 2, 0, 0]} material={M.stoneDark} receiveShadow>
          <ringGeometry args={[RING.r - 0.3, RING.r + 0.3, 48]} />
        </mesh>
      </Static>
      <instancedMesh ref={bases} args={[undefined, M.slate, N]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.22, 10]} />
      </instancedMesh>
      <instancedMesh ref={domes} args={[undefined, domeMat, N]}>
        <sphereGeometry args={[0.17, 12, 8]} />
      </instancedMesh>
      {/* Count in the middle of the ring: "30+ high-severity tickets" */}
      <group position={[RING.x, 0, RING.z]}>
        <Static>
          {[-1.35, 1.35].map((x) => (
            <mesh key={x} position={[x, 0.15, -0.05]} material={M.slate}>
              <boxGeometry args={[0.08, 0.3, 0.08]} />
            </mesh>
          ))}
        </Static>
        <group ref={count} position={[0, 0.95, 0]}>
          <mesh position={[0, 0, -0.05]} material={M.paper}>
            <boxGeometry args={[3.3, 1.3, 0.1]} />
          </mesh>
          <Label font="display" size={0.8} color={COLORS.amazon} position={[0, 0.2, 0.005]}>
            {TOY_TEXT.tickets[0]}
          </Label>
          <Label font="bodyBold" size={0.27} color={COLORS.ink} position={[0, -0.38, 0.005]}>
            {TOY_TEXT.tickets[1]}
          </Label>
        </group>
      </group>
    </>
  );
}

export const oncallPeakToy: ToySpec = { Component: OncallPeakToy, length: T_DONE + 0.8 };
