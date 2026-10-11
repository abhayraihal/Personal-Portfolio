import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import { useStore } from '../../state/store.ts';
import type { V3 } from '../career/kit/frame.ts';
import { DynamicInstances, useScaledMerged } from '../career/kit/instances.tsx';
import type { Placement } from '../career/kit/instances.tsx';
import { cyl, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { GOAL, PITCH, goalLineX } from './plan.ts';

const PPM = 32; // texture pixels per metre
const LINE = 0.14; // painted line width, m
const SIZE_X = PITCH.length + PITCH.border * 2;
const SIZE_Z = PITCH.width + PITCH.border * 2;

// Mown stripes and white lines, drawn once into a canvas.
function pitchTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = Math.round(SIZE_X * PPM);
  c.height = Math.round(SIZE_Z * PPM);
  const g = c.getContext('2d')!;
  const stripe = 2; // m
  for (let i = 0; i * stripe < SIZE_X; i++) {
    g.fillStyle = i % 2 ? '#6db455' : '#7cc463';
    g.fillRect(i * stripe * PPM, 0, stripe * PPM + 1, c.height);
  }
  // Metres from the pitch's top-left corner (inside the border) to pixels.
  const px = (m: number) => (PITCH.border + m) * PPM;
  const L = PITCH.length;
  const W = PITCH.width;
  g.strokeStyle = '#f7f7f2';
  g.lineWidth = LINE * PPM;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const rect = (x: number, z: number, w: number, h: number) => g.strokeRect(px(x), px(z), w * PPM, h * PPM);
  const arc = (x: number, z: number, r: number, a0: number, a1: number) => {
    g.beginPath();
    g.arc(px(x), px(z), r * PPM, a0, a1);
    g.stroke();
  };
  rect(0, 0, L, W);
  g.beginPath();
  g.moveTo(px(L / 2), px(0));
  g.lineTo(px(L / 2), px(W));
  g.stroke();
  arc(L / 2, W / 2, 3.2, 0, Math.PI * 2);
  // Penalty and goal areas, penalty spots and the arcs outside each box.
  const boxW = 12;
  const boxD = 4.6;
  const sixW = 8.6;
  const sixD = 1.8;
  const spot = 3.4;
  for (const side of [0, 1]) {
    const x0 = side ? L - boxD : 0;
    rect(x0, (W - boxW) / 2, boxD, boxW);
    rect(side ? L - sixD : 0, (W - sixW) / 2, sixD, sixW);
    const sx = side ? L - spot : spot;
    g.fillStyle = '#f7f7f2';
    g.beginPath();
    g.arc(px(sx), px(W / 2), 0.16 * PPM, 0, Math.PI * 2);
    g.fill();
    const reach = Math.acos((boxD - spot) / 2.6);
    if (side) arc(sx, W / 2, 2.6, Math.PI - reach, Math.PI + reach);
    else arc(sx, W / 2, 2.6, -reach, reach);
  }
  for (const [x, z, a] of [[0, 0, 0], [L, 0, Math.PI / 2], [L, W, Math.PI], [0, W, -Math.PI / 2]] as const) {
    arc(x, z, 0.6, a, a + Math.PI / 2);
  }
  g.beginPath();
  g.arc(px(L / 2), px(W / 2), 0.18 * PPM, 0, Math.PI * 2);
  g.fill();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

// Net mesh: a grid texture, repeated every NET_CELL metres.
const NET_CELL = 0.32;
function netTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 32, 3);
  g.fillRect(0, 0, 3, 32);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

// Quads for the back, top and sides of one goal's net, in the goal's frame: goal line at x = 0,
// the net going out towards -x, mouth centred on z = 0.
function netGeometry(): BufferGeometry {
  const { width: w, height: h, depth: d } = GOAL;
  const back = h - 0.65;
  const pos: number[] = [];
  const uv: number[] = [];
  const quad = (a: V3, b: V3, c: V3, e: V3, ua: number, va: number) => {
    // a-b along u, a-e along v.
    for (const [p, uu, vv] of [[a, 0, 0], [b, ua, 0], [c, ua, va], [a, 0, 0], [c, ua, va], [e, 0, va]] as const) {
      pos.push(...p);
      uv.push(uu / NET_CELL, vv / NET_CELL);
    }
  };
  const slope = Math.hypot(d, h - back);
  quad([-d, 0, -w / 2], [-d, 0, w / 2], [-d, back, w / 2], [-d, back, -w / 2], w, back);
  quad([-d, back, -w / 2], [-d, back, w / 2], [0, h, w / 2], [0, h, -w / 2], w, slope);
  for (const z of [-w / 2, w / 2]) {
    // Side panel as two triangles of a trapezoid: (0,0) (-d,0) (-d,back) (0,h).
    const tri = (pts: [number, number][]) => {
      for (const [x, y] of pts) {
        pos.push(x, y, z);
        uv.push(-x / NET_CELL, y / NET_CELL);
      }
    };
    tri([[0, 0], [-d, 0], [-d, back]]);
    tri([[0, 0], [-d, back], [0, h]]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.computeVertexNormals();
  return g;
}

function frameGeometry(): BufferGeometry {
  const { width: w, height: h, depth: d } = GOAL;
  const back = h - 0.65;
  const white = '#f6f6f2';
  const r = 0.12;
  const parts: Part[] = [
    { geo: cyl(r, r, h, 14), color: white, at: [0, h / 2, -w / 2] },
    { geo: cyl(r, r, h, 14), color: white, at: [0, h / 2, w / 2] },
    { geo: cyl(r, r, w + r * 2, 14), color: white, at: [0, h, 0], rot: [Math.PI / 2, 0, 0] },
    { geo: cyl(0.05, 0.05, back, 8), color: '#d9dbe0', at: [-d, back / 2, -w / 2] },
    { geo: cyl(0.05, 0.05, back, 8), color: '#d9dbe0', at: [-d, back / 2, w / 2] },
    { geo: cyl(0.05, 0.05, w, 8), color: '#d9dbe0', at: [-d, back, 0], rot: [Math.PI / 2, 0, 0] },
    { geo: cyl(0.05, 0.05, w, 8), color: '#d9dbe0', at: [-d, 0.05, 0], rot: [Math.PI / 2, 0, 0] },
  ];
  const slope = Math.atan2(h - back, d);
  const len = Math.hypot(d, h - back);
  for (const z of [-w / 2, w / 2]) {
    parts.push(
      { geo: cyl(0.05, 0.05, len, 8), color: '#d9dbe0', at: [-d / 2, (h + back) / 2, z], rot: [0, 0, slope - Math.PI / 2] },
      { geo: cyl(0.05, 0.05, d, 8), color: '#d9dbe0', at: [-d / 2, 0.05, z], rot: [0, 0, Math.PI / 2] },
    );
  }
  return paint(parts);
}

function Goal({ side }: { side: -1 | 1 }) {
  const frame = useMemo(frameGeometry, []);
  const net = useMemo(netGeometry, []);
  const netMat = useMemo(() => new MeshStandardMaterial({ map: netTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.9 }), []);
  useEffect(() => () => {
    netMat.map?.dispose();
    netMat.dispose();
  }, [netMat]);
  const { width: w, height: h, depth: d } = GOAL;
  // side -1: the goal line is at the left end and the net goes further left (-x).
  return (
    <group position={[goalLineX(side), 0, PITCH.z]} rotation={[0, side === -1 ? 0 : Math.PI, 0]}>
      <mesh geometry={frame} material={paintMaterial} castShadow />
      <mesh geometry={net} material={netMat} castShadow />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.13, h / 2, 0.13]} position={[0, h / 2, -w / 2]} restitution={0.5} />
        <CuboidCollider args={[0.13, h / 2, 0.13]} position={[0, h / 2, w / 2]} restitution={0.5} />
        <CuboidCollider args={[0.13, 0.13, w / 2 + 0.1]} position={[0, h, 0]} restitution={0.5} />
        <CuboidCollider args={[0.06, (h - 0.65) / 2, w / 2]} position={[-d, (h - 0.65) / 2, 0]} restitution={0.15} />
        <CuboidCollider args={[d / 2, h / 2, 0.06]} position={[-d / 2, h / 2, -w / 2]} restitution={0.15} />
        <CuboidCollider args={[d / 2, h / 2, 0.06]} position={[-d / 2, h / 2, w / 2]} restitution={0.15} />
        <CuboidCollider args={[Math.hypot(d, 0.65) / 2, 0.06, w / 2]} position={[-d / 2, h - 0.325, 0]} rotation={[0, 0, Math.atan2(0.65, d)]} restitution={0.15} />
      </RigidBody>
    </group>
  );
}

const FLAG_SCALE = 0.55;
const corner = (sx: number, sz: number): Placement => ({
  position: [PITCH.x + (sx * PITCH.length) / 2, 0, PITCH.z + (sz * PITCH.width) / 2],
  rotationY: sx < 0 ? 0 : Math.PI,
});
const flags: Placement[] = [corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)];

export function Pitch() {
  const gl = useThree((s) => s.gl);
  const low = useStore((s) => s.quality === 'low');
  const texture = useMemo(() => {
    const t = pitchTexture();
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return t;
  }, [gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  // Corner flags tip over when hit (a rigid post would stop the car dead) and stand back up later.
  const flag = useScaledMerged('flag-pennant-red', FLAG_SCALE);
  const flagCollider = useMemo(() => <CylinderCollider args={[0.92, 0.09]} position={[0, 0.92, 0]} mass={1.5} friction={0.6} />, []);
  return (
    <group>
      <mesh position={[PITCH.x, 0.035, PITCH.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SIZE_X, SIZE_Z]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      <Goal side={-1} />
      <Goal side={1} />
      <DynamicInstances geometry={flag.geometry} material={flag.material} items={flags} collider={flagCollider} impact="metal"
        linearDamping={0.5} angularDamping={0.8} shadows={!low} />
    </group>
  );
}
