import { useMemo } from 'react';
import type { ComponentProps } from 'react';
import { useGLTF } from '@react-three/drei';
import { DoubleSide, FrontSide, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import type { BufferGeometry, Material, Object3D, Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MODELS } from '../config/models.ts';
import type { ModelName } from '../config/models.ts';
import { WORLD_SCALE } from '../config/world.ts';

const BASE = import.meta.env.BASE_URL;
const USE_DRACO = false; // drei would otherwise point the Draco decoder at www.gstatic.com

export const modelUrl = (name: ModelName) => `${BASE}${MODELS[name].url}`;

// Scale that makes a model match the world (manifest suggestedScale x WORLD_SCALE).
export const modelScale = (name: ModelName) => MODELS[name].scale * WORLD_SCALE;

// Scaled bounding box size [x, y, z] in metres.
export function modelSize(name: ModelName, scale = 1): [number, number, number] {
  const m = MODELS[name];
  const s = modelScale(name) * scale;
  return [(m.max[0] - m.min[0]) * s, (m.max[1] - m.min[1]) * s, (m.max[2] - m.min[2]) * s];
}

// One material per kit palette, so every kit's colormap is uploaded once.
const kitMaterials = new Map<string, MeshStandardMaterial>();
export function kitMaterial(kit: string, map: Texture | null, doubleSided = false): MeshStandardMaterial {
  const key = `${kit}:${doubleSided ? 'double' : 'front'}`;
  let m = kitMaterials.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ map, roughness: 1, metalness: 0, side: doubleSided ? DoubleSide : FrontSide });
    m.name = `kenney-${key}`;
    kitMaterials.set(key, m);
  }
  return m;
}

const mergedCache = new Map<string, { geometry: BufferGeometry; material: MeshStandardMaterial }>();

function findMap(root: Object3D): Texture | null {
  let map: Texture | null = null;
  root.traverse((o) => {
    const mat = (o as Mesh).material as (Material & { map?: Texture | null }) | undefined;
    if (!map && mat && 'map' in mat && mat.map) map = mat.map;
  });
  return map;
}

// The whole GLB merged into one geometry (native units, transforms baked) plus the shared kit
// material. Use it for instancing. Skinned or animated models (avatar, hut door) need useGLTF.
export function useMerged(name: ModelName) {
  const info = MODELS[name];
  const gltf = useGLTF(modelUrl(name), USE_DRACO);
  return useMemo(() => {
    const cached = mergedCache.get(name);
    if (cached) return cached;
    gltf.scene.updateMatrixWorld(true);
    const parts: BufferGeometry[] = [];
    const rootInv = new Matrix4().copy(gltf.scene.matrixWorld).invert();
    gltf.scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(new Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld));
      // Kenney GLBs carry position/normal/uv; drop anything else so all parts merge.
      for (const attr of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(attr)) g.deleteAttribute(attr);
      parts.push(g.index ? g.toNonIndexed() : g);
    });
    const geometry = (parts.length === 1 ? parts[0] : mergeGeometries(parts, false)) ?? parts[0];
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const material = kitMaterial(info.kit, findMap(gltf.scene), !!('doubleSided' in info && info.doubleSided));
    const entry = { geometry, material };
    mergedCache.set(name, entry);
    return entry;
  }, [gltf, name, info]);
}

type ModelProps = Omit<ComponentProps<'mesh'>, 'geometry' | 'material' | 'scale'> & {
  name: ModelName;
  scale?: number | [number, number, number]; // multiplies the model's world scale
  shadows?: boolean; // cast + receive (default true)
};

// A static Kenney model as one mesh. Add colliders separately (see modelSize for its bounds).
export function Model({ name, scale = 1, shadows = true, ...rest }: ModelProps) {
  const { geometry, material } = useMerged(name);
  const s = modelScale(name);
  const sc: [number, number, number] = typeof scale === 'number' ? [s * scale, s * scale, s * scale] : [s * scale[0], s * scale[1], s * scale[2]];
  return <mesh geometry={geometry} material={material} scale={sc} castShadow={shadows} receiveShadow={shadows} {...rest} />;
}

export function preloadModels(names: ModelName[]) {
  for (const n of names) useGLTF.preload(modelUrl(n), USE_DRACO);
}
