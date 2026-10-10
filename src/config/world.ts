// World-wide constants and the mapping between screen space and world space.
// Plain math only (no three.js) so the HTML UI chunk can import it.

export const DEG = Math.PI / 180;

// Bruno-style camera: fixed azimuth and elevation, it never rotates with the car.
export const CAMERA = {
  azimuth: 45 * DEG,
  elevation: 45 * DEG,
  fov: 40,
  distance: 24,
  minDistance: 12,
  maxDistance: 48,
};

// Kenney kits are scaled relative to the jeep at 1x; the jeep is drawn at 1.5x (3.8 m), so every
// model's suggestedScale is multiplied by this.
export const WORLD_SCALE = 1.5;

// Ground directions (x, z) that point screen-right and screen-up (away from the camera).
export const SCREEN_RIGHT = { x: Math.cos(CAMERA.azimuth), z: Math.sin(CAMERA.azimuth) };
export const SCREEN_UP = { x: Math.sin(CAMERA.azimuth), z: -Math.cos(CAMERA.azimuth) };

// Rotation about Y that makes an object's +Z face the camera. A group rotated by this has
// local +X = screen right, local -Z = screen up, local +Z = towards the camera.
export const FACE_CAMERA_Y = -CAMERA.azimuth;

// Screen coordinates (u right, v up, metres on the ground) to world (x, z) and back.
export function screenToWorld(u: number, v: number): [number, number] {
  return [u * SCREEN_RIGHT.x + v * SCREEN_UP.x, u * SCREEN_RIGHT.z + v * SCREEN_UP.z];
}

export function worldToScreen(x: number, z: number): [number, number] {
  return [x * SCREEN_RIGHT.x + z * SCREEN_RIGHT.z, x * SCREEN_UP.x + z * SCREEN_UP.z];
}

// Yaw for the vehicle chassis (+X forward) so it points along a screen direction.
export function yawForScreenDir(du: number, dv: number): number {
  const x = du * SCREEN_RIGHT.x + dv * SCREEN_UP.x;
  const z = du * SCREEN_RIGHT.z + dv * SCREEN_UP.z;
  return Math.atan2(-z, x);
}

// Screen-space direction (du, dv) the chassis points at for a given yaw. Inverse of yawForScreenDir.
export function screenDirForYaw(yaw: number): [number, number] {
  const x = Math.cos(yaw);
  const z = -Math.sin(yaw);
  return worldToScreen(x, z);
}

export const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
export const DEBUG = params.has('debug'); // collider wireframes
export const INSPECT = params.has('inspect'); // window.__three for the harness
