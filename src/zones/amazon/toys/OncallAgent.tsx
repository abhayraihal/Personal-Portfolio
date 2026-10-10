import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Color, CylinderGeometry, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { Group, Mesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { Model } from '../../../components/Model.tsx';
import { COLORS } from '../../../config/palette.ts';
import { playSound } from '../../../state/events.ts';
import { useStore } from '../../../state/store.ts';
import { TOY_TEXT } from '../copy.ts';
import { M } from '../materials.ts';
import { Plaque, StationBoard } from '../parts.tsx';
import { easeInCubic, easeOutBack, easeOutCubic, frameDt, seg } from '../shared.ts';
import type { ToyProps, ToySpec } from '../Station.tsx';

// A ticket crate drops onto the landing pad, the agent checks four sources one after another,
// then a report card with its three headings rises where the crate was.

const LAND = { x: 0, z: 0.95 };
const PILLAR_X = [-3.6, -2.15, 2.15, 3.6];
const PILLAR_Z = 0.05;
const PILLAR_H = 1.9;
const CRATE_S = 0.9; // crate-wood is 1 m at scale 1
const DROP = 9;
const T_LAND = 0.85;
const T_SRC = 1.25;
const SRC_GAP = 0.55;
const T_POOF = 3.5;
const T_CARD = 3.62;
const CARD = { w: 2.7, h: 2.5 };
const CARD_LOW = -3.4;

const DIM = new Color('#2a3140');
// One colour per source: logs, metrics, code, runbooks.
const SOURCE_COLORS = ['#4f8cff', '#3ee07a', '#b07cff', '#ffb020'].map((c) => new Color(c));
const _c = new Color();
const _up = new Vector3(0, 1, 0);
const _d = new Vector3();

function Pillar({ x, label, lamp }: { x: number; label: string; lamp: MeshBasicMaterial }) {
  return (
    <group position={[x, 0, PILLAR_Z]}>
      <RoundedBox args={[0.78, PILLAR_H, 0.78]} radius={0.08} smoothness={2} bevelSegments={1} position={[0, PILLAR_H / 2, 0]} material={M.slate} castShadow receiveShadow />
      <mesh position={[0, PILLAR_H + 0.12, 0]} material={lamp}>
        <boxGeometry args={[0.62, 0.24, 0.62]} />
      </mesh>
      <Plaque text={label} size={0.24} position={[0, 1.18, 0.4]} depth={0.05} />
    </group>
  );
}

// Report card: headings only, the lines under them are blank bars.
function ReportCard() {
  const headY = [CARD.h - 0.58, CARD.h - 1.26, CARD.h - 1.94];
  return (
    <group>
      <RoundedBox args={[CARD.w, CARD.h, 0.1]} radius={0.05} smoothness={2} bevelSegments={1} position={[0, CARD.h / 2, 0]} material={M.paper} castShadow />
      <mesh position={[0, CARD.h - 0.16, 0.055]} material={M.orange}>
        <boxGeometry args={[CARD.w - 0.1, 0.22, 0.01]} />
      </mesh>
      {TOY_TEXT.report.map((h, i) => (
        <group key={h} position={[-CARD.w / 2 + 0.24, headY[i], 0.06]}>
          <Label font="bodyBold" size={0.29} color={COLORS.ink} anchorX="left">
            {h}
          </Label>
          {[0, 1].map((r) => (
            <mesh key={r} position={[r ? 0.78 : 1.08, -0.28 - r * 0.16, 0]} material={M.stoneDark}>
              <boxGeometry args={[r ? 1.56 : 2.16, 0.07, 0.01]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function OncallAgentToy({ clock }: ToyProps) {
  const crate = useRef<Group>(null);
  const card = useRef<Group>(null);
  const dust = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const beams = useRef<(Mesh | null)[]>([]);
  const fired = useRef({ land: false, src: [false, false, false, false] });
  const lamps = useMemo(() => PILLAR_X.map(() => new MeshBasicMaterial({ color: DIM.clone(), toneMapped: false })), []);
  const dustMat = useMemo(() => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }), []);
  const beam = useMemo(() => {
    const geo = new CylinderGeometry(0.05, 0.05, 1, 6, 1);
    geo.translate(0, 0.5, 0);
    return { geo, mats: SOURCE_COLORS.map((c) => new MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.85 })) };
  }, []);
  useEffect(() => () => {
    lamps.forEach((m) => m.dispose());
    dustMat.dispose();
    beam.geo.dispose();
    beam.mats.forEach((m) => m.dispose());
  }, [lamps, dustMat, beam]);

  // Beam from the top of the crate to each pillar lamp: a unit cylinder along +Y, scaled to length.
  const beamPose = useMemo(() => PILLAR_X.map((x) => {
    const from = new Vector3(LAND.x, 1.05, LAND.z);
    const to = new Vector3(x, PILLAR_H + 0.12, PILLAR_Z);
    _d.subVectors(to, from);
    return { from, len: _d.length(), q: new Quaternion().setFromUnitVectors(_up, _d.normalize()) };
  }), []);

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
      g.position.y = Math.max(0.04, y);
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
      dustMat.opacity = 0.55 * (1 - k);
    }

    // Sources light up one after another, each with a beam from the crate.
    for (let i = 0; i < PILLAR_X.length; i++) {
      const t0 = T_SRC + i * SRC_GAP;
      const k = phase === 'idle' ? 0 : seg(t, t0, t0 + 0.25) * back;
      lamps[i].color.copy(_c.copy(DIM).lerp(SOURCE_COLORS[i], k));
      // Beams fade once the report is up; the lamps stay lit.
      const kb = k * (1 - seg(t, T_CARD, T_CARD + 0.4));
      const b = beams.current[i];
      if (b) {
        b.visible = kb > 0.001;
        b.scale.set(1, beamPose[i].len * easeOutCubic(kb), 1);
      }
      if (phase === 'play' && t >= t0 && !fired.current.src[i]) {
        fired.current.src[i] = true;
        playSound('click', 0.5);
      }
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
      {PILLAR_X.map((x, i) => (
        <Pillar key={x} x={x} label={TOY_TEXT.sources[i]} lamp={lamps[i]} />
      ))}
      {beamPose.map((b, i) => (
        <mesh
          key={i}
          ref={(el) => {
            beams.current[i] = el;
          }}
          geometry={beam.geo}
          material={beam.mats[i]}
          position={b.from}
          quaternion={b.q}
          visible={false}
        />
      ))}

      {/* Landing pad */}
      <group position={[LAND.x, 0, LAND.z]}>
        <mesh position={[0, 0.03, 0]} material={M.slate} receiveShadow>
          <cylinderGeometry args={[0.95, 0.95, 0.06, 32]} />
        </mesh>
        <mesh ref={ring} position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.86, 32]} />
          <meshBasicMaterial color={COLORS.amazon} toneMapped={false} />
        </mesh>
        <mesh ref={dust} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} material={dustMat} visible={false}>
          <ringGeometry args={[0.7, 0.95, 32]} />
        </mesh>
        <group ref={crate} visible={false}>
          <Model name="crate-wood" scale={CRATE_S} position={[0, 0, 0]} />
          <Plaque text={TOY_TEXT.ticket} size={0.2} position={[0, 0.62, CRATE_S / 2 + 0.03]} depth={0.03} />
        </group>
        <group ref={card} position={[0, CARD_LOW, -0.1]} visible={false}>
          <ReportCard />
        </group>
      </group>

      <Plaque text={TOY_TEXT.saved} size={0.3} position={[0, 0.42, 2.75]} legs={0.18} material={M.paper} />
    </>
  );
}

export const oncallAgentToy: ToySpec = { Component: OncallAgentToy, length: 4.6 };
