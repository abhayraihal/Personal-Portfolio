import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Line, LineBasicMaterial, Matrix4, Quaternion, Shape, Vector3 } from 'three';
import { Board } from '../../components/Board.tsx';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { codeforces } from '../../data/codeforces.ts';
import { PLAZA_HW, S_END, S_SUMMIT, SUMMIT, SUMMIT_Y } from './profile.ts';
import { RANK_SHADE } from './geometry.ts';
import { EndWall } from './Rails.tsx';

const POLE_Z = -(PLAZA_HW - 0.75);
const POLES: { x: number; h: number }[] = [
  { x: -(S_END - 1.6), h: 7.2 },
  { x: -(S_SUMMIT + 4.5), h: 5.4 },
];

function Pole({ x, h }: { x: number; h: number }) {
  return (
    <group position={[x, SUMMIT_Y, POLE_Z]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, h, 8]} />
        <meshStandardMaterial color={COLORS.paper} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.4, 0.24, 10]} />
        <meshStandardMaterial color={COLORS.rock} roughness={1} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.12, h / 2, 0.12]} position={[0, h / 2, 0]} />
      </RigidBody>
    </group>
  );
}

// A sagging string of prayer flags between the two poles, facing the camera.
const FLAGS = 16;
const SAG = 1.1;
const stringY = (t: number) => SUMMIT_Y + POLES[0].h - 0.25 + (POLES[1].h - POLES[0].h) * t - Math.sin(Math.PI * t) * SAG;
const stringX = (t: number) => POLES[0].x + (POLES[1].x - POLES[0].x) * t;

function PrayerFlags() {
  const ref = useRef<InstancedMesh>(null);
  const width = (Math.abs(POLES[1].x - POLES[0].x) / FLAGS) * 0.78;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new Matrix4();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const p = new Vector3();
    const c = new Color();
    for (let i = 0; i < FLAGS; i++) {
      const t = (i + 0.5) / FLAGS;
      m.setMatrixAt(i, mat.compose(p.set(stringX(t), stringY(t) - 0.34, POLE_Z), q, one));
      m.setColorAt(i, c.set(COLORS.flags[i % COLORS.flags.length]));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);
  const string = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i <= 24; i++) pts.push(stringX(i / 24), stringY(i / 24), POLE_Z);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return new Line(g, new LineBasicMaterial({ color: COLORS.inkSoft }));
  }, []);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, FLAGS]} castShadow>
        <planeGeometry args={[width, 0.62]} />
        <meshStandardMaterial side={DoubleSide} roughness={1} />
      </instancedMesh>
      <primitive object={string} />
    </>
  );
}

// Blue pennant on the taller pole: Expert is the highest rank on the ridge.
function Pennant() {
  const [a] = POLES;
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(0, 0.42);
    s.lineTo(1.7, 0);
    s.lineTo(0, -0.42);
    s.closePath();
    return s;
  }, []);
  return (
    <mesh position={[a.x + 0.06, SUMMIT_Y + a.h - 0.5, POLE_Z]} castShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={RANK_SHADE.Expert} roughness={0.8} side={DoubleSide} />
    </mesh>
  );
}

export function Summit() {
  return (
    <>
      <EndWall />
      {POLES.map((p) => (
        <Pole key={p.x} {...p} />
      ))}
      <PrayerFlags />
      <Pennant />
      <Board
        title={`${codeforces.rank} · max ${codeforces.maxRating}`}
        lines={[`${codeforces.ratedContests} rated contests · ${codeforces.distinctSolved} problems solved`]}
        width={10.6}
        titleSize={0.8}
        lineSize={0.42}
        accent={RANK_SHADE.Expert}
        align="center"
        lift={1.1}
        position={[-SUMMIT.s, SUMMIT_Y, -(PLAZA_HW - 1.6)]}
      />
      <Label flat font="display" size={3.1} color={COLORS.paper} position={[-SUMMIT.s, SUMMIT_Y + 0.02, 0]}>
        {String(codeforces.maxRating)}
      </Label>
      <Pad id="ridge-summit" label="Open Codeforces stats" action={{ kind: 'panel', panel: 'codeforces' }} position={[-SUMMIT.s, SUMMIT_Y, 0]} radius={4.7} color={COLORS.paper} />
    </>
  );
}
