import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CircleGeometry, Color, Matrix4, PlaneGeometry, Quaternion, RingGeometry, Shape, ShapeGeometry, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from '../../../config/palette.ts';
import { carNearZone } from '../frame.ts';

// A 5-6-4 network drawn the way the project's visualiser draws it: inputs at the bottom, outputs
// (with arrows) at the top, links yellow or blue by weight sign. Input nodes light up from the
// lead toy car's ray readings and outputs from what it is doing (go, left, right, brake).
export const network = { inputs: [0, 0, 0, 0, 0], outputs: [0, 0, 0, 0], dirty: false };

const LAYERS = [5, 6, 4];
const W = 3.8;
const H = 2.9;
const LIFT = 0.7;
const R = 0.15;
const FACE = '#14161b';
const OFF = new Color('#3a3f4b');
const ON = new Color('#f2c230');
const POS = new Color('#f2c230');
const NEG = new Color('#4a6cf7');

// Deterministic pseudo-random weights so the drawing is the same on every load.
function weights(): number[][] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };
  const out: number[][] = [];
  for (let l = 0; l < LAYERS.length - 1; l++) for (let j = 0; j < LAYERS[l + 1]; j++) out.push(Array.from({ length: LAYERS[l] + 1 }, rnd));
  return out;
}

function nodePos(layer: number, i: number): [number, number] {
  const n = LAYERS[layer];
  const span = W - 0.9;
  const x = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
  const y = -H / 2 + 0.45 + ((H - 0.9) * layer) / (LAYERS.length - 1);
  return [x, y];
}

function arrows(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0.1);
  s.lineTo(0.08, 0.0);
  s.lineTo(0.03, 0.0);
  s.lineTo(0.03, -0.09);
  s.lineTo(-0.03, -0.09);
  s.lineTo(-0.03, 0.0);
  s.lineTo(-0.08, 0.0);
  s.closePath();
  // up (go), left, right, down (brake), matching the four output nodes left to right
  const parts = [0, Math.PI / 2, -Math.PI / 2, Math.PI].map((rot, i) => {
    const g = new ShapeGeometry(s);
    g.rotateZ(rot);
    const [x, y] = nodePos(2, i);
    g.translate(x, y, 0.004);
    return g;
  });
  return mergeGeometries(parts) as ShapeGeometry;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _z = new Vector3(0, 0, 1);
const _c = new Color();

export function NetworkBoard({ position }: { position: [number, number, number] }) {
  const nodes = useRef<InstancedMesh>(null);
  const links = useRef<InstancedMesh>(null);
  const rings = useRef<InstancedMesh>(null);
  const w = useMemo(weights, []);
  const nodeGeo = useMemo(() => new CircleGeometry(R, 20), []);
  const ringGeo = useMemo(() => new RingGeometry(R, R + 0.035, 20), []);
  const linkGeo = useMemo(() => new PlaneGeometry(1, 1), []);
  const arrowGeo = useMemo(arrows, []);
  const count = LAYERS.reduce((a, b) => a + b, 0);
  const linkCount = LAYERS[0] * LAYERS[1] + LAYERS[1] * LAYERS[2];
  const acc = useRef(0);
  const hidden = useRef(Array.from({ length: LAYERS[1] }, () => 0));

  useLayoutEffect(() => {
    const n = nodes.current;
    const l = links.current;
    if (!n || !l) return;
    let k = 0;
    for (let layer = 0; layer < LAYERS.length; layer++) {
      for (let i = 0; i < LAYERS[layer]; i++) {
        const [x, y] = nodePos(layer, i);
        n.setMatrixAt(k, _m.makeTranslation(x, y, 0.003));
        rings.current?.setMatrixAt(k, _m.makeTranslation(x, y, 0.004));
        n.setColorAt(k, OFF);
        k++;
      }
    }
    n.instanceMatrix.needsUpdate = true;
    if (rings.current) rings.current.instanceMatrix.needsUpdate = true;
    if (n.instanceColor) n.instanceColor.needsUpdate = true;
    let li = 0;
    let wi = 0;
    for (let layer = 0; layer < LAYERS.length - 1; layer++) {
      for (let j = 0; j < LAYERS[layer + 1]; j++, wi++) {
        const [x1, y1] = nodePos(layer + 1, j);
        for (let i = 0; i < LAYERS[layer]; i++) {
          const [x0, y0] = nodePos(layer, i);
          const dx = x1 - x0;
          const dy = y1 - y0;
          const len = Math.hypot(dx, dy);
          _q.setFromAxisAngle(_z, Math.atan2(dy, dx));
          l.setMatrixAt(li, _m.compose(_p.set((x0 + x1) / 2, (y0 + y1) / 2, 0.001), _q, _s.set(len, 0.022, 1)));
          const weight = w[wi][i];
          // fade weak links towards the board colour instead of using alpha
          l.setColorAt(li, _c.set(FACE).lerp(weight > 0 ? POS : NEG, 0.25 + Math.abs(weight) * 0.6));
          li++;
        }
      }
    }
    l.instanceMatrix.needsUpdate = true;
    if (l.instanceColor) l.instanceColor.needsUpdate = true;
  }, [w]);

  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.05 || !network.dirty || !carNearZone(10)) return;
    acc.current = 0;
    network.dirty = false;
    const n = nodes.current;
    if (!n) return;
    const x = network.inputs;
    for (let j = 0; j < LAYERS[1]; j++) {
      const row = w[j];
      let sum = row[LAYERS[0]];
      for (let i = 0; i < LAYERS[0]; i++) sum += row[i] * x[i] * 3;
      hidden.current[j] = 1 / (1 + Math.exp(-sum * 2));
    }
    let k = 0;
    for (let i = 0; i < LAYERS[0]; i++) n.setColorAt(k++, _c.copy(OFF).lerp(ON, Math.min(1, x[i] * 1.4)));
    for (let j = 0; j < LAYERS[1]; j++) n.setColorAt(k++, _c.copy(OFF).lerp(ON, hidden.current[j] > 0.5 ? 1 : 0));
    for (let o = 0; o < LAYERS[2]; o++) n.setColorAt(k++, _c.copy(OFF).lerp(ON, network.outputs[o]));
    if (n.instanceColor) n.instanceColor.needsUpdate = true;
  });

  const cy = LIFT + H / 2;
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 0.15, H / 2 + 0.15, 0.14]} position={[0, cy, -0.14]} />
        <CuboidCollider args={[0.12, LIFT / 2, 0.12]} position={[-W / 2 + 0.5, LIFT / 2, -0.2]} />
        <CuboidCollider args={[0.12, LIFT / 2, 0.12]} position={[W / 2 - 0.5, LIFT / 2, -0.2]} />
      </RigidBody>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.5), cy / 2, -0.2]} castShadow>
          <boxGeometry args={[0.24, cy, 0.24]} />
          <meshStandardMaterial color={COLORS.inkSoft} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, cy, -0.14]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.3, H + 0.3, 0.26]} />
        <meshStandardMaterial color={COLORS.ink} roughness={0.85} />
      </mesh>
      <group position={[0, cy, 0.0]}>
        <mesh>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial color={FACE} toneMapped={false} />
        </mesh>
        <instancedMesh ref={links} args={[linkGeo, undefined, linkCount]} frustumCulled={false}>
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={nodes} args={[nodeGeo, undefined, count]} frustumCulled={false}>
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={rings} args={[ringGeo, undefined, count]} frustumCulled={false}>
          <meshBasicMaterial color="#e8e8e8" toneMapped={false} />
        </instancedMesh>
        <mesh geometry={arrowGeo}>
          <meshBasicMaterial color={COLORS.ink} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
