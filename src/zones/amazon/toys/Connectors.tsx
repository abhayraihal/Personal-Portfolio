import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedBufferAttribute, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { Group, InstancedMesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { playSound } from '../../../state/events.ts';
import { TOY_TEXT } from '../copy.ts';
import { useBoxes } from '../geo.ts';
import type { BoxSpec } from '../geo.ts';
import { M } from '../materials.ts';
import { Static } from '../merge.tsx';
import { Plaque, StationBoard } from '../parts.tsx';
import { easeInOutCubic, easeOutBack, fixBounds, frameDt, seg } from '../shared.ts';
import type { ToyProps, ToySpec } from '../Station.tsx';

// Four connector gauges fill to 100% one after another in steps (a staged dial-up), each gets a
// "100%" tag, then the SOP book on the lectern opens.

const TUBE_X = [-3.15, -1.05, 1.05, 3.15];
const TUBE_Z = 0.05;
const BASE_H = 0.24;
const GLASS_H = 1.7;
const GLASS_R = 0.38;
const LIQUID_MAX = 1.62;
const TOP = BASE_H + GLASS_H;
const T0 = 0.3;
const GAP = 1.55;
const FILL = 1.25;
const STEPS = 4;
const T_BOOK = T0 + 3 * GAP + FILL + 0.25;
const BOOK = { w: 0.86, h: 1.1, d: 0.16 };
const LECTERN = { x: 2.75, z: 2.45, tilt: -1.15, y: 0.42 };

const LIQUID = new MeshStandardMaterial({ color: COLORS.amazon, emissive: '#ff7a00', emissiveIntensity: 0.35, roughness: 0.4 });
const TAG = new MeshStandardMaterial({ color: '#2e9e5b', roughness: 0.7 });
const COVER = new MeshStandardMaterial({ color: '#28406b', roughness: 0.75 });
const LAMP_OFF = new Color('#2f3a3a');
const LAMP_ON = new Color('#3ee07a');

const MARKS: BoxSpec[] = TUBE_X.flatMap((x) => [0.25, 0.5, 0.75].map((f): BoxSpec => [0.18, 0.03, 0.01, x + 0.22, BASE_H + LIQUID_MAX * f, TUBE_Z + GLASS_R - 0.05]));
const LECTERN_PARTS: BoxSpec[] = [[0.32, 0.34, 0.32, 0, 0.17, -0.05]];
const LECTERN_TOP: BoxSpec[] = [[2.0, 1.3, 0.08, -0.43, 0, -0.04]];
// Book layers along the lectern's normal (z = 0 is the lectern face): back cover, pages, then the
// front cover on a hinge at the left edge. The hinge drops while the cover opens, so the open cover
// lies on the lectern instead of floating at page height.
const PAGE_TOP = 0.112;
const HINGE_Z = { closed: 0.122, open: 0.034 };
const PAGE_LINES: BoxSpec[] = [0, 1, 2, 3].map((r): BoxSpec => [r === 3 ? 0.36 : 0.6, 0.04, 0.003, 0.03, BOOK.h / 2 - 0.42 - r * 0.15, PAGE_TOP + 0.0015]);
const INNER_LINES: BoxSpec[] = [0, 1, 2, 3].map((r): BoxSpec => [0.6, 0.04, 0.003, BOOK.w / 2, BOOK.h / 2 - 0.25 - r * 0.16, -0.004]);

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _c = new Color();

// Staged rise: each quarter rises quickly and then holds, like a dial-up in steps.
function staged(k: number) {
  if (k >= 1) return 1;
  const step = Math.floor(k * STEPS);
  const frac = k * STEPS - step;
  return (step + easeInOutCubic(Math.min(1, frac * 1.8))) / STEPS;
}

// Lectern with a book lying on its sloped top. The front cover hinges on the left edge and opens
// flat to the left, so the open book shows two pages, the first one headed "SOP".
function SopBook({ coverRef }: { coverRef: (el: Group | null) => void }) {
  const post = useBoxes(LECTERN_PARTS);
  const top = useBoxes(LECTERN_TOP);
  const lines = useBoxes(PAGE_LINES);
  const inner = useBoxes(INNER_LINES);
  return (
    <group position={[LECTERN.x, 0, LECTERN.z]}>
      <Static>
        <mesh geometry={post} material={M.slate} />
      </Static>
      <group position={[0, LECTERN.y, 0]} rotation={[LECTERN.tilt, 0, 0]}>
        <Static>
          <mesh geometry={top} material={M.slate} castShadow />
          <mesh position={[0, 0, 0.017]} material={COVER}>
            <boxGeometry args={[BOOK.w, BOOK.h, 0.03]} />
          </mesh>
          <mesh position={[0.01, 0, (0.032 + PAGE_TOP) / 2]} material={M.paper}>
            <boxGeometry args={[BOOK.w - 0.06, BOOK.h - 0.06, PAGE_TOP - 0.032]} />
          </mesh>
          <mesh geometry={lines} material={M.stoneDark} />
        </Static>
        <Label font="display" size={0.2} color={COLORS.ink} position={[0.03, BOOK.h / 2 - 0.22, PAGE_TOP + 0.002]}>
          {TOY_TEXT.sop}
        </Label>
        <group ref={coverRef} position={[-BOOK.w / 2, 0, HINGE_Z.closed]}>
          <mesh position={[BOOK.w / 2, 0, 0.017]} material={COVER}>
            <boxGeometry args={[BOOK.w, BOOK.h, 0.03]} />
          </mesh>
          <mesh position={[BOOK.w / 2, BOOK.h / 2 - 0.22, 0.0345]} material={M.orange}>
            <boxGeometry args={[BOOK.w - 0.18, 0.05, 0.005]} />
          </mesh>
          <Label font="display" size={0.38} color="#ffffff" position={[BOOK.w / 2, -0.04, 0.038]}>
            {TOY_TEXT.sop}
          </Label>
          {/* inside of the cover, seen once it is open */}
          <mesh position={[BOOK.w / 2, 0, -0.0005]} material={M.paper}>
            <boxGeometry args={[BOOK.w - 0.06, BOOK.h - 0.06, 0.004]} />
          </mesh>
          <mesh geometry={inner} material={M.stoneDark} />
        </group>
      </group>
    </group>
  );
}

function ConnectorsToy({ clock }: ToyProps) {
  const bases = useRef<InstancedMesh>(null);
  const glass = useRef<InstancedMesh>(null);
  const caps = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const liquid = useRef<InstancedMesh>(null);
  const tags = useRef<(Group | null)[]>([]);
  const cover = useRef<Group | null>(null);
  const fired = useRef([false, false, false, false]);
  const marks = useBoxes(MARKS);
  const lampMat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => () => lampMat.dispose(), [lampMat]);

  useLayoutEffect(() => {
    _q.identity();
    const place = (m: InstancedMesh | null, y: number) => {
      if (!m) return;
      TUBE_X.forEach((x, i) => m.setMatrixAt(i, _m.compose(_p.set(x, y, TUBE_Z), _q, _s.set(1, 1, 1))));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    };
    place(bases.current, BASE_H / 2);
    place(glass.current, BASE_H + GLASS_H / 2);
    place(caps.current, TOP + 0.1);
    place(lamps.current, TOP + 0.28);
    const l = lamps.current;
    if (l) {
      l.instanceColor = new InstancedBufferAttribute(new Float32Array(TUBE_X.length * 3), 3);
      TUBE_X.forEach((_, i) => l.setColorAt(i, LAMP_OFF));
    }
    fixBounds(liquid.current, 4.5, 0, 1, TUBE_Z);
  }, []);

  useFrame((_, delta) => {
    const dt = frameDt(delta);
    clock.step(dt);
    const t = clock.time;
    const phase = clock.phase;
    const rw = phase === 'rewind' ? 1 - clock.r : 1;
    if (phase === 'idle') fired.current.fill(false);
    const liq = liquid.current;
    const lamp = lamps.current;
    let anyLiquid = false;
    for (let i = 0; i < TUBE_X.length; i++) {
      const t0 = T0 + i * GAP;
      const level = phase === 'idle' ? 0 : staged(seg(t, t0, t0 + FILL)) * rw;
      anyLiquid ||= level > 0.001;
      if (liq) {
        // An empty gauge has no liquid at all; a zero-height cylinder would z-fight with the base.
        const h = level * LIQUID_MAX;
        const w = level > 0.001 ? 1 : 0;
        liq.setMatrixAt(i, _m.compose(_p.set(TUBE_X[i], BASE_H + 0.006 + h / 2, TUBE_Z), _q.identity(), _s.set(w, Math.max(h, 0.0001), w)));
      }
      const done = phase !== 'idle' && t >= t0 + FILL;
      if (lamp) lamp.setColorAt(i, phase === 'rewind' ? _c.copy(LAMP_ON).lerp(LAMP_OFF, clock.r) : done ? LAMP_ON : LAMP_OFF);
      const tag = tags.current[i];
      if (tag) {
        const s = phase === 'idle' ? 0 : easeOutBack(seg(t, t0 + FILL, t0 + FILL + 0.35)) * rw;
        tag.scale.setScalar(Math.max(0.0001, s));
        tag.visible = s > 0.001;
      }
      if (phase === 'play' && done && !fired.current[i]) {
        fired.current[i] = true;
        playSound('click', 0.6);
      }
    }
    if (liq) {
      liq.visible = anyLiquid;
      liq.instanceMatrix.needsUpdate = true;
    }
    if (lamp?.instanceColor) lamp.instanceColor.needsUpdate = true;
    const c = cover.current;
    if (c) {
      const k = phase === 'idle' ? 0 : easeInOutCubic(seg(t, T_BOOK, T_BOOK + 0.9)) * rw;
      c.rotation.y = -Math.PI * k;
      c.position.z = HINGE_Z.closed + (HINGE_Z.open - HINGE_Z.closed) * seg(k, 0.5, 1);
    }
  });

  return (
    <>
      <StationBoard id="amazon-connectors" position={[0, 0, -2.45]} width={7.4} titleSize={0.52} />
      <instancedMesh ref={bases} args={[undefined, M.slate, 4]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.55, BASE_H, 20]} />
      </instancedMesh>
      <instancedMesh ref={liquid} args={[undefined, LIQUID, 4]} visible={false}>
        <cylinderGeometry args={[GLASS_R - 0.07, GLASS_R - 0.07, 1, 18]} />
      </instancedMesh>
      <instancedMesh ref={glass} args={[undefined, M.glass, 4]}>
        <cylinderGeometry args={[GLASS_R, GLASS_R, GLASS_H, 20, 1, true]} />
      </instancedMesh>
      <Static>
        <mesh geometry={marks} material={M.white} />
      </Static>
      <instancedMesh ref={caps} args={[undefined, M.slate, 4]}>
        <cylinderGeometry args={[0.46, 0.46, 0.2, 20]} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, lampMat, 4]}>
        <sphereGeometry args={[0.15, 14, 10]} />
      </instancedMesh>
      {TUBE_X.map((x, i) => (
        <group key={x} position={[x, 0, TUBE_Z]}>
          <group
            ref={(el) => {
              tags.current[i] = el;
            }}
            position={[0, TOP - 0.26, GLASS_R + 0.1]}
            visible={false}
          >
            <Plaque text={TOY_TEXT.full} size={0.28} material={TAG} color="#ffffff" />
          </group>
          <Static>
            <Plaque text={TOY_TEXT.connectors[i]} size={0.26} position={[0, 0.34, 0.7]} legs={0.14} />
          </Static>
        </group>
      ))}
      <SopBook
        coverRef={(el) => {
          cover.current = el;
        }}
      />
    </>
  );
}

export const connectorsToy: ToySpec = { Component: ConnectorsToy, length: T_BOOK + 1.1 };
