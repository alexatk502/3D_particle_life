import init, { Simulation } from "./pkg/particle_life.js";

const BOX = 600;          // world side length (matches box_size passed to Sim)
const DIMS = 3;           // 2 or 3 — physics core is N-dim
const NUM_TYPES = 10;
const PARTICLE_R = 3;

// --- 3D camera ---
// yaw   = rotation about world y-axis (turns left/right)
// pitch = rotation about world x-axis after yaw (tilts up/down)
// zoom  = multiplicative scale on top of the fit-to-viewport base.
let yaw = 0.5, pitch = 0.35, zoom = 1.0;
let cosY = 1, sinY = 0, cosP = 1, sinP = 0;
function updateCameraTrig() {
  cosY = Math.cos(yaw); sinY = Math.sin(yaw);
  cosP = Math.cos(pitch); sinP = Math.sin(pitch);
}
// Distance from cube center to virtual camera along its view axis.
// Must exceed the cube's half body-diagonal (BOX*sqrt(3)/2) to keep all particles in
// front of the camera; BOX*2.0 has comfortable margin and reads as a moderate FOV.
const CAM_DIST = BOX * 2.0;

// Returns [screenX, screenY, perspScale]. perspScale doubles as a depth indicator:
// >1 = closer than cube center, <1 = farther. Use it to scale particle radii.
function project(x, y, z) {
  // translate to cube center
  const tx = x - BOX / 2;
  const ty = y - BOX / 2;
  const tz = z - BOX / 2;
  // yaw around y
  const x1 =  tx * cosY + tz * sinY;
  const z1 = -tx * sinY + tz * cosY;
  // pitch around x (after yaw)
  const y2 = ty * cosP - z1 * sinP;
  const z2 = ty * sinP + z1 * cosP;
  // Perspective divide: things farther from camera (larger z2) shrink.
  const persp = CAM_DIST / (CAM_DIST + z2);
  const s = viewScale * zoom * persp;
  return [viewOx + x1 * s, viewOy + y2 * s, persp];
}

// Distinct colors for 10 kinds.
const COLORS = [
  "#ff5577", "#ff9933", "#ffdd33", "#aaff33", "#33ff77",
  "#33ffdd", "#33aaff", "#5566ff", "#aa55ff", "#ff55cc",
];

const cv = document.getElementById("canvas");
const ctx = cv.getContext("2d");
const matCv = document.getElementById("matrix");
const matCtx = matCv.getContext("2d");

let sim, memF32, memU8;
let viewScale = 1, viewOx = 0, viewOy = 0;

function resizeCanvas() {
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
  if (DIMS === 3) {
    // Cube face-diagonal = BOX*sqrt(2); this fits most rotations without clipping.
    // (Body-diagonal would be sqrt(3), but reserving that much space leaves the cube
    // looking tiny most of the time. Corner-on views may clip — zoom out if needed.)
    const maxExtent = BOX * Math.SQRT2;
    viewScale = Math.min(cv.width, cv.height) / maxExtent * 0.95;
    viewOx = cv.width / 2;
    viewOy = cv.height / 2;
  } else {
    viewScale = Math.min(cv.width, cv.height) * 0.95 / BOX;
    viewOx = cv.width  / 2 - BOX * viewScale / 2;
    viewOy = cv.height / 2 - BOX * viewScale / 2;
  }
}
window.addEventListener("resize", resizeCanvas);

// --- WASD rotation + mouse-wheel zoom ---
const keys = Object.create(null);
window.addEventListener("keydown", e => {
  // Don't grab keys when the user is typing in an input.
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
// Last time the camera changed; render uses this to disable motion-trail fade while moving.
let cameraDirtyT = 0;
cv.addEventListener("wheel", e => {
  zoom *= Math.exp(-e.deltaY * 0.0015);
  zoom = Math.max(0.2, Math.min(8, zoom));
  cameraDirtyT = performance.now();
  e.preventDefault();
}, { passive: false });

const ROT_RATE = 1.6; // rad/sec
function updateCamera(dtSec) {
  let moved = false;
  if (keys["a"] || keys["arrowleft"])  { yaw   -= ROT_RATE * dtSec; moved = true; }
  if (keys["d"] || keys["arrowright"]) { yaw   += ROT_RATE * dtSec; moved = true; }
  if (keys["w"] || keys["arrowup"])    { pitch += ROT_RATE * dtSec; moved = true; }
  if (keys["s"] || keys["arrowdown"])  { pitch -= ROT_RATE * dtSec; moved = true; }
  // Clamp pitch so the camera never flips through poles.
  const lim = Math.PI / 2 - 0.05;
  if (pitch >  lim) pitch =  lim;
  if (pitch < -lim) pitch = -lim;
  if (moved) cameraDirtyT = performance.now();
  updateCameraTrig();
}
function cameraIsMoving() {
  // Treat the camera as "moving" for a short tail after the last input so trails clear
  // cleanly even when keys are tapped briefly.
  return performance.now() - cameraDirtyT < 120;
}

function rebuild(count, seed) {
  sim = new Simulation(DIMS, count, BOX, BigInt(seed));
  drawMatrix();
}

let _wasm;
// WASM linear memory can grow (on Sim construction or first step alloc of scratch buffers),
// which detaches any prior Float32Array/Uint8Array view. Build fresh views per access —
// the constructor is cheap (just wraps the current buffer).
function f32() { return new Float32Array(_wasm.memory.buffer); }
function u8()  { return new Uint8Array(_wasm.memory.buffer); }

function drawMatrix() {
  const cell = matCv.width / NUM_TYPES;
  const mPtr = sim.matrix_ptr() / 4;
  const m = f32().subarray(mPtr, mPtr + NUM_TYPES * NUM_TYPES);
  for (let i = 0; i < NUM_TYPES; i++) {
    for (let j = 0; j < NUM_TYPES; j++) {
      const v = m[i * NUM_TYPES + j]; // -1..1
      const r = v < 0 ? Math.round(40 + -v * 215) : 20;
      const g = v > 0 ? Math.round(40 +  v * 215) : 20;
      matCtx.fillStyle = `rgb(${r},${g},20)`;
      matCtx.fillRect(j * cell, i * cell, cell, cell);
    }
  }
  // row tint = source color
  for (let i = 0; i < NUM_TYPES; i++) {
    matCtx.fillStyle = COLORS[i];
    matCtx.fillRect(-4, i * cell + cell / 2 - 1, 3, 3);
  }
}

// Click-drag on matrix to set values: left=attract, right=repel.
let dragging = null;
matCv.addEventListener("mousedown", e => { dragging = e.button === 2 ? -1 : 1; editMatrix(e); });
matCv.addEventListener("mousemove", e => { if (dragging !== null) editMatrix(e); });
window.addEventListener("mouseup", () => dragging = null);
matCv.addEventListener("contextmenu", e => e.preventDefault());

function editMatrix(e) {
  const rect = matCv.getBoundingClientRect();
  const cell = matCv.width / NUM_TYPES;
  const j = Math.floor((e.clientX - rect.left) / cell);
  const i = Math.floor((e.clientY - rect.top)  / cell);
  if (i < 0 || i >= NUM_TYPES || j < 0 || j >= NUM_TYPES) return;
  const mPtr = sim.matrix_ptr() / 4;
  const cur = f32()[mPtr + i * NUM_TYPES + j];
  const next = Math.max(-1, Math.min(1, cur + dragging * 0.15));
  sim.set_matrix_entry(i, j, next);
  drawMatrix();
}

// Flat-tier LOD: cheap Path2D per (kind, tier), batched fills.
const PATHS_RECT   = Array.from({ length: NUM_TYPES }, () => new Path2D());
const PATHS_CIRCLE = Array.from({ length: NUM_TYPES }, () => new Path2D());
// Bloom tier: per-kind flat array of (px, py, r) triples, drawn with sprite blits.
const BLOOM_LIST   = Array.from({ length: NUM_TYPES }, () => []);

// Pre-rendered glow sprite per kind. Radial gradient: opaque bright center, fading
// to transparent edge — gives a bright core + soft halo when blitted. Built once at
// startup; per-frame cost is just drawImage, no shadowBlur.
const SPRITE_SIZE = 64;
const SPRITES = COLORS.map(c => {
  const off = document.createElement("canvas");
  off.width = off.height = SPRITE_SIZE;
  const octx = off.getContext("2d");
  const cx = SPRITE_SIZE / 2;
  const grad = octx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  // #RRGGBBAA hex (modern canvas accepts 8-digit hex).
  grad.addColorStop(0.00, c + "ff");
  grad.addColorStop(0.18, c + "cc");
  grad.addColorStop(0.45, c + "55");
  grad.addColorStop(1.00, c + "00");
  octx.fillStyle = grad;
  octx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return off;
});

// LOD radius thresholds, in screen pixels (after perspective).
const LOD_RECT  = 1.2;  // below: 1px rect
const LOD_CIRC  = 3.0;  // below: plain circle, no bloom
// At/above LOD_CIRC: sprite blit (bloom). Halo size relative to particle radius.
const BLOOM_HALO = 2.6;

// 12 edges of the unit cube as pairs of corner indices.
const CUBE_CORNERS = [
  [0,0,0],[1,0,0],[1,1,0],[0,1,0],
  [0,0,1],[1,0,1],[1,1,1],[0,1,1],
];
const CUBE_EDGES = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7],
];

function drawCubeWireframe() {
  ctx.strokeStyle = "#2a2a3a";
  ctx.beginPath();
  for (const [a, b] of CUBE_EDGES) {
    const [ax, ay, az] = CUBE_CORNERS[a];
    const [bx, by, bz] = CUBE_CORNERS[b];
    const pa = project(ax * BOX, ay * BOX, az * BOX);
    const pb = project(bx * BOX, by * BOX, bz * BOX);
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);
  }
  ctx.stroke();
}

function render() {
  // Solid clear while the camera is moving so old projections don't smear into trails.
  ctx.fillStyle = cameraIsMoving() ? "#0a0a0f" : "rgba(10, 10, 15, 0.35)";
  ctx.fillRect(0, 0, cv.width, cv.height);

  if (DIMS === 3) {
    drawCubeWireframe();
  } else {
    ctx.strokeStyle = "#222230";
    ctx.strokeRect(viewOx, viewOy, BOX * viewScale, BOX * viewScale);
  }

  const n = sim.n();
  const d = sim.dims();
  const pPtr = sim.positions_ptr() / 4;
  const kPtr = sim.kinds_ptr();
  const dPtr = sim.density_ptr() / 4;
  const pos = f32().subarray(pPtr, pPtr + n * d);
  const kind = u8().subarray(kPtr, kPtr + n);
  const density = f32().subarray(dPtr, dPtr + n);
  // Mean for normalization. Cached on sim side as well, but JS recompute is trivial.
  const meanDensity = sim.mean_density() || 1.0;

  const r0 = Math.max(1.0, PARTICLE_R * viewScale * zoom * 0.5);
  const TWO_PI = Math.PI * 2;

  for (let i = 0; i < NUM_TYPES; i++) {
    PATHS_RECT[i]   = new Path2D();
    PATHS_CIRCLE[i] = new Path2D();
    BLOOM_LIST[i].length = 0;
  }

  if (d === 3) {
    const invMeanD = 1.0 / meanDensity;
    for (let i = 0; i < n; i++) {
      const k = kind[i];
      const p = project(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      // density factor: cube-root of (ρ/ρ̄) keeps the visual change gentle.
      const dF = Math.max(0.6, Math.min(1.9, Math.cbrt(density[i] * invMeanD)));
      const r = r0 * p[2] * dF;
      const px = p[0], py = p[1];
      if (r < LOD_RECT) {
        const sz = Math.max(1, r * 1.6);
        PATHS_RECT[k].rect(px - sz * 0.5, py - sz * 0.5, sz, sz);
      } else if (r < LOD_CIRC) {
        PATHS_CIRCLE[k].moveTo(px + r, py);
        PATHS_CIRCLE[k].arc(px, py, r, 0, TWO_PI);
      } else {
        const list = BLOOM_LIST[k];
        list.push(px, py, r);
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const k = kind[i];
      const sx = viewOx + pos[i * 2]     * viewScale;
      const sy = viewOy + pos[i * 2 + 1] * viewScale;
      BLOOM_LIST[k].push(sx, sy, r0);
    }
  }

  // Pass 1: flat tiers — solid fills.
  for (let k = 0; k < NUM_TYPES; k++) {
    ctx.fillStyle = COLORS[k];
    ctx.fill(PATHS_RECT[k]);
    ctx.fill(PATHS_CIRCLE[k]);
  }

  // Pass 2: bloom tier — additive sprite blits. Pre-rendered radial gradient already
  // carries the bright-center + soft-halo look, so no shadowBlur or extra highlight pass.
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < NUM_TYPES; k++) {
    const list = BLOOM_LIST[k];
    const sprite = SPRITES[k];
    for (let j = 0; j < list.length; j += 3) {
      const px = list[j], py = list[j + 1], r = list[j + 2];
      const sr = r * BLOOM_HALO;
      ctx.drawImage(sprite, px - sr, py - sr, sr * 2, sr * 2);
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

// --- UI wiring ---
const $ = id => document.getElementById(id);
function bindRange(id, valId, fn) {
  const el = $(id), out = $(valId);
  el.addEventListener("input", () => { out.textContent = el.value; fn(parseFloat(el.value)); });
}

let lastFpsT = performance.now(), frames = 0;
let lastFrameT = performance.now();
let physAccum = 0, renderAccum = 0;
function loop(t) {
  const dtSec = Math.min(0.1, (t - lastFrameT) / 1000);
  lastFrameT = t;
  updateCamera(dtSec);

  const t0 = performance.now();
  sim.step();
  const t1 = performance.now();
  render();
  const t2 = performance.now();

  physAccum   += t1 - t0;
  renderAccum += t2 - t1;
  frames++;
  if (t - lastFpsT > 500) {
    $("fps").textContent      = Math.round(frames * 1000 / (t - lastFpsT));
    $("physMs").textContent   = (physAccum / frames).toFixed(2);
    $("renderMs").textContent = (renderAccum / frames).toFixed(2);
    $("momentum").textContent = sim.total_momentum().toExponential(2);
    $("meanDensity").textContent = sim.mean_density().toExponential(2);
    frames = 0; physAccum = 0; renderAccum = 0; lastFpsT = t;
  }
  requestAnimationFrame(loop);
}

async function main() {
  _wasm = await init();
  resizeCanvas();
  updateCameraTrig();
  rebuild(parseInt($("count").value), Date.now());

  bindRange("friction", "frictionVal", v => sim.set_friction(v));
  bindRange("force",    "forceVal",    v => sim.set_force_scale(v));
  bindRange("rmax",     "rmaxVal",     v => sim.set_r_max(v));
  bindRange("dt",       "dtVal",       v => sim.set_dt(v));
  bindRange("pressure",  "pressureVal",  v => sim.set_pressure_scale(v));
  bindRange("viscosity", "viscosityVal", v => sim.set_viscosity(v));
  bindRange("gravity",   "gravityVal",   v => sim.set_gravity(0, v, 0));
  $("recalibRest").addEventListener("click", () => sim.recalibrate_rest());
  $("walls").addEventListener("change", e => sim.set_walls(e.target.checked));
  $("conserveMomentum").addEventListener("change", e => sim.set_conserve_momentum(e.target.checked));

  $("reset").addEventListener("click", () => rebuild(parseInt($("count").value), Date.now()));
  $("rerollMatrix").addEventListener("click", () => {
    sim.randomize_matrix(BigInt(Date.now()));
    drawMatrix();
  });

  requestAnimationFrame(loop);
}
main();
