import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { BACK_SLAB, BAYS, BOULEVARD, FLOOR_W, LANE, ROWS, STREET } from './layout.ts';
import type { Bay } from './layout.ts';
import { mergeParts } from './geom.ts';

const SLAB = '#ddd3c2';
const SLAB_EDGE = '#c9bda8';
const PAINT = '#f7f1e3';
export const PLAZA_R = 27.4;
// Ground layers stay under the <Pad> rings (y 0.03 to 0.04) and above the world ground (y 0).
export const Y = { edge: 0.008, slab: 0.012, floor: 0.0145, road: 0.016, paint: 0.021 };

// Flat rectangle in the ground plane (x, z), as triangles, for merging.
function rect(x0: number, z0: number, x1: number, z1: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([x0, 0, z0, x0, 0, z1, x1, 0, z1, x0, 0, z0, x1, 0, z1, x1, 0, z0], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  return g;
}

// Closed outline through (x, z, corner radius) points, each corner rounded, as a flat ground shape.
function roundedOutline(pts: [number, number, number][]): ShapeGeometry {
  const s = new Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x, z, r] = pts[i];
    const [px, pz] = pts[(i + n - 1) % n];
    const [nx, nz] = pts[(i + 1) % n];
    const la = Math.hypot(px - x, pz - z);
    const lb = Math.hypot(nx - x, nz - z);
    const ax = x + ((px - x) / la) * r;
    const az = z + ((pz - z) / la) * r;
    // shape space is (x, -z), so rotateX(-90 deg) lays it back on the ground
    if (i === 0) s.moveTo(ax, -az);
    else s.lineTo(ax, -az);
    if (r > 0) s.quadraticCurveTo(x, -z, x + ((nx - x) / lb) * r, -(z + ((nz - z) / lb) * r));
  }
  s.closePath();
  return new ShapeGeometry(s, 10).rotateX(-Math.PI / 2);
}

const roundRect = (x0: number, z0: number, x1: number, z1: number, r: number) =>
  roundedOutline([[x0, z0, r], [x1, z0, r], [x1, z1, r], [x0, z1, r]]);

// The boulevard, the right lane and the 2022 street as one surface: a C open to the left.
function roadGeometry(): ShapeGeometry {
  const B = BOULEVARD;
  const L = LANE;
  const S = STREET;
  return roundedOutline([
    [B.x0, B.z1, 0], [B.x1, B.z1, 4.5], [S.x1, S.z0, 4.5], [S.x0, S.z0, 2.2],
    [S.x0, S.z1, 2.2], [L.x0, S.z1, 2.4], [L.x0, B.z0, 2.4], [B.x0, B.z0, 0],
  ]);
}

const floorEnd = (b: Bay) => ROWS[b.row].pad + (b.row === 'front' ? 2.9 : 3.4);

// Painted bay outlines (U shapes open towards the camera) and dashed centre lines on the roads.
function paintGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const w = 0.16;
  for (const bay of BAYS) {
    const half = (bay.floorW ?? FLOOR_W) / 2;
    const zBack = ROWS[bay.row].board + 0.6;
    const zFront = floorEnd(bay);
    for (const x of [bay.x - half, bay.x + half]) parts.push(rect(x - w / 2, zBack, x + w / 2, zFront));
  }
  const zc = (BOULEVARD.z0 + BOULEVARD.z1) / 2;
  for (let x = -4.8; x < 22; x += 3.2) parts.push(rect(x, zc - 0.1, x + 1.6, zc + 0.1));
  const xc = (LANE.x0 + LANE.x1) / 2;
  for (let z = -7.2; z > -20; z -= 3.2) parts.push(rect(xc - 0.1, z - 1.6, xc + 0.1, z));
  const sc = (STREET.z0 + STREET.z1) / 2;
  for (let x = -26.4; x < 22.5; x += 3.2) parts.push(rect(x, sc - 0.1, x + 1.6, sc + 0.1));
  return mergeGeometries(parts);
}

// One painted floor per bay, from just behind the billboard to past the pad, as one mesh.
function floorsGeometry(): BufferGeometry {
  return mergeParts(
    BAYS.map((b) => {
      const z0 = ROWS[b.row].board + 0.6;
      const z1 = floorEnd(b);
      const w = b.floorW ?? FLOOR_W;
      return { g: rect(-w / 2, z0 - (z0 + z1) / 2, w / 2, z1 - (z0 + z1) / 2), color: b.floor, at: [b.x, 0, (z0 + z1) / 2] };
    }),
  );
}

function circleGeometry(r: number): ShapeGeometry {
  const s = new Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  return new ShapeGeometry(s, 72).rotateX(-Math.PI / 2);
}

// The round plaza joined with the paved ground of the 2022 row. Both pieces are drawn at the same
// height with the same material, so the overlap does not show.
function slabGeometry(grow: number): BufferGeometry {
  const S = BACK_SLAB;
  return mergeGeometries([circleGeometry(PLAZA_R + grow), roundRect(S.x0 - grow, S.z0 - grow, S.x1 + grow, S.z1 + grow, 2.5 + grow)]);
}

export function Plaza() {
  const slab = useMemo(() => slabGeometry(0), []);
  const edge = useMemo(() => slabGeometry(0.7), []);
  const paint = useMemo(paintGeometry, []);
  const road = useMemo(roadGeometry, []);
  const floors = useMemo(floorsGeometry, []);
  return (
    <group>
      <mesh geometry={edge} position={[0, Y.edge, 0]} receiveShadow>
        <meshStandardMaterial color={SLAB_EDGE} roughness={1} />
      </mesh>
      <mesh geometry={slab} position={[0, Y.slab, 0]} receiveShadow>
        <meshStandardMaterial color={SLAB} roughness={1} />
      </mesh>
      <mesh geometry={floors} position={[0, Y.floor, 0]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {/* the road surface carried in from where the world road ends, round to the 2022 street */}
      <mesh geometry={road} position={[0, Y.road, 0]} receiveShadow>
        <meshStandardMaterial color={COLORS.road} roughness={1} />
      </mesh>
      <mesh geometry={paint} position={[0, Y.paint, 0]} receiveShadow>
        <meshStandardMaterial color={PAINT} roughness={1} />
      </mesh>
      <Label flat font="display" size={1.7} color={PAINT} anchorX="right" position={[22.2, Y.paint + 0.004, STREET.z0 + 1.75]} fillOpacity={0.92}>
        2022
      </Label>
    </group>
  );
}
