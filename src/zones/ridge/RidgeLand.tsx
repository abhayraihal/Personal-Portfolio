import { useMemo } from 'react';
import { CuboidCollider, RigidBody, TrimeshCollider, useRapier } from '@react-three/rapier';
import type { TrimeshArgs } from '@react-three/rapier';
import { MeshStandardMaterial } from 'three';
import { buildRidgeGeometry } from './geometry.ts';
import { selfLitMaterial } from './materials.ts';
import { deckTrimesh, faceTrimesh, railBoxes } from './shape.ts';

// The landform, the deck and the guard rail beams, with their fixed colliders.
export function RidgeLand() {
  const { rapier } = useRapier();
  const geometry = useMemo(() => buildRidgeGeometry(), []);
  const materials = useMemo(
    () => ({
      faces: selfLitMaterial({ vertexColors: true, roughness: 1, metalness: 0 }, 0.32, 0.1),
      top: new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    }),
    [],
  );
  const colliders = useMemo(() => {
    // FIX_INTERNAL_EDGES stops the chassis box catching on triangle edges (see shape.ts).
    const flags = rapier.TriMeshFlags.FIX_INTERNAL_EDGES;
    const deck = deckTrimesh(0.5);
    const face = faceTrimesh(1);
    return {
      deck: [deck.vertices, deck.indices, flags] as unknown as TrimeshArgs,
      face: [face.vertices, face.indices, flags] as unknown as TrimeshArgs,
      boxes: railBoxes(1.5),
    };
  }, [rapier]);

  return (
    <>
      <mesh geometry={geometry.faces} material={materials.faces} castShadow receiveShadow />
      <mesh geometry={geometry.top} material={materials.top} castShadow receiveShadow />
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider args={colliders.deck} friction={1} />
        <TrimeshCollider args={colliders.face} friction={0.6} />
        {colliders.boxes.map((b, i) => (
          <CuboidCollider key={i} args={b.halfExtents} position={b.position} quaternion={b.quaternion} friction={0.3} />
        ))}
      </RigidBody>
    </>
  );
}
