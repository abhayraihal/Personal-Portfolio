import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ReactNode, RefObject } from 'react';
import { Float32BufferAttribute, Matrix4, Mesh } from 'three';
import type { BufferGeometry, Group, InstancedMesh, Material, Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Static trim that never moves (platforms, board bodies, posts, planters) is drawn as one mesh per
// material for the whole plaza: wrap it in <Static>, and useStaticMerge on the plaza root bakes
// every plain mesh under a <Static> into those meshes once everything has mounted, then hides the
// originals. Text, instanced meshes and anything hidden at mount are left alone, so animated parts
// stay outside <Static>; a plaque that sizes itself to its text can go inside, it asks for a fresh
// merge when its width changes (staticChanged).

const MARK = { merge: true };

export function Static({ children }: { children: ReactNode }) {
  return <group userData={MARK}>{children}</group>;
}

const isText = (o: Object3D) => 'text' in o && typeof (o as { sync?: unknown }).sync === 'function';
const ATTRS = ['position', 'normal', 'uv'];

// The mesh's geometry in the plaza frame with only position, normal and uv, so every part merges.
function prepare(mesh: Mesh, toRoot: Matrix4): BufferGeometry | null {
  const src = mesh.geometry;
  const attrs = src.attributes;
  if (!attrs.position || !attrs.normal) return null;
  if (ATTRS.some((n) => attrs[n] && 'isInterleavedBufferAttribute' in attrs[n])) return null;
  const g = src.index ? src.toNonIndexed() : src.clone();
  for (const name of Object.keys(g.attributes)) if (!ATTRS.includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.morphAttributes = {};
  g.clearGroups();
  g.applyMatrix4(toRoot);
  return g;
}

// Bakes the static meshes under `r` into one mesh per material; returns the undo.
function merge(r: Group): () => void {
  r.updateWorldMatrix(true, true);
  const inv = new Matrix4().copy(r.matrixWorld).invert();
  const m = new Matrix4();
  const buckets = new Map<Material, { parts: BufferGeometry[]; cast: boolean; receive: boolean }>();
  const hidden: Object3D[] = [];
  const visit = (o: Object3D, inStatic: boolean) => {
    if (!o.visible) return;
    const s = inStatic || o.userData.merge === true;
    const mesh = o as Mesh;
    if (s && mesh.isMesh && !(o as InstancedMesh).isInstancedMesh && !isText(o) && !Array.isArray(mesh.material)) {
      m.multiplyMatrices(inv, mesh.matrixWorld);
      // A mirrored part would flip its winding, so it keeps its own draw call.
      const g = m.determinant() > 0 ? prepare(mesh, m) : null;
      if (g) {
        const material = mesh.material as Material;
        const b = buckets.get(material) ?? { parts: [], cast: false, receive: false };
        b.parts.push(g);
        b.cast ||= mesh.castShadow;
        b.receive ||= mesh.receiveShadow;
        buckets.set(material, b);
        o.visible = false;
        hidden.push(o);
      }
    }
    for (const c of o.children) visit(c, s);
  };
  visit(r, false);
  const made: Mesh[] = [];
  for (const [material, b] of buckets) {
    const geo = b.parts.length === 1 ? b.parts[0] : mergeGeometries(b.parts, false);
    for (const p of b.parts) if (p !== geo) p.dispose();
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new Mesh(geo, material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.name = 'amazon-static';
    r.add(mesh);
    made.push(mesh);
  }
  return () => {
    for (const mesh of made) {
      r.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const o of hidden) o.visible = true;
  };
}

// Parts under <Static> whose geometry changes after mount (plaques that size themselves to their
// text) call this; the plaza is merged again once the changes have settled.
let changedAt = 0;
let version = 0;
export function staticChanged() {
  version++;
  changedAt = performance.now();
}

const SETTLE_MS = 150;

export function useStaticMerge(root: RefObject<Group | null>) {
  const state = useRef<{ undo: (() => void) | null; seen: number }>({ undo: null, seen: 0 });
  useLayoutEffect(() => {
    const r = root.current;
    const st = state.current;
    if (!r) return;
    st.undo = merge(r);
    st.seen = version;
    return () => {
      st.undo?.();
      st.undo = null;
    };
  }, [root]);
  useFrame(() => {
    const st = state.current;
    const r = root.current;
    if (!r || !st.undo || st.seen === version || performance.now() - changedAt < SETTLE_MS) return;
    st.undo();
    st.undo = merge(r);
    st.seen = version;
  });
}
