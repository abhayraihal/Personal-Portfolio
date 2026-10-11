import { use, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Quaternion, Shape, Vector3 } from 'three';
import type { Group, InstancedMesh, Mesh, MeshStandardMaterial } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { covid } from '../../../data/covid.ts';
import { car } from '../../../state/car.ts';
import { useStore } from '../../../state/store.ts';
import { carWithin, carX, carZ } from '../frame.ts';
import { mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';
import { Y } from '../Plaza.tsx';
import { covidSignal } from './signals.ts';
import { loadCanvasFonts, textWidth } from '../canvas.ts';
import { setLabelText } from './text.ts';
import type { TextMesh } from './text.ts';

// COVID-19 forecasting toy: the project's 612 days of daily new cases (covid.ts) as a 3D area
// chart on a board, split where the project splits them: training days teal, test days pink. The
// five lags the project compares are tiles in front of the board; the car on a tile picks that lag,
// and the chart lights the days before the cursor that an autoregression with that lag reads. The
// dark line is an autoregression fitted here by least squares on the training days and run one
// day ahead over the test days, the way the project's script walks forward; it is labelled as an
// illustration. Parked on the COVID pad, the cursor sweeps the timeline.

const D = covid.daily;
const N = D.length;
const TRAIN = N - Math.ceil(N * (1 - covid.trainShare)); // 397, as the script's math.ceil split
const LAGS = covid.lagsCompared;
const TOP = 400_000;
const X0 = -3.9; // chart area, toy-local
const X1 = 4.7;
const Y0 = 1.55;
const H = 3.0; // metres for TOP
const FACE = 0.01; // board face
const DEPTH = 0.3; // ribbon thickness
const FRONT = FACE + DEPTH;
const BOARD = { w: 10.0, y0: 0.45, h: 5.0, x: 0.15 };
const TAG_Y = Y0 + H + 0.24; // the cursor's date and value
const HEAD_Y = BOARD.y0 + BOARD.h - 0.32; // title and legend
const LEGEND = 'AR fit on the training days (illustration)';
const TILE = { w: 1.5, d: 1.7, gap: 0.3, z: 7.0 };
const SWEEP_S = 9;
const RANGE = 45;
const START = Date.UTC(2020, 0, 30);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayX = (i: number) => X0 + (i / (N - 1)) * (X1 - X0);
const valueY = (v: number) => (v / TOP) * H;
const DAY_W = (X1 - X0) / (N - 1);
const tileX = (k: number) => BOARD.x + (k - (LAGS.length - 1) / 2) * (TILE.w + TILE.gap);

function dayLabel(i: number) {
  const d = new Date(START + i * 86_400_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Day index of the first of each month from April 2020, every three months.
function quarterTicks() {
  const out: { i: number; label: string }[] = [];
  for (let i = 0; i < N; i++) {
    const d = new Date(START + i * 86_400_000);
    if (d.getUTCDate() === 1 && d.getUTCMonth() % 3 === 0) out.push({ i, label: MONTHS[d.getUTCMonth()] });
  }
  return out;
}
const TICKS = quarterTicks();
const NEW_YEAR = TICKS.find((t) => t.label === 'Jan')?.i ?? 337;

// Least squares for y[t] = c + a1 y[t-1] + ... + ap y[t-p] over the training days (Householder QR on
// values scaled to 1e5, so the columns stay well conditioned), then one-day-ahead predictions over
// the test days from the actual history, like the project's walk-forward loop.
function arFit(p: number): number[] {
  const s = 1e-5;
  const rows = TRAIN - p;
  const cols = p + 1;
  const A = new Float64Array(rows * cols);
  const b = new Float64Array(rows);
  for (let r = 0; r < rows; r++) {
    A[r * cols] = 1;
    for (let k = 1; k <= p; k++) A[r * cols + k] = D[r + p - k] * s;
    b[r] = D[r + p] * s;
  }
  const v = new Float64Array(rows);
  for (let j = 0; j < cols; j++) {
    let norm = 0;
    for (let r = j; r < rows; r++) norm += A[r * cols + j] ** 2;
    norm = Math.sqrt(norm);
    if (norm === 0) continue;
    const alpha = A[j * cols + j] > 0 ? -norm : norm;
    let vn = 0;
    for (let r = j; r < rows; r++) {
      v[r] = A[r * cols + j] - (r === j ? alpha : 0);
      vn += v[r] * v[r];
    }
    if (vn === 0) continue;
    for (let c = j; c < cols; c++) {
      let dot = 0;
      for (let r = j; r < rows; r++) dot += v[r] * A[r * cols + c];
      const f = (2 * dot) / vn;
      for (let r = j; r < rows; r++) A[r * cols + c] -= f * v[r];
    }
    let dot = 0;
    for (let r = j; r < rows; r++) dot += v[r] * b[r];
    const f = (2 * dot) / vn;
    for (let r = j; r < rows; r++) b[r] -= f * v[r];
  }
  const x = new Float64Array(cols);
  for (let j = cols - 1; j >= 0; j--) {
    let sum = b[j];
    for (let c = j + 1; c < cols; c++) sum -= A[j * cols + c] * x[c];
    x[j] = sum / A[j * cols + j];
  }
  const out: number[] = [];
  for (let t = TRAIN; t < N; t++) {
    let y = x[0] / s;
    for (let k = 1; k <= p; k++) y += x[k] * D[t - k];
    out.push(y);
  }
  return out;
}

// A flat strip along the predictions, just in front of the ribbon.
function lineGeometry(pred: number[]): BufferGeometry {
  const pos: number[] = [];
  const w = 0.028;
  for (let j = 0; j < pred.length - 1; j++) {
    const ax = dayX(TRAIN + j);
    const bx = dayX(TRAIN + j + 1);
    const ay = Y0 + valueY(Math.max(0, pred[j]));
    const by = Y0 + valueY(Math.max(0, pred[j + 1]));
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / len) * w;
    const ny = ((bx - ax) / len) * w;
    pos.push(ax - nx, ay - ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0, ax - nx, ay - ny, 0, bx + nx, by + ny, 0, ax + nx, ay + ny, 0);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return g;
}

function areaShape(i0: number, i1: number): Shape {
  const s = new Shape();
  s.moveTo(dayX(i0), 0);
  for (let i = i0; i <= i1; i++) s.lineTo(dayX(i), valueY(D[i]));
  s.lineTo(dayX(i1), 0);
  s.closePath();
  return s;
}

const TRAIN_COLOR = '#2f9fb0';
const TEST_COLOR = '#e2557f';

// Board, plinth, grid, axes, the ribbon and the split post, as one mesh.
function chartGeometry() {
  const ext = (sh: Shape) => new ExtrudeGeometry(sh, { depth: DEPTH, bevelEnabled: false, curveSegments: 1 });
  const splitX = (dayX(TRAIN - 1) + dayX(TRAIN)) / 2;
  const parts: Part[] = [
    { g: new BoxGeometry(BOARD.w + 0.3, BOARD.y0, 1.3), color: '#6f7286', at: [BOARD.x, BOARD.y0 / 2, 0.35] },
    { g: new BoxGeometry(BOARD.w, BOARD.h, 0.26), color: COLORS.paper, at: [BOARD.x, BOARD.y0 + BOARD.h / 2, FACE - 0.13] },
    { g: new BoxGeometry(BOARD.w + 0.12, 0.16, 0.34), color: '#2f9fb0', at: [BOARD.x, BOARD.y0 + BOARD.h + 0.08, FACE - 0.13] },
    // y axis and x axis
    { g: new BoxGeometry(0.05, H + 0.2, 0.03), color: COLORS.ink, at: [X0 - 0.06, Y0 + (H + 0.2) / 2 - 0.05, FACE + 0.015] },
    { g: new BoxGeometry(X1 - X0 + 0.12, 0.05, 0.03), color: COLORS.ink, at: [(X0 + X1) / 2, Y0 - 0.025, FACE + 0.015] },
    // the training and test days, and a post where the test days start
    { g: ext(areaShape(0, TRAIN - 1)), color: TRAIN_COLOR, at: [0, Y0, FACE] },
    { g: ext(areaShape(TRAIN, N - 1)), color: TEST_COLOR, at: [0, Y0, FACE] },
    { g: new BoxGeometry(0.05, H + 0.12, DEPTH + 0.06), color: COLORS.ink, at: [splitX, Y0 + (H + 0.12) / 2, FACE + DEPTH / 2] },
    // bars under the axis that carry the Train and Test labels
    { g: new BoxGeometry(splitX - X0 - 0.04, 0.34, 0.03), color: TRAIN_COLOR, at: [(X0 + splitX) / 2 - 0.02, Y0 - 0.27, FACE + 0.015] },
    { g: new BoxGeometry(X1 - splitX - 0.04, 0.34, 0.03), color: TEST_COLOR, at: [(splitX + X1) / 2 + 0.02, Y0 - 0.27, FACE + 0.015] },
  ];
  for (let k = 1; k <= 4; k++) parts.push({ g: new BoxGeometry(X1 - X0, 0.022, 0.01), color: '#e2d6c1', at: [(X0 + X1) / 2, Y0 + (k / 4) * H, FACE + 0.006] });
  for (const t of TICKS) parts.push({ g: new BoxGeometry(0.03, t.i === NEW_YEAR ? 0.95 : 0.16, 0.03), color: COLORS.ink, at: [dayX(t.i), Y0 - (t.i === NEW_YEAR ? 0.475 : 0.08), FACE + 0.02] });
  // the lag tiles' kerb
  parts.push({ g: new BoxGeometry(LAGS.length * (TILE.w + TILE.gap) + 0.2, 0.04, TILE.d + 0.3), color: '#9aa0b1', at: [BOARD.x, Y.paint, TILE.z] });
  return mergeParts(parts);
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const TILE_ON = new Color('#ffd23f');
const TILE_OFF = new Color('#2f6b7a');

export function CovidToy({ position }: { position: [number, number, number] }) {
  use(loadCanvasFonts());
  const tiles = useRef<InstancedMesh>(null);
  const cursor = useRef<Group>(null);
  const dot = useRef<Mesh>(null);
  const band = useRef<Mesh>(null);
  const lines = useRef<(Mesh | null)[]>([]);
  const board = useRef<MeshStandardMaterial>(null);
  const readout = useRef<TextMesh>(null);
  const bandLabel = useRef<TextMesh>(null);
  const readoutText = useRef(`${dayLabel(TRAIN)}: ${D[TRAIN].toLocaleString('en-US')}`);
  const bandText = useRef(`${LAGS[1]} days`);
  const geo = useMemo(() => ({ chart: chartGeometry(), lines: LAGS.map((p) => lineGeometry(arFit(p))) }), []);
  const st = useMemo(() => ({ lag: 1, day: TRAIN, t: -1, shown: -1, label: 0, glow: -1, tile: -1 }), []);

  const place = (day: number) => {
    const x = dayX(day);
    if (cursor.current) cursor.current.position.x = x;
    if (dot.current) dot.current.position.set(x, Y0 + valueY(D[day]), FRONT + 0.04);
    const p = LAGS[st.lag];
    // the p days before the cursor day
    const from = Math.max(0, day - p);
    const w = Math.max(0.06, (day - from) * DAY_W);
    if (band.current) {
      band.current.position.x = x - DAY_W / 2 - w / 2;
      band.current.scale.x = w;
    }
    const bl = bandLabel.current;
    if (bl) bl.position.x = x - DAY_W / 2 - w / 2;
    const r = readout.current;
    if (r) r.position.x = Math.max(X0 + 1.2, Math.min(X1 - 1.2, x));
  };

  const pickLag = (k: number) => {
    st.lag = k;
    lines.current.forEach((m, i) => {
      if (m) m.visible = i === k;
    });
    setLabelText(bandLabel.current, bandText, LAGS[k] === 1 ? '1 day' : `${LAGS[k]} days`);
    const m = tiles.current;
    if (m) {
      for (let i = 0; i < LAGS.length; i++) m.setColorAt(i, i === k ? TILE_ON : TILE_OFF);
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    place(st.day);
  };

  useLayoutEffect(() => {
    const m = tiles.current;
    if (m) {
      for (let i = 0; i < LAGS.length; i++) m.setMatrixAt(i, _m.compose(_p.set(tileX(i), Y.paint + 0.025, TILE.z), _q.identity(), _s.setScalar(1)));
      m.instanceMatrix.needsUpdate = true;
    }
    pickLag(st.lag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const store = useStore.getState();
    const glow = store.night ? 0.42 : 0;
    if (glow !== st.glow && board.current) {
      st.glow = glow;
      board.current.emissiveIntensity = glow;
    }
    if (!carWithin(position[0], position[2] + 4, RANGE)) return;
    const dt = Math.min(delta, 0.05);

    // the car on a lag tile picks that lag
    const cx = carX() - position[0];
    const cz = carZ() - position[2];
    let tile = -1;
    if (car.ready && Math.abs(cz - TILE.z) < TILE.d / 2 + 0.2) {
      for (let k = 0; k < LAGS.length; k++) if (Math.abs(cx - tileX(k)) < TILE.w / 2 + TILE.gap / 2) tile = k;
    }
    if (tile !== st.tile) {
      st.tile = tile;
      if (tile >= 0 && tile !== st.lag) pickLag(tile);
    }

    // parked on the pad: the cursor sweeps from the first day that has a full lag window to the
    // end, holds, then starts again; otherwise it rests on the first test day
    let day = TRAIN;
    if (covidSignal.parked && !store.reducedMotion) {
      st.t = st.t < 0 ? 0 : st.t + dt;
      const k = (st.t % (SWEEP_S + 1.6)) / SWEEP_S;
      const first = LAGS[LAGS.length - 1];
      day = Math.min(N - 1, Math.round(first + Math.min(1, k) * (N - 1 - first)));
    } else st.t = -1;
    if (day !== st.day) {
      st.day = day;
      place(day);
    }
    // the readout changes a few times a second at most, so the text is not laid out every frame
    st.label -= dt;
    if (st.label <= 0 && st.shown !== st.day) {
      st.label = 0.12;
      st.shown = st.day;
      setLabelText(readout.current, readoutText, `${dayLabel(st.day)}: ${D[st.day].toLocaleString('en-US')}`);
    }
  });

  const splitX = (dayX(TRAIN - 1) + dayX(TRAIN)) / 2;
  const legendW = useMemo(() => textWidth(LEGEND, 'body', 0.21), []);
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[BOARD.w / 2 + 0.15, (BOARD.y0 + BOARD.h) / 2, 0.45]} position={[BOARD.x, (BOARD.y0 + BOARD.h) / 2, 0.05]} />
      </RigidBody>
      <mesh geometry={geo.chart} castShadow receiveShadow>
        <meshStandardMaterial ref={board} vertexColors roughness={0.85} emissive={COLORS.paper} emissiveIntensity={0} />
      </mesh>
      {geo.lines.map((g, i) => (
        <mesh key={LAGS[i]} ref={(m) => void (lines.current[i] = m)} geometry={g} position={[0, 0, FRONT + 0.012]} visible={i === st.lag}>
          <meshBasicMaterial color={COLORS.ink} toneMapped={false} />
        </mesh>
      ))}
      {/* the days an autoregression with the chosen lag reads before the cursor day */}
      <mesh ref={band} position={[0, Y0 + H / 2, FRONT + 0.006]}>
        <planeGeometry args={[1, H]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.45} depthWrite={false} toneMapped={false} />
      </mesh>
      <Label ref={bandLabel} font="bodyBold" size={0.22} color={COLORS.ink} anchorY="top" outlineWidth="12%" outlineColor={COLORS.paper}
        position={[0, Y0 + H - 0.06, FRONT + 0.02]}>
        {bandText.current}
      </Label>
      <group ref={cursor} position={[dayX(TRAIN), 0, 0]}>
        <mesh position={[0, Y0 + H / 2 + 0.05, FRONT + 0.03]}>
          <boxGeometry args={[0.05, H + 0.1, 0.04]} />
          <meshBasicMaterial color="#ffb21a" toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={dot}>
        <sphereGeometry args={[0.1, 14, 10]} />
        <meshBasicMaterial color={COLORS.ink} toneMapped={false} />
      </mesh>
      <Label ref={readout} font="bodyBold" size={0.24} color={COLORS.ink} position={[dayX(TRAIN), TAG_Y, FACE + 0.01]}>
        {readoutText.current}
      </Label>
      <Label font="display" size={0.36} color={COLORS.ink} anchorX="left" position={[X0 - 0.7, HEAD_Y, FACE + 0.01]}>
        Daily new cases
      </Label>
      <Label font="body" size={0.21} color={COLORS.inkSoft} anchorX="right" position={[X1, HEAD_Y, FACE + 0.01]}>
        {LEGEND}
      </Label>
      <mesh position={[X1 - legendW - 0.32, HEAD_Y, FACE + 0.012]}>
        <planeGeometry args={[0.4, 0.056]} />
        <meshBasicMaterial color={COLORS.ink} toneMapped={false} />
      </mesh>
      <Label font="bodyBold" size={0.24} color={COLORS.inkSoft} anchorX="right" lineHeight={(H / 4) / 0.24} position={[X0 - 0.16, Y0 + H / 2, FACE + 0.01]}>
        {'400k\n300k\n200k\n100k\n0'}
      </Label>
      <Label font="bodyBold" size={0.22} color={COLORS.paper} position={[(X0 + splitX) / 2, Y0 - 0.27, FACE + 0.035]}>
        Train 65%
      </Label>
      <Label font="bodyBold" size={0.22} color={COLORS.paper} position={[(splitX + X1) / 2, Y0 - 0.27, FACE + 0.035]}>
        Test 35%
      </Label>
      {TICKS.map((t) => (
        <Label key={t.i} font="body" size={0.22} color={COLORS.inkSoft} position={[dayX(t.i), Y0 - 0.62, FACE + 0.01]}>
          {t.label}
        </Label>
      ))}
      <Label font="bodyBold" size={0.24} color={COLORS.ink} position={[(dayX(0) + dayX(NEW_YEAR)) / 2, Y0 - 0.95, FACE + 0.01]}>
        2020
      </Label>
      <Label font="bodyBold" size={0.24} color={COLORS.ink} position={[(dayX(NEW_YEAR) + dayX(N - 1)) / 2, Y0 - 0.95, FACE + 0.01]}>
        2021
      </Label>
      <instancedMesh ref={tiles} args={[undefined, undefined, LAGS.length]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[TILE.w, 0.02, TILE.d]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      {LAGS.map((p, k) => (
        <Label key={p} flat font="display" size={0.72} color={COLORS.paper} position={[tileX(k), Y.paint + 0.04, TILE.z]}>
          {String(p)}
        </Label>
      ))}
      <Label flat font="bodyBold" size={0.42} color={COLORS.inkSoft} anchorX="right" position={[tileX(0) - TILE.w / 2 - 0.35, Y.paint + 0.004, TILE.z]}>
        Lag
      </Label>
    </group>
  );
}
