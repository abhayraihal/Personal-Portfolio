import { useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Color, MeshStandardMaterial } from 'three';
import { Label } from '../../components/Label.tsx';
import { MILESTONES, deckY, sContest } from './profile.ts';
import type { Milestone } from './profile.ts';
import { railSides } from './shape.ts';
import { cornerCutBox, shadeFor } from './geometry.ts';
import { railPointAt } from './Rails.tsx';

// RidgeLogic sets flash[i] to 1 when the car drives through gate i; the gate glows and fades.
export const gateFlash: number[] = MILESTONES.map(() => 0);

const PILLAR = 0.62;
const HEIGHT = 5.1; // deck to the top of the lintel
const LINTEL_H = 0.75;
const PLAQUE_H = 1.4;
const TEXT = 0.62;
// Lilita One averages about half an em per character; the plaque is sized from the label length.
const plaqueWidth = (label: string) => label.length * TEXT * 0.5 + 1.3;

function Gate({ m, index }: { m: Milestone; index: number }) {
  const s = sContest(m.index);
  const y0 = deckY(s);
  const { front, back } = useMemo(() => railSides(0.5), []);
  const zf = railPointAt(front, s).z;
  const zb = railPointAt(back, s).z;
  const color = shadeFor(m.name, m.color);
  const parts = useMemo(() => {
    const pillar = cornerCutBox(PILLAR, HEIGHT + 0.4, PILLAR, 0.09);
    const lintel = cornerCutBox(PILLAR + 0.12, LINTEL_H, zf - zb + PILLAR + 0.3, 0.1);
    const mat = new MeshStandardMaterial({ color, roughness: 0.75, emissive: new Color(color), emissiveIntensity: 0 });
    return { pillar, lintel, mat };
  }, [color, zf, zb]);
  const plaqueMat = useRef<MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    const f = gateFlash[index];
    if (f <= 0 && parts.mat.emissiveIntensity === 0) return;
    gateFlash[index] = Math.max(0, f - delta * 0.9);
    const k = gateFlash[index];
    parts.mat.emissiveIntensity = k * 0.9;
    if (plaqueMat.current) plaqueMat.current.emissiveIntensity = k * 0.9;
  });

  const w = plaqueWidth(m.label);
  const zPlaque = zf + PILLAR / 2 + 0.14;
  const yPlaque = y0 + HEIGHT - PLAQUE_H / 2 + 0.05;
  return (
    <group position={[-s, 0, 0]}>
      {[zf, zb].map((z) => (
        <mesh key={z} geometry={parts.pillar} material={parts.mat} position={[0, y0 + (HEIGHT + 0.4) / 2 - 0.4, z]} castShadow receiveShadow />
      ))}
      <mesh geometry={parts.lintel} material={parts.mat} position={[0, y0 + HEIGHT - LINTEL_H / 2, (zf + zb) / 2]} castShadow receiveShadow />
      <RoundedBox args={[w + 0.2, PLAQUE_H + 0.2, 0.16]} radius={0.1} smoothness={2} position={[0, yPlaque, zPlaque - 0.04]} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[w, PLAQUE_H, 0.2]} radius={0.08} smoothness={2} position={[0, yPlaque, zPlaque]}>
        <meshStandardMaterial ref={plaqueMat} color={color} roughness={0.7} emissive={color} emissiveIntensity={0} />
      </RoundedBox>
      <Label font="display" size={TEXT} color="#ffffff" position={[0, yPlaque, zPlaque + 0.11]}>
        {m.label}
      </Label>
      <RigidBody type="fixed" colliders={false}>
        {[zf, zb].map((z) => (
          <CuboidCollider key={z} args={[PILLAR / 2, (HEIGHT + 0.4) / 2, PILLAR / 2]} position={[0, y0 + (HEIGHT + 0.4) / 2 - 0.4, z]} />
        ))}
      </RigidBody>
    </group>
  );
}

// Arches over the road at the first contest that reached each rank.
export function Gates() {
  return (
    <>
      {MILESTONES.map((m, i) => (
        <Gate key={m.index} m={m} index={i} />
      ))}
    </>
  );
}
