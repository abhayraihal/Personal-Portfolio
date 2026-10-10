import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Matrix4, Ray, Vector3 } from 'three';
import type { Material, Object3D } from 'three';
import { car } from '../../../state/car.ts';
import type { V3 } from './frame.ts';
import { flatMaterial, paintMaterial } from './paint.ts';

type TextLike = { fillOpacity: number; outlineOpacity: number };

const _inv = new Matrix4();
const _cam = new Vector3();
const _pt = new Vector3();
const _dir = new Vector3();
const _hit = new Vector3();
const _ray = new Ray();
// Points on the car (above its chassis centre) that must stay visible.
const CAR_POINTS = [-0.4, 0.5];

// An overhead structure goes see-through while it hides the car: a ray from the camera to the car
// crosses `box` (in the structure's local frame, i.e. relative to `root`).
export function useOcclusionFade(root: RefObject<Object3D | null>, box: { min: V3; max: V3 }, minOpacity = 0.3) {
  const camera = useThree((s) => s.camera);
  const [mats] = useState(() => {
    const lit = paintMaterial.clone();
    const flat = flatMaterial.clone();
    return { lit, flat, all: [lit, flat] as Material[] };
  });
  const bounds = useMemo(() => new Box3(new Vector3(...box.min), new Vector3(...box.max)), [box]);
  const labels = useRef<(TextLike | null)[]>([]);
  const opacity = useRef(1);
  useEffect(() => () => {
    mats.lit.dispose();
    mats.flat.dispose();
  }, [mats]);
  const [setters] = useState(() => [0, 1, 2, 3].map((i) => (el: TextLike | null) => {
    labels.current[i] = el;
  }));

  useFrame((_, delta) => {
    const g = root.current;
    if (!g) return;
    let hidden = false;
    if (car.ready) {
      _inv.copy(g.matrixWorld).invert();
      _cam.copy(camera.position).applyMatrix4(_inv);
      for (const dy of CAR_POINTS) {
        _pt.set(car.x, car.y + dy, car.z).applyMatrix4(_inv);
        const dist = _dir.subVectors(_pt, _cam).length();
        _ray.set(_cam, _dir.divideScalar(dist));
        if (_ray.intersectBox(bounds, _hit) && _hit.distanceTo(_cam) < dist) {
          hidden = true;
          break;
        }
      }
    }
    const target = hidden ? minOpacity : 1;
    if (opacity.current === target) return;
    let o = opacity.current + (target - opacity.current) * (1 - Math.exp(-Math.min(delta, 0.1) * 10));
    if (Math.abs(o - target) < 0.01) o = target;
    opacity.current = o;
    const transparent = o < 1;
    for (const m of mats.all) {
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = o;
    }
    for (const l of labels.current) {
      if (!l) continue;
      l.fillOpacity = o;
      l.outlineOpacity = o;
    }
  });

  return { lit: mats.lit, flat: mats.flat, label: setters };
}
