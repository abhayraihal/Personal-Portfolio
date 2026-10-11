import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CircleGeometry, Color, Matrix4, MeshBasicMaterial, PlaneGeometry, RingGeometry } from 'three';
import type { Group, InstancedMesh, Mesh } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { typing } from '../../data/profile.ts';
import { useStore } from '../../state/store.ts';
import { box, cyl, flatMaterial, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { TYPING, TYPING_PAD } from './plan.ts';

// Touch typing: a giant keyboard that types on its own at the best speed from profile.ts, the text
// appearing on a monitor behind it, and a speedometer whose needle climbs to that speed while a
// line is being typed and drops back between lines.

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const STAGGER = [0, 0.27, 0.78];
const PITCH = 1.0;
const CAP = { w: 0.86, h: 0.3 };
const CASE = { w: 10.7, d: 4.4, h: 0.34 };
const TRAVEL = 0.16;
const LINES = ['the quick brown fox jumps over the lazy dog', 'football tennis volleyball swimming bowling', 'running cycling trekking table tennis'];
const CPS = (typing.wpm * 5) / 60; // characters a second at the best speed
const SHOWN = 24; // characters on the monitor
const GAUGE = { x: 6.3, y: 2.25, r: 1.35, max: 120, from: (215 * Math.PI) / 180, to: (-35 * Math.PI) / 180 };
const MONITOR = { x: -1.3, z: -3.35, w: 7.2, h: 2.3, y: 1.05 };

type Key = { ch: string; x: number; z: number };
const KEYS: Key[] = ROWS.flatMap((row, r) => [...row].map((ch, i) => ({ ch, x: (i - 4.5 + STAGGER[r]) * PITCH, z: (r - 1.25) * PITCH })));
const KEY_INDEX = new Map(KEYS.map((k, i) => [k.ch.toLowerCase(), i]));
const SPACE = { x: 0.3, z: 1.75, w: 4.9 };

const gaugeAngle = (v: number) => GAUGE.from + (GAUGE.to - GAUGE.from) * Math.min(1, Math.max(0, v / GAUGE.max));

const _m = new Matrix4();
const UP_COLOR = new Color('#f4efe6');
const DOWN_COLOR = new Color(COLORS.accent);
const _c = new Color();

type TextMesh = { text: string; sync: () => void };

function staticGeometry() {
  const parts: Part[] = [
    { geo: box(CASE.w, CASE.h, CASE.d, 0.12, 2), color: '#2c2f38', at: [0, CASE.h / 2, 0.2] },
    { geo: box(CASE.w - 0.3, 0.04, CASE.d - 0.3, 0.02), color: '#3a3f4b', at: [0, CASE.h + 0.01, 0.2] },
    // Monitor on a stand behind the keyboard.
    { geo: box(MONITOR.w + 0.3, MONITOR.h + 1.15, 0.22, 0.08), color: '#1b1d24', at: [MONITOR.x, MONITOR.y + (MONITOR.h + 1.15) / 2, MONITOR.z] },
    { geo: box(0.5, MONITOR.y + 0.1, 0.3, 0.04), color: '#3a3f4b', at: [MONITOR.x, (MONITOR.y + 0.1) / 2, MONITOR.z - 0.15] },
    { geo: box(2.4, 0.1, 1.0, 0.04), color: '#3a3f4b', at: [MONITOR.x, 0.05, MONITOR.z - 0.15] },
    // Gauge housing on a post.
    { geo: cyl(GAUGE.r + 0.14, GAUGE.r + 0.14, 0.24, 40), color: '#1b1d24', at: [GAUGE.x, GAUGE.y, MONITOR.z], rot: [Math.PI / 2, 0, 0] },
    { geo: cyl(0.12, 0.14, GAUGE.y - GAUGE.r, 10), color: '#3a3f4b', at: [GAUGE.x, (GAUGE.y - GAUGE.r) / 2, MONITOR.z - 0.05] },
  ];
  // F and J have bumps for the index fingers: drawn on the caps below.
  return paint(parts);
}

function faceGeometry() {
  const z = MONITOR.z + 0.115;
  const parts: Part[] = [
    { geo: new PlaneGeometry(MONITOR.w, MONITOR.h), color: '#e9f3ea', at: [MONITOR.x, MONITOR.y + 0.45 + MONITOR.h / 2, z] },
    { geo: new CircleGeometry(GAUGE.r, 48), color: '#f6f3ec', at: [GAUGE.x, GAUGE.y, MONITOR.z + 0.125] },
  ];
  // Ticks every 10, longer every 20, and a red mark at the best speed.
  for (let v = 0; v <= GAUGE.max; v += 10) {
    const a = gaugeAngle(v);
    const major = v % 20 === 0;
    const len = major ? 0.24 : 0.13;
    const r = GAUGE.r - 0.08 - len / 2;
    parts.push({ geo: new PlaneGeometry(major ? 0.05 : 0.03, len), color: '#23262d', at: [GAUGE.x + Math.cos(a) * r, GAUGE.y + Math.sin(a) * r, MONITOR.z + 0.128], rot: [0, 0, a - Math.PI / 2] });
  }
  const best = gaugeAngle(typing.wpm);
  // Red band from the best speed to the end of the dial.
  const band = new RingGeometry(GAUGE.r - 0.1, GAUGE.r - 0.02, 16, 1, GAUGE.to, best - GAUGE.to);
  parts.push({ geo: band, color: '#e2442f', at: [GAUGE.x, GAUGE.y, MONITOR.z + 0.127] });
  return paint(parts);
}

export function Typing() {
  const stat = useMemo(staticGeometry, []);
  const face = useMemo(faceGeometry, []);
  const capGeo = useMemo(() => paint([
    { geo: new RoundedBoxGeometry(CAP.w, CAP.h, CAP.w, 2, 0.1), color: '#ffffff', at: [0, CAP.h / 2, 0] },
  ]), []);
  const bumpGeo = useMemo(() => paint([{ geo: box(0.3, 0.05, 0.06, 0.02), color: '#c9c2b2', at: [0, CAP.h + 0.02, 0.22] }]), []);
  const spaceGeo = useMemo(() => paint([{ geo: new RoundedBoxGeometry(SPACE.w, CAP.h, CAP.w, 2, 0.1), color: '#f4efe6', at: [0, CAP.h / 2, 0] }]), []);
  const needleGeo = useMemo(() => paint([
    { geo: box(0.07, GAUGE.r - 0.22, 0.03, 0.01), color: '#e2442f', at: [0, (GAUGE.r - 0.22) / 2 - 0.1, 0] },
    { geo: cyl(0.14, 0.14, 0.06, 20), color: '#23262d', at: [0, 0, 0.01], rot: [Math.PI / 2, 0, 0] },
  ]), []);
  const caretMat = useMemo(() => new MeshBasicMaterial({ color: '#23262d', toneMapped: false }), []);
  useEffect(() => () => caretMat.dispose(), [caretMat]);

  const caps = useRef<InstancedMesh>(null);
  const legends = useRef<(Group | null)[]>([]);
  const space = useRef<Group>(null);
  const needle = useRef<Group>(null);
  const caret = useRef<Mesh>(null);
  const screenText = useRef<TextMesh | null>(null);
  const readout = useRef<TextMesh | null>(null);
  const sim = useRef({ line: 0, i: 0, t: 0, pause: 0, typed: '', press: new Float32Array(KEYS.length), spaceP: 0, wpm: 0, shownWpm: -1, blink: 0, last: '' });

  useLayoutEffect(() => {
    const m = caps.current;
    if (!m) return;
    KEYS.forEach((k, i) => {
      m.setMatrixAt(i, _m.makeTranslation(k.x, CASE.h, k.z));
      m.setColorAt(i, UP_COLOR);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);

  useFrame((_, delta) => {
    const s = sim.current;
    const reduced = useStore.getState().reducedMotion;
    const dt = Math.min(delta, 0.05) * (reduced ? 0.4 : 1);
    const line = LINES[s.line];
    let target = 0;
    if (s.pause > 0) {
      s.pause -= dt;
      if (s.pause <= 0) {
        s.line = (s.line + 1) % LINES.length;
        s.i = 0;
        s.typed = '';
      }
    } else {
      s.t += dt;
      // A slightly uneven rhythm around the average interval, as real typing is.
      const interval = 1 / CPS;
      while (s.t >= interval * (0.85 + 0.3 * ((s.i * 7) % 5) / 4) && s.i < line.length) {
        s.t -= interval;
        const ch = line[s.i++];
        s.typed += ch;
        if (ch === ' ') s.spaceP = 1;
        else {
          const k = KEY_INDEX.get(ch);
          if (k !== undefined) s.press[k] = 1;
        }
      }
      if (s.i >= line.length) s.pause = 1.6;
      target = typing.wpm * Math.min(1, s.i / 7) - (s.i % 3) * 0.8;
    }
    // Needle: quick to rise, slower to fall, never past the best.
    const k = 1 - Math.exp(-dt * (target > s.wpm ? 5 : 2.2));
    s.wpm = Math.min(typing.wpm, s.wpm + (target - s.wpm) * k);
    if (needle.current) needle.current.rotation.z = gaugeAngle(s.wpm) - Math.PI / 2;
    const shown = Math.round(s.wpm);
    if (shown !== s.shownWpm && readout.current) {
      s.shownWpm = shown;
      readout.current.text = String(shown);
      readout.current.sync();
    }
    const text = s.typed.slice(-SHOWN);
    if (text !== s.last && screenText.current) {
      s.last = text;
      screenText.current.text = text || ' ';
      screenText.current.sync();
    }
    s.blink += dt;
    if (caret.current) caret.current.visible = s.pause > 0 ? Math.sin(s.blink * 9) > 0 : true;
    // Keys: down fast, up a little slower; pressed keys flash pink.
    const m = caps.current;
    let dirty = false;
    for (let i = 0; i < KEYS.length; i++) {
      const p = s.press[i];
      if (p <= 0) continue;
      const np = Math.max(0, p - dt * 6.5);
      s.press[i] = np;
      const depth = Math.sin(Math.min(1, (1 - np) * 2.2) * Math.PI) * TRAVEL;
      const y = CASE.h - (np > 0 ? depth : 0);
      if (m) {
        m.setMatrixAt(i, _m.makeTranslation(KEYS[i].x, y, KEYS[i].z));
        m.setColorAt(i, _c.lerpColors(UP_COLOR, DOWN_COLOR, np));
        dirty = true;
      }
      const g = legends.current[i];
      if (g) g.position.y = y - CASE.h;
    }
    if (m && dirty) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    if (s.spaceP > 0) s.spaceP = Math.max(0, s.spaceP - dt * 6.5);
    if (space.current) space.current.position.y = CASE.h - Math.sin(Math.min(1, (1 - s.spaceP) * 2.2) * Math.PI) * TRAVEL * (s.spaceP > 0 ? 1 : 0);
  });

  const legendY = CASE.h + CAP.h + 0.006;
  const screenY = MONITOR.y + 0.45 + MONITOR.h / 2;
  return (
    <group position={[TYPING.x, 0, TYPING.z]}>
      <mesh geometry={stat} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={face} material={flatMaterial} />
      <instancedMesh ref={caps} args={[capGeo, paintMaterial, KEYS.length]} castShadow receiveShadow />
      {KEYS.map((k, i) => (
        <group key={k.ch} ref={(el) => { legends.current[i] = el; }}>
          <Label flat font="display" size={0.44} color={COLORS.ink} position={[k.x, legendY, k.z - 0.02]}>
            {k.ch}
          </Label>
          {(k.ch === 'F' || k.ch === 'J') && <mesh geometry={bumpGeo} material={paintMaterial} position={[k.x, CASE.h, k.z]} />}
        </group>
      ))}
      <group ref={space} position={[SPACE.x, CASE.h, SPACE.z]}>
        <mesh geometry={spaceGeo} material={paintMaterial} castShadow receiveShadow />
      </group>
      {/* Monitor: a header with the best speed, and the line being typed ending at the caret. */}
      <Label font="display" size={0.42} color={COLORS.paper} position={[MONITOR.x, MONITOR.y + MONITOR.h + 0.8, MONITOR.z + 0.12]}>
        {`Touch typing · ${typing.wpm} WPM best`}
      </Label>
      <Label ref={(m: unknown) => { screenText.current = m as TextMesh | null; }} font="bodyBold" size={0.46} color={COLORS.ink} anchorX="right"
        position={[MONITOR.x + MONITOR.w / 2 - 0.55, screenY, MONITOR.z + 0.13]}>
        {' '}
      </Label>
      <mesh ref={caret} material={caretMat} position={[MONITOR.x + MONITOR.w / 2 - 0.45, screenY, MONITOR.z + 0.125]}>
        <planeGeometry args={[0.07, 0.6]} />
      </mesh>
      <group ref={needle} position={[GAUGE.x, GAUGE.y, MONITOR.z + 0.15]}>
        <mesh geometry={needleGeo} material={paintMaterial} castShadow />
      </group>
      {Array.from({ length: GAUGE.max / 20 + 1 }, (_, i) => i * 20).map((v) => {
        const a = gaugeAngle(v);
        const r = GAUGE.r - 0.52;
        return (
          <Label key={v} font="bodyBold" size={0.24} color={COLORS.ink} position={[GAUGE.x + Math.cos(a) * r, GAUGE.y + Math.sin(a) * r, MONITOR.z + 0.13]}>
            {String(v)}
          </Label>
        );
      })}
      <Label ref={(m: unknown) => { readout.current = m as TextMesh | null; }} font="display" size={0.38} color={COLORS.ink}
        position={[GAUGE.x, GAUGE.y - 0.52, MONITOR.z + 0.13]}>
        0
      </Label>
      <Label font="bodyBold" size={0.18} color={COLORS.inkSoft} position={[GAUGE.x, GAUGE.y - 0.82, MONITOR.z + 0.13]}>
        WPM
      </Label>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[CASE.w / 2, 0.45, CASE.d / 2]} position={[0, 0.45, 0.2]} />
        <CuboidCollider args={[(MONITOR.w + 0.3) / 2, 0.6, 0.6]} position={[MONITOR.x, 0.6, MONITOR.z - 0.15]} />
        <CuboidCollider args={[0.3, (GAUGE.y + GAUGE.r) / 2, 0.3]} position={[GAUGE.x, (GAUGE.y + GAUGE.r) / 2, MONITOR.z]} />
      </RigidBody>
      <Pad id="sports-typing" label="Read about touch typing" icon="Typing" action={{ kind: 'panel', panel: 'typing' }}
        position={[TYPING_PAD.x - TYPING.x, 0, TYPING_PAD.z - TYPING.z]} radius={2.3} color={COLORS.accent} />
    </group>
  );
}

