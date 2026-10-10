import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Color, CylinderGeometry, InstancedBufferAttribute, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { Group, InstancedMesh, Mesh } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Label } from '../../../components/Label.tsx';
import { Model, modelSize } from '../../../components/Model.tsx';
import { COLORS } from '../../../config/palette.ts';
import { playSound } from '../../../state/events.ts';
import { useStore } from '../../../state/store.ts';
import { TOY_TEXT } from '../copy.ts';
import { useBoxes } from '../geo.ts';
import type { BoxSpec } from '../geo.ts';
import { M } from '../materials.ts';
import { Static } from '../merge.tsx';
import { Plaque, StationBoard } from '../parts.tsx';
import { easeInCubic, easeOutBack, easeOutCubic, fixBounds, frameDt, seg } from '../shared.ts';
import type { ToyProps, ToySpec } from '../Station.tsx';

// A ticket crate drops onto the landing pad, the agent checks four sources one after another,
// then a report card with its three headings rises where the crate was.

const LAND = { x: 0, z: 0.95 };
const PILLAR_X = [-3.6, -2.15, 2.15, 3.6];
const PILLAR_Z = 0.05;
const PILLAR_H = 1.9;
const LAMP_Y = PILLAR_H + 0.12;
const CRATE = 0.9; // crate edge, metres
const CRATE_S = CRATE / modelSize('crate-wood')[1];
const PAD_TOP = 0.06; // landing pad surface
const DROP = 9;
const T_LAND = 0.85;
const T_SRC = 1.25;
const SRC_GAP = 0.55;
const T_POOF = 3.5;
const T_CARD = T_POOF + 0.25; // once the crate has gone
const CARD = { w: 2.7, h: 2.5 };
const CARD_LOW = -3.4;
const HEAD_GAP = 0.68;
const HEAD_SIZE = 0.29;
const HEAD_Y = [CARD.h - 0.58, CARD.h - 0.58 - HEAD_GAP, CARD.h - 0.58 - 2 * HEAD_GAP];

const DIM = new Color('#2a3140');
// One colour per source: logs, metrics, code, runbooks.
const SOURCE_COLORS = ['#4f8cff', '#3ee07a', '#b07cff', '#ffb020'].map((c) => new Color(c));
const BARS: BoxSpec[] = HEAD_Y.flatMap((y): BoxSpec[] => [
  [2.16, 0.07, 0.01, -CARD.w / 2 + 0.24 + 1.08, y - 0.28, 0.06],
  [1.56, 0.07, 0.01, -CARD.w / 2 + 0.24 + 0.78, y - 0.44, 0.06],
]);

const _c = new Color();
const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _d = new Vector3();

// Report card: headings only, the lines under them are blank bars.
function ReportCard() {
  const bars = useBoxes(BARS);
  return (
    <group>
      <RoundedBox args={[CARD.w, CARD.h, 0.1]} radius={0.05} smoothness={2} bevelSegments={1} position={[0, CARD.h / 2, 0]} material={M.paper} castShadow />
      <mesh position={[0, CARD.h - 0.16, 0.055]} material={M.accent}>
        <boxGeometry args={[CARD.w - 0.1, 0.22, 0.01]} />
      </mesh>
      <mesh geometry={bars} material={M.stoneDark} />
      <Label font="bodyBold" size={HEAD_SIZE} color={COLORS.ink} anchorX="left" lineHeight={HEAD_GAP / HEAD_SIZE} position={[-CARD.w / 2 + 0.24, HEAD_Y[1], 0.06]}>
        {TOY_TEXT.report.join('\n')}
      </Label>
    </group>
  );
}

function OncallAgentToy({ clock }: ToyProps) {
  const crate = useRef<Group>(null);
  const card = useRef<Group>(null);
  const dust = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const pillars = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const beams = useRef<InstancedMesh>(null);
  const fired = useRef({ land: false, src: [false, false, false, false] });
  const geo = useMemo(() => {
    const beam = new CylinderGeometry(0.05, 0.05, 1, 6, 1);
    beam.translate(0, 0.5, 0);
    return { pillar: new RoundedBoxGeometry(0.78, PILLAR_H, 0.78, 2, 0.08), beam };
  }, []);
  const mats = useMemo(() => ({
    lamp: new MeshBasicMaterial({ toneMapped: false }),
    beam: new MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85 }),
    dust: new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
  }), []);
  useEffect(() => () => {
    geo.pillar.dispose();
    geo.beam.dispose();
    Object.values(mats).forEach((m) => m.dispose());
  }, [geo, mats]);

  // Beam from the top of the crate to each pillar lamp: a unit cylinder along +Y, scaled to length.
  const beamPose = useMemo(() => PILLAR_X.map((x) => {
    const from = new Vector3(LAND.x, 1.05, LAND.z);
    _d.set(x, LAMP_Y, PILLAR_Z).sub(from);
    return { from, len: _d.length(), q: new Quaternion().setFromUnitVectors(_up, _d.normalize()) };
  }), []);

  useLayoutEffect(() => {
    const p = pillars.current;
    const l = lamps.current;
    const b = beams.current;
    if (!p || !l || !b) return;
    _q.identity();
    PILLAR_X.forEach((x, i) => {
      p.setMatrixAt(i, _m.compose(_p.set(x, PILLAR_H / 2, PILLAR_Z), _q, _s.set(1, 1, 1)));
      l.setMatrixAt(i, _m.compose(_p.set(x, LAMP_Y, PILLAR_Z), _q, _s.set(1, 1, 1)));
    });
    l.instanceColor = new InstancedBufferAttribute(new Float32Array(12), 3);
    b.instanceColor = new InstancedBufferAttribute(new Float32Array(12), 3);
    PILLAR_X.forEach((_, i) => {
      l.setColorAt(i, DIM);
      b.setColorAt(i, SOURCE_COLORS[i]);
    });
    p.instanceMatrix.needsUpdate = true;
    l.instanceMatrix.needsUpdate = true;
    p.computeBoundingSphere();
    l.computeBoundingSphere();
    fixBounds(b, 4.5, 0, 1.5, 0.5);
  }, []);

  useFrame((state, delta) => {
    const dt = frameDt(delta);
    clock.step(dt);
    const t = clock.time;
    const phase = clock.phase;
    const back = phase === 'rewind' ? 1 - clock.r : 1; // rewind blends everything out
    if (phase === 'idle') {
      fired.current.land = false;
      fired.current.src.fill(false);
    }

    // Crate: falls, squashes on landing, then pops away before the card rises.
    const g = crate.current;
    if (g) {
      const playing = phase === 'play' || phase === 'hold';
      const fall = seg(t, 0, T_LAND);
      const y = DROP * (1 - easeInCubic(fall) * 0.35 - fall * fall * 0.65);
      const squash = Math.sin(Math.PI * seg(t, T_LAND, T_LAND + 0.22));
      const poof = seg(t, T_POOF, T_POOF + 0.25);
      const s = poof > 0 ? (poof < 0.35 ? 1 + poof * 0.4 : (1 - poof) * 1.6) : 1;
      g.visible = playing && t > 0 && poof < 1;
      g.position.y = Math.max(PAD_TOP, y);
      g.rotation.y = (1 - fall) * 1.4;
      g.scale.set(s * (1 + 0.08 * squash), s * (1 - 0.14 * squash), s * (1 + 0.08 * squash));
      if (phase === 'play' && t >= T_LAND && !fired.current.land) {
        fired.current.land = true;
        playSound('thud', 0.6);
      }
    }

    // Dust ring on landing.
    const d = dust.current;
    if (d) {
      const k = seg(t, T_LAND, T_LAND + 0.55);
      d.visible = phase === 'play' && k > 0 && k < 1;
      d.scale.setScalar(0.6 + 1.6 * easeOutCubic(k));
      mats.dust.opacity = 0.55 * (1 - k);
    }

    // Sources light up one after another, each with a beam from the crate. Beams fade once the
    // report is up; the lamps stay lit.
    const l = lamps.current;
    const b = beams.current;
    if (l && b) {
      let anyBeam = false;
      for (let i = 0; i < PILLAR_X.length; i++) {
        const t0 = T_SRC + i * SRC_GAP;
        const k = phase === 'idle' ? 0 : seg(t, t0, t0 + 0.25) * back;
        l.setColorAt(i, _c.copy(DIM).lerp(SOURCE_COLORS[i], k));
        const kb = k * (1 - seg(t, T_CARD, T_CARD + 0.4));
        anyBeam ||= kb > 0.001;
        const bp = beamPose[i];
        b.setMatrixAt(i, _m.compose(bp.from, bp.q, _s.set(1, Math.max(0.0001, bp.len * easeOutCubic(kb)), 1)));
        if (phase === 'play' && t >= t0 && !fired.current.src[i]) {
          fired.current.src[i] = true;
          playSound('click', 0.5);
        }
      }
      if (l.instanceColor) l.instanceColor.needsUpdate = true;
      b.instanceMatrix.needsUpdate = true;
      b.visible = anyBeam;
    }

    // Report card rises out of the platform.
    const c = card.current;
    if (c) {
      const k = phase === 'idle' ? 0 : easeOutBack(seg(t, T_CARD, T_CARD + 0.75)) * (phase === 'rewind' ? easeOutCubic(1 - clock.r) : 1);
      c.position.y = CARD_LOW + (0.02 - CARD_LOW) * k;
      c.visible = k > 0.001;
    }

    // Idle hint: the landing ring breathes.
    const r = ring.current;
    if (r) {
      const reduced = useStore.getState().reducedMotion;
      r.scale.setScalar(phase === 'idle' && !reduced ? 1 + Math.sin(state.clock.elapsedTime * 2.4) * 0.05 : 1);
    }
  });

  return (
    <>
      <StationBoard id="amazon-oncall-agent" position={[0, 0, -2.35]} />
      <instancedMesh ref={pillars} args={[geo.pillar, M.slate, 4]} castShadow receiveShadow />
      <instancedMesh ref={lamps} args={[undefined, mats.lamp, 4]}>
        <boxGeometry args={[0.62, 0.24, 0.62]} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[geo.beam, mats.beam, 4]} visible={false} />
      <Static>
        {PILLAR_X.map((x, i) => (
          <Plaque key={x} text={TOY_TEXT.sources[i]} size={0.28} position={[x, 1.18, PILLAR_Z + 0.4]} depth={0.05} />
        ))}
      </Static>

      {/* Landing pad */}
      <group position={[LAND.x, 0, LAND.z]}>
        <Static>
          <mesh position={[0, 0.03, 0]} material={M.slate} receiveShadow>
            <cylinderGeometry args={[0.95, 0.95, 0.06, 32]} />
          </mesh>
        </Static>
        <mesh ref={ring} position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.86, 32]} />
          <meshBasicMaterial color={COLORS.amazon} toneMapped={false} />
        </mesh>
        <mesh ref={dust} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.dust} visible={false}>
          <ringGeometry args={[0.7, 0.95, 32]} />
        </mesh>
        <group ref={crate} visible={false}>
          <Model name="crate-wood" scale={CRATE_S} />
          <Plaque text={TOY_TEXT.ticket} size={0.2} position={[0, 0.62, CRATE / 2 + 0.035]} depth={0.03} />
        </group>
        <group ref={card} position={[0, CARD_LOW, -0.1]} visible={false}>
          <ReportCard />
        </group>
      </group>

    </>
  );
}

export const oncallAgentToy: ToySpec = { Component: OncallAgentToy, length: 4.6 };
