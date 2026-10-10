import { use, useMemo } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Shape, SphereGeometry } from 'three';
import { Label } from '../../../components/Label.tsx';
import { BOUNDS, ROADS, ROUNDABOUT, ZONE_BY_ID, ZONES } from '../../../config/layout.ts';
import type { ZoneId } from '../../../config/layout.ts';
import { COLORS } from '../../../config/palette.ts';
import { canvasTexture, loadCanvasFonts, makeCanvas, textWidth } from '../canvas.ts';
import { CU, CV } from '../frame.ts';
import { mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';

// AI trip planner toy: a fingerpost with arrows to other parts of this valley (all of them lie to
// the left of this garage; straight-line distance between zone centres, from layout.ts) and a small
// map of the valley with a dashed trip route starting here. All of it is drawn from the layout data.

const POST_H = 4.4;
const ARROW_H = 0.46;
const TEXT = 0.24;
const MAP_X = -1.3;
const MAP_Z = 0.3;
const MAP_Y = 1.18;
const DEST: ZoneId[] = ['amazon', 'ridge', 'campus', 'sports'];

function arrowShape(len: number): Shape {
  // points left (-x); the post end is at x = 0
  const s = new Shape();
  const h = ARROW_H / 2;
  s.moveTo(0.15, -h);
  s.lineTo(-len + 0.42, -h);
  s.lineTo(-len, 0);
  s.lineTo(-len + 0.42, h);
  s.lineTo(0.15, h);
  s.closePath();
  return s;
}

function mapTexture() {
  const W = 512;
  const H = 384;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#efe4cc';
  g.fillRect(0, 0, W, H);
  const pad = 26;
  const su = (W - pad * 2) / (BOUNDS.u1 - BOUNDS.u0);
  const sv = (H - pad * 2) / (BOUNDS.v1 - BOUNDS.v0);
  const px = (u: number) => pad + (u - BOUNDS.u0) * su;
  const py = (v: number) => H - pad - (v - BOUNDS.v0) * sv;
  // zones
  for (const z of ZONES) {
    g.fillStyle = z.color;
    g.globalAlpha = 0.55;
    const a = z.area;
    if (a.kind === 'circle') {
      g.beginPath();
      g.ellipse(px(a.u), py(a.v), a.r * su, a.r * sv, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(px(a.u0), py(a.v1), (a.u1 - a.u0) * su, (a.v1 - a.v0) * sv);
    }
  }
  g.globalAlpha = 1;
  // roads
  g.strokeStyle = COLORS.road;
  g.lineCap = 'round';
  for (const r of ROADS) {
    g.lineWidth = Math.max(4, r.width * su * 0.8);
    g.beginPath();
    r.points.forEach(([u, v], i) => (i ? g.lineTo(px(u), py(v)) : g.moveTo(px(u), py(v))));
    g.stroke();
  }
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(px(ROUNDABOUT.u), py(ROUNDABOUT.v), ROUNDABOUT.r * su, ROUNDABOUT.r * sv, 0, 0, Math.PI * 2);
  g.stroke();
  // dashed trip: this garage, then each signposted zone, then back
  g.setLineDash([12, 9]);
  g.strokeStyle = COLORS.accent;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(px(CU), py(CV));
  for (const id of DEST) {
    const [u, v] = ZONE_BY_ID[id].center;
    g.lineTo(px(u), py(v));
  }
  g.closePath();
  g.stroke();
  g.setLineDash([]);
  // pins
  for (const id of ['projects', ...DEST] as ZoneId[]) {
    const [u, v] = ZONE_BY_ID[id].center;
    const x = px(u);
    const y = py(v);
    g.fillStyle = id === 'projects' ? COLORS.accent : COLORS.ink;
    g.beginPath();
    g.arc(x, y - 16, 11, Math.PI * 0.85, Math.PI * 2.15);
    g.lineTo(x, y);
    g.closePath();
    g.fill();
    g.fillStyle = COLORS.paper;
    g.beginPath();
    g.arc(x, y - 17, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = COLORS.ink;
  g.lineWidth = 8;
  g.strokeRect(4, 4, W - 8, H - 8);
  return canvasTexture(c, 4);
}

export function SignpostToy({ position }: { position: [number, number, number] }) {
  use(loadCanvasFonts());
  const map = useMemo(mapTexture, []);
  const arrows = useMemo(
    () =>
      DEST.map((id, i) => {
        const z = ZONE_BY_ID[id];
        const du = z.center[0] - CU;
        const dv = z.center[1] - CV;
        const dist = Math.round(Math.hypot(du, dv) / 5) * 5;
        const text = `${z.title} · ${dist} m`;
        const len = textWidth(text, 'bodyBold', TEXT) + 0.85;
        return { id, text, color: z.color, len, y: POST_H - 0.4 - i * 0.58 };
      }),
    [],
  );
  // post, knob, arrow boards and the map board's frame and legs, as one mesh
  const wood = useMemo(
    () =>
      mergeParts([
        { g: new CylinderGeometry(0.12, 0.15, POST_H, 10), color: '#8a5a3b', at: [0, POST_H / 2, 0] },
        { g: new SphereGeometry(0.16, 12, 8), color: COLORS.accent, at: [0, POST_H + 0.05, 0] },
        ...arrows.map((a): Part => ({
          g: new ExtrudeGeometry(arrowShape(a.len), { depth: 0.09, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1 }),
          color: a.color,
          at: [-0.05, a.y, 0.17],
        })),
        ...[-0.75, 0.75].map((x): Part => ({ g: new BoxGeometry(0.1, MAP_Y - 0.7, 0.1), color: '#8a5a3b', at: [MAP_X + x, (MAP_Y - 0.7) / 2, MAP_Z - 0.04] })),
        { g: new BoxGeometry(1.95, 1.48, 0.1), color: '#8a5a3b', at: [MAP_X, MAP_Y, MAP_Z - 0.05] },
      ]),
    [arrows],
  );
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[POST_H / 2, 0.16]} position={[0, POST_H / 2, 0]} />
        <CuboidCollider args={[0.98, MAP_Y / 2 + 0.37, 0.1]} position={[MAP_X, MAP_Y / 2 + 0.37, MAP_Z - 0.05]} />
      </RigidBody>
      <mesh geometry={wood} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {arrows.map((a) => (
        <Label key={a.id} font="bodyBold" size={TEXT} color={COLORS.paper} anchorX="right" position={[-0.25, a.y, 0.3]}>
          {a.text}
        </Label>
      ))}
      {/* map of the valley on a board under the arrows */}
      <mesh position={[MAP_X, MAP_Y, MAP_Z + 0.006]}>
        <planeGeometry args={[1.8, 1.35]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}
