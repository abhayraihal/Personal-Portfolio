import { useMemo } from 'react';
import { COLORS } from '../../config/palette.ts';
import type { P2 } from './geometry.ts';
import { lawnTexture, offsetPath, polygonGeometry, ribbonGeometry, roundedRect, smoothPath } from './geometry.ts';
import { CONNECTOR, JUNCTION, LOOP, LOOP_PATH, MONUMENT, PODIUM, RESEARCH, SCHOOL, TRAIL, TRAIL_WIDTH } from './layout.ts';

// Layer heights above the world ground (y = 0), far enough apart to never z-fight.
export const Y = { lawn: 0.02, path: 0.03, trail: 0.036, trailEdge: 0.042, connector: 0.048, road: 0.054, kerb: 0.06, pad: 0.066 };

const ROAD = '#8b8782';
const KERB = '#e9e2d2';
const PATH = '#e2d3b0';
const LAWN_LIGHT = '#8cc46a';
const LAWN_DARK = '#7db65d';

// Footpaths from the loop to the doors and corners, as control points.
const FOOTPATHS: { pts: P2[]; width: number }[] = [
  // to the main building's door
  { pts: [[-4.6, -12.2], [-4.6, -15.6]], width: 2.4 },
  // to the hostel door
  { pts: [[-9.4, -10.6], [-12.4, -12.8]], width: 2.2 },
  // monument forecourt
  { pts: [[MONUMENT.x - 3.6, -18.6], [MONUMENT.x + 3.2, -18.6]], width: 2.2 },
  // research corner apron
  { pts: [[15.6, 1.3], [RESEARCH.pad[0] + 1.5, 1.3]], width: 4.6 },
  // podium apron
  { pts: [[PODIUM.x, 12.6], [PODIUM.x, 18.2]], width: 4.2 },
  // school drive, through the gate to the pad beyond it
  { pts: [[SCHOOL.x, 12.6], [SCHOOL.x, SCHOOL.pad[1] + 1.4]], width: 5 },
];

// Wider than the hub's 7 m dirt road, so the paved connector covers its end completely.
const CONNECTOR_WIDTH = 7.6;

const near = (p: P2, q: P2, d: number) => Math.hypot(p[0] - q[0], p[1] - q[1]) < d;

// The outer kerb as an open line that stops either side of the junction mouth.
function outerKerb(): P2[] {
  const kerb = offsetPath(LOOP_PATH, -(LOOP.width / 2 - 0.18), true);
  const mouth = CONNECTOR_WIDTH / 2 + 0.35;
  const start = kerb.findIndex((p) => near(p, JUNCTION, LOOP.width / 2 + mouth) && !near(p, JUNCTION, LOOP.width / 2 + mouth - 0.6));
  const rotated = [...kerb.slice(start), ...kerb.slice(0, start)];
  return rotated.filter((p) => !near(p, JUNCTION, LOOP.width / 2 + mouth - 0.4));
}

// Centre-line dashes (1.2 m on, 1.2 m off), none across the junction.
function dashes(): P2[][] {
  const out: P2[][] = [];
  for (let i = 0; i + 2 < LOOP_PATH.length; i += 4) {
    const seg = LOOP_PATH.slice(i, i + 3);
    if (seg.some((p) => near(p, JUNCTION, CONNECTOR_WIDTH / 2 + 0.6))) continue;
    out.push(seg);
  }
  return out;
}

export function Ground() {
  const geo = useMemo(() => {
    const road = ribbonGeometry([{ pts: LOOP_PATH, width: LOOP.width, closed: true, y: Y.road }]);
    const [c0, c1] = CONNECTOR;
    const len = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    const connEnd: P2 = [c1[0] - ((c1[0] - c0[0]) / len) * (LOOP.width / 2 - 0.1), c1[1] - ((c1[1] - c0[1]) / len) * (LOOP.width / 2 - 0.1)];
    const kerbs = ribbonGeometry([
      { pts: offsetPath(LOOP_PATH, LOOP.width / 2 - 0.18, true), width: 0.28, closed: true, y: Y.kerb },
      { pts: outerKerb(), width: 0.28, y: Y.kerb },
      ...[-1, 1].map((sd) => ({ pts: offsetPath([c0, connEnd], sd * (CONNECTOR_WIDTH / 2 - 0.18)), width: 0.28, y: Y.kerb })),
      ...dashes().map((pts) => ({ pts, width: 0.16, y: Y.kerb })),
    ]);
    const lawnPts = roundedRect(LOOP.cx, LOOP.cz, LOOP.hx - LOOP.width / 2 + 0.05, LOOP.hz - LOOP.width / 2 + 0.05, LOOP.r - LOOP.width / 2, 12);
    const lawn = polygonGeometry(lawnPts, Y.lawn);
    // Lawn uv = world metres; diagonal stripes 2.6 m wide.
    const uv = lawn.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + uv.getY(i)) / 5.2, 0);
    const connector = ribbonGeometry([{ pts: CONNECTOR, width: CONNECTOR_WIDTH, y: Y.connector }]);
    const paths = ribbonGeometry(FOOTPATHS.map((f) => ({ pts: smoothPath(f.pts, 0.4), width: f.width, y: Y.path })));
    const trail = ribbonGeometry([{ pts: TRAIL, width: TRAIL_WIDTH, y: Y.trail }]);
    const trailEdge = ribbonGeometry([
      { pts: offsetPath(TRAIL, TRAIL_WIDTH / 2), width: 0.5, y: Y.trailEdge },
      { pts: offsetPath(TRAIL, -TRAIL_WIDTH / 2), width: 0.5, y: Y.trailEdge },
    ]);
    return { road, kerbs, lawn, connector, paths, trail, trailEdge };
  }, []);
  const stripes = useMemo(() => lawnTexture(LAWN_LIGHT, LAWN_DARK), []);

  return (
    <group name="campus-ground">
      <mesh geometry={geo.lawn} receiveShadow>
        <meshStandardMaterial map={stripes} roughness={1} />
      </mesh>
      <mesh geometry={geo.road} receiveShadow>
        <meshStandardMaterial color={ROAD} roughness={1} />
      </mesh>
      <mesh geometry={geo.kerbs} receiveShadow>
        <meshStandardMaterial color={KERB} roughness={1} />
      </mesh>
      <mesh geometry={geo.connector} receiveShadow>
        <meshStandardMaterial color={ROAD} roughness={1} />
      </mesh>
      <mesh geometry={geo.paths} receiveShadow>
        <meshStandardMaterial color={PATH} roughness={1} />
      </mesh>
      <mesh geometry={geo.trail} receiveShadow>
        <meshStandardMaterial color={COLORS.dirt} roughness={1} />
      </mesh>
      <mesh geometry={geo.trailEdge} receiveShadow>
        <meshStandardMaterial color="#9a7449" roughness={1} />
      </mesh>
    </group>
  );
}

