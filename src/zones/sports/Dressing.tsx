import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Matrix4, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { ZONE_BY_ID } from '../../config/layout.ts';
import { useStore } from '../../state/store.ts';
import { env } from '../../world/env.ts';
import { addLamps } from '../../world/plan.ts';
import type { V3 } from '../career/kit/frame.ts';
import { FixedBoxes, InstancedModel } from '../career/kit/instances.tsx';
import type { BoxCollider, Placement } from '../career/kit/instances.tsx';
import { box, cyl, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { placeParts, tube } from './bike.ts';
import { STADIUM } from './plan.ts';

// Park furniture: lanterns along the paths (the valley's own lamps, so they glow and pool light at
// night), four floodlight masts round the stadium, benches, bins, bunting along the promenade and
// low planting. Tall things stand where they hide no board, pad or lane.

const [CU, CV] = ZONE_BY_ID.sports.center;
const screen = (x: number, z: number) => ({ u: CU + x, v: CV - z });

// Lantern posts, zone-local (x, z).
const LANTERNS: [number, number][] = [
  [-1.4, -16.7], [13.8, -16.7], [27.6, -16.7], [42.6, -16.4], // far side of the promenade
  [-12.4, -10.6], [20.6, -11.4], // near side, clear of the stadium-front signs
  [32.3, 2.4], [32.3, 19.6], [37.0, 9.6], // along the right path
  [-1.6, 33.4], [24.3, 33.4], [32.0, 44.2], // by the pool, the volleyball and the bowling approach
  [-23.4, -21.6], [-8.2, -21.8], // either side of the plaza
];
addLamps(LANTERNS.map(([x, z]) => ({ kind: 'lantern' as const, ...screen(x, z) })));

// Floodlights at the stadium's four corners, heads turned to the centre spot.
const MASTS: [number, number][] = [[-21.6, -7.2], [29.6, -7.2], [-21.6, 28.4], [29.6, 28.4]];
const MAST_H = 9.2;

const TILT = 0.45; // the heads lean forward over the field

function mastGeometry() {
  const parts: Part[] = [];
  const faces: Part[] = [];
  const lamps: { at: V3; yaw: number }[] = [];
  for (const [x, z] of MASTS) {
    parts.push({ geo: cyl(0.14, 0.22, MAST_H, 10), color: '#9aa0aa', at: [x, MAST_H / 2, z] });
    parts.push({ geo: cyl(0.45, 0.55, 0.3, 12), color: '#7d838e', at: [x, 0.15, z] });
    const yaw = Math.atan2(STADIUM.x - x, STADIUM.z - z);
    const at: V3 = [x, MAST_H + 0.4, z];
    parts.push(...placeParts([
      { geo: box(2.6, 1.5, 0.3, 0.05), color: '#3a3f4b', at: [0, 0, 0] },
      { geo: box(2.8, 0.08, 0.5, 0.02), color: '#9aa0aa', at: [0, 0.8, 0.05] },
    ], at, yaw, TILT));
    // Six lamp faces, a 3 x 2 grid on the front of the head.
    const grid: Part[] = [];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) grid.push({ geo: new PlaneGeometry(0.62, 0.48), color: '#ffffff', at: [(i - 1) * 0.8, (j - 0.5) * 0.62, 0.17] });
    faces.push(...placeParts(grid, at, yaw, TILT));
    lamps.push({ at, yaw });
  }
  return { geo: paint(parts), faces: paint(faces), lamps };
}

const HALO_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xyz += vec3(position.xy * uSize, 0.6);
  gl_Position = projectionMatrix * c;
}
`;
const HALO_FRAG = /* glsl */ `
uniform float uNight;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.4) * uNight;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

// Benches face the camera unless turned; bins beside some of them.
const BENCHES: Placement[] = [
  { position: [17.6, 0, -16.9] }, { position: [31.2, 0, -16.9] }, { position: [-6.2, 0, -10.8] },
  { position: [-21.2, 0, -12.6], rotationY: Math.PI / 2 }, { position: [32.4, 0, 26.0], rotationY: Math.PI / 2 },
  { position: [-9.4, 0, 33.6] }, { position: [16.6, 0, 33.6] }, { position: [44.0, 0, 9.7] },
];
const BINS: V3[] = [[19.3, 0, -16.9], [-19.9, 0, -14.6], [-7.6, 0, 33.6], [33.6, 0, 27.8]];
const benchBoxes: BoxCollider[] = BENCHES.map((b) => ({ position: [b.position[0], 0.5, b.position[2]] as V3, half: [1.15, 0.5, 0.55] as V3, rotationY: b.rotationY }));

function binGeometry() {
  const parts: Part[] = [];
  for (const [x, , z] of BINS) {
    parts.push({ geo: cyl(0.32, 0.27, 0.9, 14), color: '#2f7d3a', at: [x, 0.45, z] });
    parts.push({ geo: cyl(0.35, 0.35, 0.1, 14), color: '#23262d', at: [x, 0.92, z] });
  }
  return paint(parts);
}

// Bunting along the far side of the promenade, from lantern to lantern.
const BUNTING: [V3, V3][] = [
  [[-1.4, 3.7, -16.7], [13.8, 3.7, -16.7]],
  [[13.8, 3.7, -16.7], [27.6, 3.7, -16.7]],
  [[27.6, 3.7, -16.7], [42.6, 3.7, -16.4]],
];
const BUNT_COLORS = ['#e2557f', '#f2c230', '#2f6fd6', '#4caf50', '#f4f4f0'];

function buntingGeometry() {
  const parts: Part[] = [];
  for (const [a, b] of BUNTING) {
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = Math.floor(len / 0.7);
    let prev: V3 = a;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const sag = Math.sin(t * Math.PI) * 0.9;
      const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t];
      parts.push(tube(prev, p, 0.012, '#f4f0e6', 4));
      prev = p;
      if (i === n) break;
      // A pennant hanging from the string, facing the camera.
      const tri = new BufferGeometry();
      const pos = new Float32Array([-0.24, 0, 0, 0, -0.5, 0, 0.24, 0, 0]);
      tri.setAttribute('position', new BufferAttribute(pos, 3));
      tri.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
      parts.push({ geo: tri, color: BUNT_COLORS[i % BUNT_COLORS.length], at: p });
    }
  }
  return paint(parts);
}

// Planting, zone-local; no colliders.
const FLOWERS: Placement[] = [
  [-23.4, -18.4], [-21.4, -23.6], [-9.6, -23.9], [-0.9, -25.2], [5.6, -21.6], [26.4, -21.6], [41.4, -19.4], [-10.6, -8.6],
  [-1.2, -11.6], [9.4, -11.8], [22.6, -11.2], [33.2, -9.6], [39.6, 8.4], [56.6, 8.8], [33.0, 34.2], [-24.2, 31.8], [24.0, 30.0],
].map(([x, z], i) => ({ position: [x, 0, z] as V3, rotationY: i * 1.3, scale: 0.9 + (i % 3) * 0.12 }));
const POPPIES: Placement[] = [
  [-17.6, -22.6], [-12.4, -22.8], [3.8, -18.6], [16.2, -19.8], [28.8, -19.2], [-14.2, -7.4], [35.8, 5.6], [52.6, 8.4],
  [-3.6, 30.6], [26.6, 35.6], [44.6, 41.2], [-25.0, 26.0], [31.0, -3.2], [38.4, 20.2],
].map(([x, z], i) => ({ position: [x, 0, z] as V3, rotationY: i * 0.9 }));
const LEAFY: Placement[] = [
  [-24.6, -10.4], [-25.0, 4.0], [-25.2, 14.0], [33.4, 14.6], [33.2, 40.2], [55.2, 44.2], [61.0, 44.0], [37.4, -9.6], [60.6, 9.0],
].map(([x, z], i) => ({ position: [x, 0, z] as V3, rotationY: i * 2.1, scale: 1.2 }));
// A few trees at the park's edges, where they hide nothing in it.
const TREES: Placement[] = [
  { position: [-24.6, 0, -29.2], scale: 0.62 },
  { position: [-2.4, 0, -30.6], scale: 0.56, rotationY: 1.1 },
  { position: [27.4, 0, -30.4], scale: 0.6, rotationY: 2.3 },
  { position: [-25.8, 0, 9.0], scale: 0.58, rotationY: 0.6 },
];

const _m = new Matrix4();
const _p = new Vector3();

export function Dressing() {
  const low = useStore((s) => s.quality === 'low');
  const masts = useMemo(mastGeometry, []);
  const bins = useMemo(binGeometry, []);
  const bunting = useMemo(buntingGeometry, []);
  const faceMat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new Color('#d8dde6') }), []);
  const halo = useMemo(() => {
    const mat = new ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uNight: env.night, uSize: { value: 4.2 }, uColor: { value: new Color('#fff3d6') } },
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    return { geo: new PlaneGeometry(1, 1), mat };
  }, []);
  useEffect(() => () => {
    faceMat.dispose();
    halo.mat.dispose();
    halo.geo.dispose();
  }, [faceMat, halo]);
  const haloRef = useRef<InstancedMesh>(null);
  useEffect(() => {
    const m = haloRef.current;
    if (!m) return;
    masts.lamps.forEach((l, i) => m.setMatrixAt(i, _m.makeTranslation(_p.set(l.at[0] + Math.sin(l.yaw) * 0.6, l.at[1] - 0.2, l.at[2] + Math.cos(l.yaw) * 0.6))));
    m.instanceMatrix.needsUpdate = true;
  }, [masts]);
  // Lamp faces: pale by day, bright at night.
  useFrame(() => {
    const n = env.night.value;
    faceMat.color.setRGB(0.85 + 0.15 * n, 0.87 + 0.13 * n, 0.9 + 0.05 * n).multiplyScalar(0.9 + n * 1.6);
    if (haloRef.current) haloRef.current.visible = n > 0.01;
  });
  return (
    <group>
      <mesh geometry={masts.geo} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={masts.faces} material={faceMat} />
      <instancedMesh ref={haloRef} args={[halo.geo, halo.mat, masts.lamps.length]} frustumCulled={false} renderOrder={2} />
      <RigidBody type="fixed" colliders={false}>
        {MASTS.map(([x, z]) => (
          <CylinderCollider key={`${x},${z}`} args={[MAST_H / 2, 0.3]} position={[x, MAST_H / 2, z]} />
        ))}
        {BINS.map(([x, , z]) => (
          <CylinderCollider key={`b${x},${z}`} args={[0.45, 0.34]} position={[x, 0.45, z]} />
        ))}
      </RigidBody>
      <mesh geometry={bins} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={bunting} material={paintMaterial} castShadow />
      <InstancedModel name="bench-wood" items={BENCHES} shadows={!low} />
      <FixedBoxes boxes={benchBoxes} />
      <InstancedModel name="tree-pine-cone" items={TREES} shadows={!low} />
      {!low && (
        <>
          <InstancedModel name="flowers-tall" items={FLOWERS} shadows={false} />
          <InstancedModel name="flowers-blue-poppy" items={POPPIES} shadows={false} />
          <InstancedModel name="plant-leafy" items={LEAFY} shadows={false} />
        </>
      )}
    </group>
  );
}
