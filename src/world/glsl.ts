// GLSL snippets shared by the valley's shaders.

export const NOISE = /* glsl */ `
float vw_hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vw_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = vw_hash12(i);
  float b = vw_hash12(i + vec2(1.0, 0.0));
  float c = vw_hash12(i + vec2(0.0, 1.0));
  float d = vw_hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vw_fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vw_noise(p);
    p = p * 2.03 + vec2(17.1, -9.7);
    a *= 0.5;
  }
  return s / 0.875;
}
`;

// World (x, z) to screen (u, v) for the fixed 45 degree camera azimuth.
export const SCREEN = /* glsl */ `
vec2 vw_screen(vec3 w) { return vec2(0.70710678 * (w.x + w.z), 0.70710678 * (w.x - w.z)); }
`;

// Ordered 4x4 dither threshold for screen-door fades.
export const DITHER = /* glsl */ `
float vw_bayer(vec2 fc) {
  ivec2 p = ivec2(mod(fc, 4.0));
  int i = p.x + p.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[i] + 0.5) / 16.0;
}
`;
