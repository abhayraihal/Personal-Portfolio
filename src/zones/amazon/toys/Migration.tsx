import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Euler, InstancedBufferAttribute, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { Group, InstancedMesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { modelScale, useMerged } from '../../../components/Model.tsx';
import { COLORS } from '../../../config/palette.ts';
import { playSound } from '../../../state/events.ts';
import { TOY_TEXT } from '../copy.ts';
import { M } from '../materials.ts';
import { Plaque, StationBoard } from '../parts.tsx';
import { useBoxes } from '../geo.ts';
import type { BoxSpec } from '../geo.ts';
import { easeInCubic, easeInOutCubic, easeOutBack, fixBounds, frameDt, seg } from '../shared.ts';
import type { ToyProps, ToySpec } from '../Station.tsx';

// Four country lanes between the old Dublin rack (left) and the new regions rack (right).
// Shadow copies of the traffic cross first, then the real cars move lane by lane, then the old
// rack sinks into the platform and leaves "Dublin: 0 hosts".

const LANE_Z = [2.2, 1.2, 0.2, -0.8];
const LANE_X0 = -2.75;
const LANE_X1 = 2.75;
const LANE_W = 0.82;
const LANE_COLORS = ['#c60b1e', '#0055a4', '#012169', '#009246'];
const RACK_X = 3.6;
const CRATE_S = 0.42; // crate-wood-banded, 0.5 m
const CRATE = 0.504;
const OLD_SLOTS = [-2.12, -1.05];
const NEW_SLOTS = [1.05, 2.12];
const CAR_S = 0.24; // pickup, 1.06 m long
const CARS = LANE_Z.length * OLD_SLOTS.length;

const T_GHOST = 0.5;
const T_GREEN = 2.9;
const T_REAL = 3.6;
const DRIVE = 1.6;
const T_OFF = 6.9;
const T_SINK = 7.05;
const T_LABEL = 8.0;
const SINK = 1.25;

const OFF = new Color('#3a4252');
const GREEN = new Color('#3ee07a');
const AMBER = new Color('#ffb020');
const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();
const _c = new Color();

const carIndex = (lane: number, slot: number) => lane * OLD_SLOTS.length + slot;

const LANES: BoxSpec[] = LANE_Z.map((z): BoxSpec => [LANE_X1 - LANE_X0, 0.04, LANE_W, (LANE_X0 + LANE_X1) / 2, 0.02, z]);
const FOOT_Z = (LANE_Z[0] + LANE_Z[3]) / 2;
const FOOTPRINT: BoxSpec[] = [
  [0.06, 0.02, 3.6, -0.36, 0, 0],
  [0.06, 0.02, 3.6, 0.36, 0, 0],
  [0.78, 0.02, 0.06, 0, 0, -1.8],
  [0.78, 0.02, 0.06, 0, 0, 1.8],
];
const STRIPE_COLORS = LANE_COLORS.map((c) => new Color(c));

function MigrationToy({ clock }: ToyProps) {
  const crateGeo = useMerged('crate-wood-banded');
  const carGeo = useMerged('vehicle-alt-pickup-truck');
  const crates = useRef<InstancedMesh>(null); // 0..7 old rack, 8..15 new rack
  const lights = useRef<InstancedMesh>(null);
  const cars = useRef<InstancedMesh>(null);
  const ghosts = useRef<InstancedMesh>(null);
  const oldHeader = useRef<Group>(null);
  const dublin = useRef<Group>(null);
  const footprint = useRef<Group>(null);
  const fired = useRef({ shift: false, sink: false });
  const ghostMat = useMemo(() => new MeshBasicMaterial({ color: '#d9f3ff', transparent: true, opacity: 0.45, depthWrite: false }), []);
  const lightMat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => () => {
    ghostMat.dispose();
    lightMat.dispose();
  }, [ghostMat, lightMat]);
  const lanes = useBoxes(LANES);
  const foot = useBoxes(FOOTPRINT);
  const stripes = useRef<InstancedMesh>(null);
  const crateScale = modelScale('crate-wood-banded') * CRATE_S;
  const carScale = modelScale('vehicle-alt-pickup-truck') * CAR_S;

  useLayoutEffect(() => {
    const l = lights.current;
    if (l && !l.instanceColor) l.instanceColor = new InstancedBufferAttribute(new Float32Array(16 * 3), 3);
    for (const m of [crates.current, lights.current, cars.current, ghosts.current]) fixBounds(m, 6);
    const st = stripes.current;
    if (st) {
      _q.identity();
      LANE_Z.forEach((z, i) => {
        st.setMatrixAt(i, _m.compose(_p.set(LANE_X0 + 0.14, 0.045, z), _q, _s.set(1, 1, 1)));
        st.setColorAt(i, STRIPE_COLORS[i]);
      });
      st.instanceMatrix.needsUpdate = true;
      st.computeBoundingSphere();
    }
  }, []);

  useFrame((state, delta) => {
    const dt = frameDt(delta);
    clock.step(dt);
    const t = clock.time;
    const phase = clock.phase;
    const rw = phase === 'rewind' ? 1 - clock.r : 1; // rewind blend
    if (phase === 'idle') {
      fired.current.shift = false;
      fired.current.sink = false;
    }

    // Old rack sinks after the traffic has gone; shudders first.
    const sink = phase === 'idle' ? 0 : easeInCubic(seg(t, T_SINK, T_SINK + 0.95)) * rw;
    const shake = phase === 'play' ? Math.sin(t * 60) * 0.025 * seg(t, T_OFF, T_OFF + 0.1) * (1 - seg(t, T_SINK, T_SINK + 0.2)) : 0;
    if (phase === 'play' && t >= T_SINK && !fired.current.sink) {
      fired.current.sink = true;
      playSound('whoosh', 0.5);
    }
    const c = crates.current;
    const l = lights.current;
    if (c && l) {
      for (let side = 0; side < 2; side++) {
        for (let lane = 0; lane < 4; lane++) {
          for (let h = 0; h < 2; h++) {
            const i = side * 8 + lane * 2 + h;
            const x = (side ? RACK_X : -RACK_X) + (side ? 0 : shake);
            const y = h * CRATE - (side ? 0 : sink * SINK * 2);
            _p.set(x, y, LANE_Z[lane]);
            _q.identity();
            c.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(crateScale)));
            _p.set(x + 0.13, y + CRATE * 0.72, LANE_Z[lane] + CRATE / 2 + 0.01);
            l.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1)));
            // Old hosts green until they are switched off; new hosts amber blink, then green.
            if (side === 0) {
              const off = phase === 'idle' ? 0 : seg(t, T_OFF, T_OFF + 0.2) * rw;
              _c.copy(GREEN).lerp(OFF, off);
            } else if (phase === 'idle') {
              _c.copy(OFF);
            } else {
              const warm = seg(t, 0, 0.3);
              const blink = t < T_GREEN ? (Math.sin(t * 14 + i) > 0 ? 1 : 0.35) : 1;
              _c.copy(OFF).lerp(AMBER, warm * blink).lerp(GREEN, seg(t, T_GREEN, T_GREEN + 0.25));
              _c.lerp(OFF, 1 - rw);
            }
            l.setColorAt(i, _c);
          }
        }
      }
      c.instanceMatrix.needsUpdate = true;
      l.instanceMatrix.needsUpdate = true;
      if (l.instanceColor) l.instanceColor.needsUpdate = true;
    }

    // Real cars: lane by lane, front car first; rewind slides them back.
    const k = cars.current;
    const g = ghosts.current;
    if (k && g) {
      let ghostsVisible = false;
      for (let lane = 0; lane < 4; lane++) {
        for (let slot = 0; slot < 2; slot++) {
          const i = carIndex(lane, slot);
          const from = OLD_SLOTS[slot];
          const to = NEW_SLOTS[slot];
          const t0 = T_REAL + lane * 0.6 + (1 - slot) * 0.22;
          const m = phase === 'idle' ? 0 : easeInOutCubic(seg(t, t0, t0 + DRIVE)) * rw;
          const hop = phase === 'play' ? Math.sin(Math.PI * seg(t, t0, t0 + DRIVE)) * 0.08 : 0;
          const idleBob = phase === 'idle' ? Math.abs(Math.sin(state.clock.elapsedTime * 7 + i * 1.7)) * 0.012 : 0;
          _p.set(from + (to - from) * m, 0.04 + hop + idleBob, LANE_Z[lane]);
          _q.setFromEuler(_e.set(-hop * 0.8, Math.PI / 2, 0, 'YXZ'));
          k.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(carScale)));

          // Ghosts: split off the parked cars and cross ahead of the real traffic.
          const g0 = T_GHOST + lane * 0.18 + (1 - slot) * 0.25;
          const gk = phase === 'play' ? seg(t, g0, g0 + 1.5) : 0;
          const show = gk > 0 && gk < 1;
          ghostsVisible ||= show;
          _p.set(from + (to - from) * easeInOutCubic(gk), 0.05, LANE_Z[lane]);
          _q.setFromEuler(_e.set(0, Math.PI / 2, 0, 'YXZ'));
          g.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(show ? carScale * 1.02 : 0)));
        }
      }
      k.instanceMatrix.needsUpdate = true;
      g.instanceMatrix.needsUpdate = true;
      g.visible = ghostsVisible;
      ghostMat.opacity = 0.5;
      if (phase === 'play' && t >= T_REAL && !fired.current.shift) {
        fired.current.shift = true;
        playSound('whoosh', 0.35);
      }
    }

    const oh = oldHeader.current;
    if (oh) oh.position.y = 1.38 - sink * SINK * 2;
    const dl = dublin.current;
    if (dl) {
      const s = phase === 'idle' ? 0 : easeOutBack(seg(t, T_LABEL, T_LABEL + 0.4)) * rw;
      dl.scale.setScalar(Math.max(0.0001, s));
      dl.visible = s > 0.001;
    }
    const fp = footprint.current;
    if (fp) fp.visible = phase !== 'idle' && sink > 0.98;
  });

  return (
    <>
      <StationBoard id="amazon-migration" position={[0, 0, -2.6]} width={7.0} />
      <mesh geometry={lanes} material={M.slate} receiveShadow />
      <instancedMesh ref={stripes} args={[undefined, M.white, 4]}>
        <boxGeometry args={[0.24, 0.012, LANE_W]} />
      </instancedMesh>
      {LANE_Z.map((z, i) => (
        <Label key={z} flat font="bodyBold" size={0.3} color="#ffffff" position={[0, 0.05, z]}>
          {TOY_TEXT.countries[i]}
        </Label>
      ))}
      <instancedMesh ref={crates} args={[crateGeo.geometry, crateGeo.material, 16]} castShadow receiveShadow />
      <instancedMesh ref={lights} args={[undefined, lightMat, 16]}>
        <boxGeometry args={[0.13, 0.09, 0.02]} />
      </instancedMesh>
      <instancedMesh ref={cars} args={[carGeo.geometry, carGeo.material, CARS]} castShadow />
      <instancedMesh ref={ghosts} args={[carGeo.geometry, ghostMat, CARS]} visible={false} />

      {/* Rack headers on posts behind the stacks. The old one sinks with its rack. */}
      <group ref={oldHeader} position={[-RACK_X, 1.38, -1.45]}>
        <Plaque text={TOY_TEXT.oldRegion} size={0.28} material={M.paper} />
        <mesh position={[0, -0.72, -0.06]} material={M.slate}>
          <boxGeometry args={[0.08, 1.16, 0.08]} />
        </mesh>
      </group>
      <group position={[RACK_X, 1.38, -1.45]}>
        <Plaque text={TOY_TEXT.newRegions} size={0.28} material={M.paper} />
        <mesh position={[0, -0.72, -0.06]} material={M.slate}>
          <boxGeometry args={[0.08, 1.16, 0.08]} />
        </mesh>
      </group>
      {/* Where the old rack stood: an outline and the result. */}
      <group ref={footprint} position={[-RACK_X, 0.01, FOOT_Z]} visible={false}>
        <mesh geometry={foot} material={M.orange} />
      </group>
      <group ref={dublin} position={[-RACK_X + 0.35, 0.5, FOOT_Z + 0.3]} visible={false}>
        <Plaque text={TOY_TEXT.dublin} size={0.3} material={M.ink} color="#ffffff" legs={0.25} />
      </group>
      <Plaque text={TOY_TEXT.noImpact} size={0.28} position={[2.25, 0.36, 3.0]} legs={0.16} color={COLORS.ink} />
    </>
  );
}

export const migrationToy: ToySpec = { Component: MigrationToy, length: 8.5 };
