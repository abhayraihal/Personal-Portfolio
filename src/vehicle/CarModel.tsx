import type { RefObject } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Group, Mesh } from 'three';
import { MODEL, WHEELS } from './tuning.ts';

// public/models/suv.glb references Textures/colormap.png relative to itself, so the texture must sit in
// public/models/Textures/. BASE_URL is vite.config `base` ('/portfolio/' unless BASE_PATH is set), in dev too.
const MODEL_URL = `${import.meta.env.BASE_URL}${MODEL.url}`;
// Second argument false: no DRACOLoader. drei would otherwise point it at www.gstatic.com.
const USE_DRACO = false;

function mesh(meshes: Record<string, Mesh>, name: string): Mesh {
  const m = meshes[name];
  if (!m) throw new Error(`suv.glb has no mesh named "${name}"`);
  return m;
}

export function CarModel({ wheelRefs }: { wheelRefs: RefObject<(Group | null)[]> }) {
  const { meshes } = useGLTF(MODEL_URL, USE_DRACO);
  const body = mesh(meshes, 'body');
  const spare = mesh(meshes, 'wheel-back');

  return (
    <group
      rotation-y={MODEL.rotationY}
      scale={MODEL.scale}
      position={[MODEL.offset.x, MODEL.offset.y, MODEL.offset.z]}
    >
      <mesh geometry={body.geometry} material={body.material} position={body.position} castShadow receiveShadow>
        <mesh geometry={spare.geometry} material={spare.material} position={spare.position} castShadow />
      </mesh>
      {WHEELS.map((w, i) => {
        const wheel = mesh(meshes, w.node);
        return (
          <group
            key={w.node}
            position={wheel.position}
            ref={(el) => {
              // Steer (Y) first, then spin about the steered axle (X).
              if (el) el.rotation.order = 'YXZ';
              wheelRefs.current[i] = el;
            }}
          >
            <mesh geometry={wheel.geometry} material={wheel.material} castShadow />
          </group>
        );
      })}
    </group>
  );
}

useGLTF.preload(MODEL_URL, USE_DRACO);
