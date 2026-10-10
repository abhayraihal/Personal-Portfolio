import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from '../../config/palette.ts';
import { BAYS, BOULEVARD, ROWS } from './layout.ts';

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

// Painted bay outlines (U shapes open towards the camera) and a dashed centre line.
function paintGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const w = 0.16;
  for (const bay of BAYS) {
    const r = ROWS[bay.row];
    const x0 = bay.x - 4.6;
    const x1 = bay.x + 4.6;
    const zBack = r.board + 0.6;
    const zFront = r.pad + 3.4;
    parts.push(rect(x0 - w / 2, zBack, x0 + w / 2, zFront));
    parts.push(rect(x1 - w / 2, zBack, x1 + w / 2, zFront));
  }
  const zc = (BOULEVARD.z0 + BOULEVARD.z1) / 2;
  for (let x = -4.8; x < 17; x += 3.2) parts.push(rect(x, zc - 0.1, x + 1.6, zc + 0.1));
  return mergeGeometries(parts);
}

function slabGeometry(r: number): ShapeGeometry {
  const s = new Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  const g = new ShapeGeometry(s, 72);
  g.rotateX(-Math.PI / 2);
  return g;
}

// One painted floor per bay, from just behind the billboard to past the pad.
function BayFloors() {
  return (
    <group>
      {BAYS.map((b) => {
        const r = ROWS[b.row];
        const z0 = r.board + 0.6;
        const z1 = r.pad + 3.4;
        return (
          <mesh key={b.project.panel} position={[b.x, Y.floor, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[9.2, z1 - z0]} />
            <meshStandardMaterial color={b.floor} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Plaza() {
  const slab = useMemo(() => slabGeometry(PLAZA_R), []);
  const edge = useMemo(() => slabGeometry(PLAZA_R + 0.7), []);
  const paint = useMemo(() => paintGeometry(), []);
  return (
    <group>
      <mesh geometry={edge} position={[0, Y.edge, 0]} receiveShadow>
        <meshStandardMaterial color={SLAB_EDGE} roughness={1} />
      </mesh>
      <mesh geometry={slab} position={[0, Y.slab, 0]} receiveShadow>
        <meshStandardMaterial color={SLAB} roughness={1} />
      </mesh>
      <BayFloors />
      <mesh geometry={paint} position={[0, Y.paint, 0]} receiveShadow>
        <meshStandardMaterial color={PAINT} roughness={1} />
      </mesh>
      {/* the road surface carried into the plaza up to the arcade */}
      <mesh position={[-2.5, Y.road, (BOULEVARD.z0 + BOULEVARD.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[41, BOULEVARD.z1 - BOULEVARD.z0]} />
        <meshStandardMaterial color={COLORS.road} roughness={1} />
      </mesh>
    </group>
  );
}
