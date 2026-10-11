import { useEffect, useMemo } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, DoubleSide, MeshStandardMaterial, PlaneGeometry, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { env } from '../../world/env.ts';
import type { V3 } from '../career/kit/frame.ts';
import { cyl, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';

// Flags on poles. Every cloth in the park is one mesh: stripes are vertex colours and the wave runs
// in the vertex shader (env.time stops with reduced motion), so flags cost two draw calls in all.

export type FlagSpec = {
  at: V3; // foot of the pole
  height: number; // pole height
  width?: number; // cloth
  depth?: number;
  stripes: string[]; // top to bottom
  yaw?: number; // the cloth flies towards local +x rotated by yaw
  pole?: boolean; // false: the cloth hangs on something else (no pole drawn)
};

function clothGeometry(list: FlagSpec[]): BufferGeometry {
  const parts: BufferGeometry[] = [];
  list.forEach((f, idx) => {
    const w = f.width ?? 1.6;
    const h = f.depth ?? 1.0;
    const parts1: Part[] = f.stripes.map((color, i) => {
      const bh = h / f.stripes.length;
      const g = new PlaneGeometry(w, bh, 10, 1);
      g.translate(w / 2, h / 2 - bh * (i + 0.5), 0);
      return { geo: g, color };
    });
    const g = paint(parts1);
    // Distance from the pole, 0..1, and a phase per flag for the wave.
    const pos = g.attributes.position;
    const wave = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      wave[i * 2] = pos.getX(i) / w;
      wave[i * 2 + 1] = idx * 1.7;
    }
    g.setAttribute('aWave', new BufferAttribute(wave, 2));
    const yaw = f.yaw ?? 0;
    g.rotateY(yaw);
    g.translate(f.at[0] + Math.cos(yaw) * 0.08, f.at[1] + f.height - h / 2 - 0.12, f.at[2] - Math.sin(yaw) * 0.08);
    parts.push(g);
  });
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('flags: nothing to merge');
  merged.computeBoundingSphere();
  return merged;
}

function clothMaterial() {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.uniforms.uMotion = env.motion;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aWave;\nuniform float uTime;\nuniform float uMotion;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float wv = aWave.x;
float ph = aWave.x * 6.5 - uTime * 3.4 + aWave.y;
transformed += normal * (sin(ph) * 0.16 + sin(ph * 1.9 + 1.3) * 0.05) * wv * uMotion;
transformed.y -= wv * wv * 0.12;`,
      );
  };
  m.customProgramCacheKey = () => 'sports-flag-cloth';
  return m;
}

const BALL = new SphereGeometry(1, 12, 8);

export function Flags({ list }: { list: FlagSpec[] }) {
  const cloth = useMemo(() => clothGeometry(list), [list]);
  const material = useMemo(clothMaterial, []);
  const poles = useMemo(() => {
    const parts: Part[] = [];
    for (const f of list) {
      if (f.pole === false) continue;
      parts.push({ geo: cyl(0.06, 0.08, f.height, 10), color: '#e9e6de', at: [f.at[0], f.at[1] + f.height / 2, f.at[2]] });
      parts.push({ geo: BALL.clone(), color: '#f2c230', at: [f.at[0], f.at[1] + f.height + 0.06, f.at[2]], scale: [0.11, 0.11, 0.11] });
      parts.push({ geo: cyl(0.2, 0.26, 0.24, 12), color: '#8c8fa3', at: [f.at[0], f.at[1] + 0.12, f.at[2]] });
    }
    return parts.length ? paint(parts) : null;
  }, [list]);
  useEffect(() => () => {
    cloth.dispose();
    poles?.dispose();
  }, [cloth, poles]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      <mesh geometry={cloth} material={material} castShadow />
      {poles && <mesh geometry={poles} material={paintMaterial} castShadow receiveShadow />}
      <RigidBody type="fixed" colliders={false}>
        {list.filter((f) => f.pole !== false).map((f, i) => (
          <CylinderCollider key={i} args={[f.height / 2, 0.14]} position={[f.at[0], f.at[1] + f.height / 2, f.at[2]]} />
        ))}
      </RigidBody>
    </group>
  );
}
