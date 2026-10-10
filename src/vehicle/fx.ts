// Per-step data the vehicle hands to its effects (dust, skid marks). Written after each physics
// step, read in useFrame. Plain mutable state: no React updates.
export const wheelFx = {
  // Rear wheels (left, right): world contact point and whether the ray hit the ground.
  contact: [false, false],
  point: [new Float32Array(3), new Float32Array(3)],
  normalY: [1, 1],
  // Set to the landing speed (m/s) when the car lands from a jump; the dust module clears it.
  landing: 0,
};

export const REAR_WHEELS = [2, 3] as const; // indices into tuning WHEELS
