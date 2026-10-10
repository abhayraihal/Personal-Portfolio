import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, CylinderGeometry, DoubleSide, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from '../config/palette.ts';
import { car } from '../state/car.ts';
import { useStore } from '../state/store.ts';

// Prayer flags strung across the front of the roof, like the jeeps on the hill roads around
// Mandi. They hang over the windscreen at rest and stream back over the roof at speed.
// Body-mesh units (the model is drawn at 1.5x): the roof top is y = 1.10, its front edge z = 0.25.
const LEFT = new Vector3(-0.42, 1.19, 0.22);
const RIGHT = new Vector3(0.42, 1.19, 0.22);
const POST = 0.1; // tie posts at the roof corners, base just inside the roof
const SAG = 0.03;
const FLAG_W = 0.15;
const FLAG_H = 0.13;
const COUNT = COLORS.flags.length;

const _m = new Matrix4();
const _p = new Vector3();

function rod(a: Vector3, b: Vector3, r: number): CylinderGeometry {
  const g = new CylinderGeometry(r, r, a.distanceTo(b), 5, 1);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// Point on the sagging string, t = 0 at the left post, 1 at the right.
function stringPoint(t: number, out: Vector3): Vector3 {
  return out.lerpVectors(LEFT, RIGHT, t).setY(LEFT.y - SAG * 4 * t * (1 - t));
}

export function Flags() {
  const flags = useRef<InstancedMesh>(null);
  const res = useMemo(() => {
    const segs = 8;
    const below = (v: Vector3) => v.clone().setY(v.y - POST);
    const parts = [rod(below(LEFT), LEFT, 0.012), rod(below(RIGHT), RIGHT, 0.012)];
    const a = new Vector3();
    const b = new Vector3();
    for (let i = 0; i < segs; i++) parts.push(rod(stringPoint(i / segs, a), stringPoint((i + 1) / segs, b), 0.005));
    const line = mergeGeometries(parts, false) ?? parts[0];
    for (const p of parts) if (p !== line) p.dispose();
    const lineMat = new MeshStandardMaterial({ color: COLORS.inkSoft, roughness: 0.8 });
    // Each flag hangs from its top edge, so the pivot sits on the string.
    const flag = new PlaneGeometry(FLAG_W, FLAG_H).translate(0, -FLAG_H / 2, 0);
    const flagMat = new MeshStandardMaterial({ roughness: 0.9, side: DoubleSide });
    return { line, lineMat, flag, flagMat };
  }, []);

  useEffect(() => () => {
    res.line.dispose();
    res.lineMat.dispose();
    res.flag.dispose();
    res.flagMat.dispose();
  }, [res]);

  useEffect(() => {
    const m = flags.current;
    if (!m) return;
    const c = new Color();
    COLORS.flags.forEach((hex, i) => m.setColorAt(i, c.set(hex)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  // Rotation about the string (+X): positive swings the bottom edge backwards. Wind from driving
  // lifts the flags back; they flap faster with speed. No flapping with reduced motion.
  const phase = useRef(0);
  const lift = useRef(0);
  useFrame((_, delta) => {
    const m = flags.current;
    if (!m) return;
    const dt = Math.min(delta, 0.1);
    const still = useStore.getState().reducedMotion;
    const speed = Math.min(Math.abs(car.speed) / 16, 1.5);
    lift.current += (Math.min(speed, 1.2) * 1.15 - lift.current) * (1 - Math.exp(-dt * 3));
    phase.current += dt * (2.5 + speed * 10);
    for (let i = 0; i < COUNT; i++) {
      const flap = still ? 0 : Math.sin(phase.current + i * 1.4) * (0.1 + speed * 0.22) + Math.sin(phase.current * 2.7 + i * 0.7) * 0.06 * speed;
      _m.makeRotationX(lift.current + flap).setPosition(stringPoint((i + 0.5) / COUNT, _p));
      m.setMatrixAt(i, _m);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={res.line} material={res.lineMat} castShadow />
      <instancedMesh ref={flags} args={[res.flag, res.flagMat, COUNT]} castShadow frustumCulled={false} />
    </>
  );
}
