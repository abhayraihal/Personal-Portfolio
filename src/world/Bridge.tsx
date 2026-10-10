import { useMemo } from 'react';
import { CuboidCollider, RigidBody, TrimeshCollider } from '@react-three/rapier';
import { BufferAttribute, Color, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BRIDGE } from './geo.ts';
import { rng, range } from './rand.ts';

// A humped plank footbridge where the campus road crosses the stream, with stone footings, rails
// and four tall corner posts that carry prayer flags (strings come from plan.ts). Local frame:
// +X along the road, +Z to its right, origin on the ground at the crossing.

const HL = BRIDGE.length / 2;
const HW = BRIDGE.width / 2;
const HUMP = 0.34;
export const deckTop = (x: number) => 0.08 + HUMP * Math.max(0, 1 - (x / HL) ** 2);
const deckSlope = (x: number) => (-2 * HUMP * x) / (HL * HL);

const WOOD = ['#a8744a', '#9a6943', '#b07b4e', '#946240'].map((c) => new Color(c));
const DARK_WOOD = new Color('#6e4a30');
const POST = new Color('#7a5236');
const STONE = ['#8f92a3', '#7f8394', '#9a9cab'].map((c) => new Color(c));

type Part = { size: [number, number, number]; pos: [number, number, number]; rotZ?: number; rotX?: number; color: Color };

function parts(): Part[] {
  const r = rng(99);
  const out: Part[] = [];
  // Planks across the deck.
  const n = 23;
  for (let i = 0; i < n; i++) {
    const x = -HL + (i + 0.5) * (BRIDGE.length / n);
    out.push({
      size: [0.5, 0.13, BRIDGE.width + range(r, -0.12, 0.12)],
      pos: [x, deckTop(x) - 0.065, range(r, -0.06, 0.06)],
      rotZ: Math.atan(deckSlope(x)),
      rotX: range(r, -0.015, 0.015),
      color: WOOD[Math.floor(r() * WOOD.length)],
    });
  }
  // Two stringers under the planks, in segments that follow the hump.
  const segs = 6;
  for (const z of [-HW + 0.7, HW - 0.7]) {
    for (let i = 0; i < segs; i++) {
      const x0 = -HL + 0.2 + (i / segs) * (BRIDGE.length - 0.4);
      const x1 = -HL + 0.2 + ((i + 1) / segs) * (BRIDGE.length - 0.4);
      const y0 = deckTop(x0) - 0.25;
      const y1 = deckTop(x1) - 0.25;
      const len = Math.hypot(x1 - x0, y1 - y0);
      out.push({ size: [len + 0.06, 0.24, 0.3], pos: [(x0 + x1) / 2, (y0 + y1) / 2, z], rotZ: Math.atan2(y1 - y0, x1 - x0), color: DARK_WOOD });
    }
  }
  // Rail posts and two rails per side.
  const posts = 9;
  for (const z of [-HW + 0.12, HW - 0.12]) {
    let prev: [number, number] | null = null;
    for (let i = 0; i < posts; i++) {
      const x = -HL + 0.55 + (i / (posts - 1)) * (BRIDGE.length - 1.1);
      const base = deckTop(x);
      out.push({ size: [0.16, 1.15, 0.16], pos: [x, base + 0.5, z], color: POST });
      if (prev) {
        for (const h of [1.02, 0.5]) {
          const [px, py] = prev;
          const y0 = py + h;
          const y1 = base + h;
          const len = Math.hypot(x - px, y1 - y0);
          out.push({ size: [len, 0.09, 0.1], pos: [(x + px) / 2, (y0 + y1) / 2, z], rotZ: Math.atan2(y1 - y0, x - px), color: h > 1 ? DARK_WOOD : POST });
        }
      }
      prev = [x, base];
    }
  }
  // Tall corner posts for the prayer flags, with caps.
  for (const x of [-(HL - 0.35), HL - 0.35])
    for (const z of [-(HW + 0.05), HW + 0.05]) {
      out.push({ size: [0.24, 3.7, 0.24], pos: [x, 0.12 + 1.85, z], color: DARK_WOOD });
      out.push({ size: [0.36, 0.12, 0.36], pos: [x, 3.88, z], color: POST });
    }
  // Stone footings on both banks and a pier in the middle of the stream.
  for (const x of [-4.9, 4.9]) {
    for (let k = 0; k < 3; k++) {
      out.push({
        size: [1.5 - k * 0.15, 0.42, BRIDGE.width + 0.5 - k * 0.2],
        pos: [x + range(r, -0.08, 0.08), -0.95 + k * 0.38, range(r, -0.05, 0.05)],
        color: STONE[(k + (x > 0 ? 1 : 0)) % STONE.length],
      });
    }
  }
  out.push({ size: [0.9, 1.1, BRIDGE.width - 0.6], pos: [0, -0.55, 0], color: STONE[0] });
  return out;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _one = new Vector3(1, 1, 1);

function buildGeometry(): BufferGeometry {
  const geos: BufferGeometry[] = [];
  for (const part of parts()) {
    const [sx, sy, sz] = part.size;
    const g = new RoundedBoxGeometry(sx, sy, sz, 1, Math.min(0.035, sx / 3, sy / 3, sz / 3));
    _e.set(part.rotX ?? 0, 0, part.rotZ ?? 0);
    _q.setFromEuler(_e);
    _p.set(...part.pos);
    g.applyMatrix4(_m.compose(_p, _q, _one));
    const count = g.attributes.position.count;
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) col.set([part.color.r, part.color.g, part.color.b], i * 3);
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  merged.computeBoundingSphere();
  return merged;
}

// Deck surface for the wheels, with short ramps at both ends.
function deckCollider(): [Float32Array, Uint32Array] {
  const xs: number[] = [-HL - 0.9];
  const stations = 14;
  for (let i = 0; i <= stations; i++) xs.push(-HL + (i / stations) * BRIDGE.length);
  xs.push(HL + 0.9);
  const v: number[] = [];
  for (const x of xs) {
    const y = Math.abs(x) > HL ? -0.01 : deckTop(x);
    v.push(x, y, -HW, x, y, HW);
  }
  const idx: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return [new Float32Array(v), new Uint32Array(idx)];
}

export function Bridge() {
  const geometry = useMemo(buildGeometry, []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), []);
  const deck = useMemo(deckCollider, []);
  const yaw = Math.atan2(BRIDGE.dir[1], BRIDGE.dir[0]);
  return (
    <group name="valley-bridge" position={[BRIDGE.u, 0, -BRIDGE.v]} rotation={[0, yaw, 0]}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider args={deck} friction={1} />
        <CuboidCollider args={[HL, 0.8, 0.1]} position={[0, 0.9, -HW + 0.12]} />
        <CuboidCollider args={[HL, 0.8, 0.1]} position={[0, 0.9, HW - 0.12]} />
      </RigidBody>
    </group>
  );
}
