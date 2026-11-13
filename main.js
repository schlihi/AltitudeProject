import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  WGS84, geodeticToThree, geodeticNormalThree, buildGlobeArrays, buildDrapedSegments,
  graticulePolylines, geojsonPolylines, divergingColor, DIVERGING,
} from './geodesy.js';

// ---------------------------------------------------------------- settings
const params = new URLSearchParams(location.search);
const DATA = params.get('data') || 'data/';
const K_MAX = 10000;                 // must match the kHi used for aNormalHi
const K_STOPS = [1, 10, 100, 1000, 10000];
const VMAX = 110;                    // colormap clamp (m), symmetric
const FADE_K = [100, 316];           // k range where the ellipsoid fill fades in and the graticule settles onto h = 0
const FILL_OPACITY = 0.14;
const LIFT = 5e-5;                   // ~320 m in radii: keeps draped lines above their surface
const TWEEN_S = 1.2;

const uK = { value: 1 };
const uGratLift = { value: 0 };
const uCoastLift = { value: LIFT };

const $ = (id) => document.getElementById(id);
const status = (msg, isError = false) => {
  $('status').textContent = msg;
  $('status').className = isError ? 'error' : '';
  $('status').hidden = !msg;
};

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x0b0e14);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 100);
camera.position.set(0, 0, 3.6);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xffffff, 0x30343c, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(-2, 2, 3);          // child of the camera: lighting follows the view
camera.add(key);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.25;
controls.maxDistance = 8;
controls.rotateSpeed = 0.6;

// Shift the globe right of the control panel (and back to centre when the panel is hidden).
function frame() {
  camera.aspect = innerWidth / innerHeight;
  const shift = document.getElementById('ui').hidden ? 0 : Math.min(230, innerWidth * 0.16);
  camera.setViewOffset(innerWidth, innerHeight, -shift, 0, innerWidth, innerHeight);
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', frame);
frame();

// ---------------------------------------------------------------- materials
/** Patch a line/points material so vertices move to position + aDir * (aN * uK + uLift). */
function draped(material, liftUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uK = uK;
    shader.uniforms.uLift = liftUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aDir; attribute float aN; uniform float uK; uniform float uLift;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = position + aDir * (aN * uK + uLift);');
  };
  return material;
}

function geoidMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uK = uK;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aN; attribute vec3 aNormalHi; uniform float uK;`)
      // Blend toward the precomputed normal of the K_MAX surface so shading tracks the bumps.
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = normalize(mix(normal, aNormalHi, clamp((uK - 1.0) / ${(K_MAX - 1).toFixed(1)}, 0.0, 1.0)));`)
      // Displace along the ellipsoid normal: geoid height is measured along it.
      .replace('#include <begin_vertex>', 'vec3 transformed = position + normal * aN * uK;');
  };
  return m;
}

function segmentsGeometry({ position, aDir, aN }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));
  g.setAttribute('aN', new THREE.BufferAttribute(aN, 1));
  return g;
}

// ---------------------------------------------------------------- data loading
async function loadGrid() {
  const metaRes = await fetch(DATA + 'geoid.json');
  if (!metaRes.ok) throw new Error(`Could not load ${DATA}geoid.json (${metaRes.status}). Run preprocess_geoid.py first, and serve this folder over HTTP.`);
  const meta = await metaRes.json();
  const binRes = await fetch(DATA + 'geoid_f32.bin');
  if (!binRes.ok) throw new Error(`Could not load ${DATA}geoid_f32.bin (${binRes.status}).`);
  const data = new Float32Array(await binRes.arrayBuffer());
  if (data.length !== meta.nlat * meta.nlon) throw new Error(`geoid_f32.bin has ${data.length} values; expected ${meta.nlat}x${meta.nlon}.`);
  return { ...meta, data };
}

async function loadCoastlines() {
  try {
    const res = await fetch(DATA + 'ne_110m_coastline.geojson');
    if (!res.ok) return null;
    return geojsonPolylines(await res.json());
  } catch { return null; }
}

// ---------------------------------------------------------------- build scene
const layers = {};
let grid, maxAbsRel = 0;

async function init() {
  status('Loading geoid grid…');
  grid = await loadGrid();
  for (const v of grid.data) maxAbsRel = Math.max(maxAbsRel, Math.abs(v));
  maxAbsRel /= WGS84.a;

  status('Building mesh…');
  await new Promise(requestAnimationFrame);
  const g = buildGlobeArrays(grid, K_MAX);

  const colors = new Float32Array(g.aN.length * 3);
  const c = new THREE.Color();
  for (let v = 0; v < grid.data.length; v++) {
    const [r, gg, b] = divergingColor(grid.data[v], VMAX);
    c.setRGB(r, gg, b, THREE.SRGBColorSpace);            // converted to linear for rendering
    colors[3 * v] = c.r; colors[3 * v + 1] = c.g; colors[3 * v + 2] = c.b;
  }

  const pos = new THREE.BufferAttribute(g.position, 3);
  const nrm = new THREE.BufferAttribute(g.normal, 3);
  const idx = new THREE.BufferAttribute(g.index, 1);

  // Geoid: opaque, colour = N, displaced in the vertex shader.
  const geoidGeom = new THREE.BufferGeometry();
  geoidGeom.setAttribute('position', pos);
  geoidGeom.setAttribute('normal', nrm);
  geoidGeom.setAttribute('aN', new THREE.BufferAttribute(g.aN, 1));
  geoidGeom.setAttribute('aNormalHi', new THREE.BufferAttribute(g.aNormalHi, 3));
  geoidGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geoidGeom.setIndex(idx);
  layers.geoid = new THREE.Mesh(geoidGeom, geoidMaterial());
  layers.geoid.frustumCulled = false;                    // bounds grow with k
  scene.add(layers.geoid);

  // Ellipsoid fill: same vertices, undisplaced. No depth writes, drawn after the geoid, so it
  // only tints where the ellipsoid lies outside the geoid (N < 0).
  const fillGeom = new THREE.BufferGeometry();
  fillGeom.setAttribute('position', pos);
  fillGeom.setAttribute('normal', nrm);
  fillGeom.setIndex(idx);
  layers.fill = new THREE.Mesh(fillGeom, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
  }));
  layers.fill.renderOrder = 2;
  layers.fill.frustumCulled = false;
  scene.add(layers.fill);

  // Graticule on the ellipsoid (h = 0); lifted above everything at low k to avoid z-fighting.
  layers.graticule = new THREE.LineSegments(
    segmentsGeometry(buildDrapedSegments(graticulePolylines(15, 1), null)),
    draped(new THREE.LineBasicMaterial({ color: 0xdfe6f0, transparent: true, opacity: 0.55 }), uGratLift),
  );
  layers.graticule.renderOrder = 1;
  layers.graticule.frustumCulled = false;
  scene.add(layers.graticule);

  // Coastlines draped on the geoid (optional file).
  const coast = await loadCoastlines();
  if (coast) {
    layers.coast = new THREE.LineSegments(
      segmentsGeometry(buildDrapedSegments(coast, grid, 1)),
      draped(new THREE.LineBasicMaterial({ color: 0x111418, transparent: true, opacity: 0.85 }), uCoastLift),
    );
    layers.coast.renderOrder = 1;
    layers.coast.frustumCulled = false;
    scene.add(layers.coast);
  } else {
    $('t-coast').disabled = true;
    $('t-coast').parentElement.title = `Add ${DATA}ne_110m_coastline.geojson to show coastlines`;
  }

  // Points of interest, draped on the geoid, with HTML labels.
  const pois = Object.entries(grid.poi || {}).map(([name, p]) => ({ name, ...p }));
  if (pois.length) {
    const segs = buildDrapedSegments(pois.map((p) => [[p.lon, p.lat], [p.lon, p.lat]]), grid, 1);
    const pg = segmentsGeometry(segs);
    layers.poi = new THREE.Points(pg, draped(new THREE.PointsMaterial({ color: 0xffffff, size: 7, sizeAttenuation: false }), uCoastLift));
    layers.poi.frustumCulled = false;
    scene.add(layers.poi);
    for (const p of pois) {
      const el = document.createElement('div');
      el.className = 'poi-label';
      el.textContent = p.name;
      document.body.appendChild(el);
      p.el = el;
      p.base = new THREE.Vector3(...geodeticToThree(p.lat, p.lon));
      p.dir = new THREE.Vector3(...geodeticNormalThree(p.lat, p.lon));
      p.rel = sampleRel(p);
    }
  }
  layers.pois = pois;

  buildUI();
  setT(0);
  flyTo('global', 0);
  status('');
}

function sampleRel(p) { return (p.N ?? 0) / WGS84.a; }

// ---------------------------------------------------------------- exaggeration state
let t = 0;                          // slider position 0..1, k = 10^(4t)
const kOf = (tt) => Math.pow(10, 4 * tt);
const tOf = (k) => Math.log10(k) / 4;
const smoothstep = (a, b, x) => { const u = Math.min(Math.max((x - a) / (b - a), 0), 1); return u * u * (3 - 2 * u); };

function setT(tt) {
  t = Math.min(Math.max(tt, 0), 1);
  const k = kOf(t);
  uK.value = k;
  const fade = smoothstep(Math.log10(FADE_K[0]), Math.log10(FADE_K[1]), Math.log10(k));
  layers.fill.material.opacity = FILL_OPACITY * fade;
  layers.fill.visible = $('t-fill').checked && fade > 0.001;
  uGratLift.value = (1 - fade) * (maxAbsRel * k + LIFT);
  $('slider').value = t;
  updateReadout(k);
}

const MINUS = '−';
const fmtSigned = (x, d = 0) => (x < 0 ? MINUS : '+') + Math.abs(x).toLocaleString(undefined, { maximumFractionDigits: d });
const fmtLen = (m) => (Math.abs(m) >= 1000 ? `${fmtSigned(m / 1000, Math.abs(m) >= 1e4 ? 0 : 1)} km` : `${fmtSigned(m, 0)} m`);

function updateReadout(k) {
  const kTxt = k < 9.95 ? k.toFixed(1) : Math.round(k).toLocaleString();
  $('k-value').textContent = `${kTxt}×`;
  const lo = grid.min.value, hi = grid.max.value;
  $('k-detail').textContent = `Geoid heights ${fmtLen(lo)} to ${fmtLen(hi)} drawn as ${fmtLen(lo * k)} to ${fmtLen(hi * k)}`;
  document.querySelectorAll('#stops button').forEach((b) => b.classList.toggle('on', Math.abs(Number(b.dataset.k) - k) / k < 0.01));
}

// ---------------------------------------------------------------- tweens
let kTween = null, camTween = null;
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function animateToK(k) {
  kTween = { from: t, to: tOf(k), t0: performance.now(), dur: TWEEN_S * 1000 };
}

const PRESETS = () => ({
  global: { lat: 15, lon: 70, dist: 3.6 },
  low: { lat: grid.min.lat, lon: grid.min.lon, dist: 3.0 },
  high: { lat: grid.max.lat, lon: grid.max.lon, dist: 3.0 },
  ...(grid.poi?.['Mountain View'] ? { mv: { lat: grid.poi['Mountain View'].lat, lon: grid.poi['Mountain View'].lon, dist: 3.0 } } : {}),
});

function flyTo(name, dur = TWEEN_S) {
  const p = PRESETS()[name];
  if (!p) return;
  const dir = new THREE.Vector3(...geodeticNormalThree(p.lat, p.lon));
  const to = dir.multiplyScalar(p.dist);
  if (dur === 0) { camera.position.copy(to); controls.update(); return; }
  camTween = { from: camera.position.clone(), to, t0: performance.now(), dur: dur * 1000 };
}

function stepTweens(now) {
  if (kTween) {
    const u = Math.min((now - kTween.t0) / kTween.dur, 1);
    setT(kTween.from + (kTween.to - kTween.from) * ease(u));
    if (u >= 1) kTween = null;
  }
  if (camTween) {
    const u = ease(Math.min((now - camTween.t0) / camTween.dur, 1));
    const r = camTween.from.length() + (camTween.to.length() - camTween.from.length()) * u;
    const d = camTween.from.clone().normalize().lerp(camTween.to.clone().normalize(), u);
    if (d.lengthSq() < 1e-6) d.set(0, 1, 0);
    camera.position.copy(d.normalize().multiplyScalar(r));
    if (u >= 1) camTween = null;
  }
}

// ---------------------------------------------------------------- UI
function buildUI() {
  const synthetic = /synthetic/i.test(grid.model || '');
  $('model').textContent = grid.model || 'unknown model';
  $('model').classList.toggle('warn', synthetic);

  $('slider').addEventListener('input', (e) => { kTween = null; setT(Number(e.target.value)); });
  const stops = $('stops');
  K_STOPS.forEach((k, i) => {
    const b = document.createElement('button');
    b.dataset.k = k;
    b.textContent = `${k.toLocaleString()}×`;
    b.title = `Key ${i + 1}`;
    b.addEventListener('click', () => animateToK(k));
    stops.appendChild(b);
  });

  const presetNames = { global: 'Global', low: `Low (${fmtLen(grid.min.value)})`, high: `High (${fmtLen(grid.max.value)})`, mv: 'Mountain View' };
  const keysFor = { global: 'G', low: 'L', high: 'H', mv: 'M' };
  for (const name of Object.keys(PRESETS())) {
    const b = document.createElement('button');
    b.textContent = presetNames[name];
    b.title = `Key ${keysFor[name]}`;
    b.addEventListener('click', () => flyTo(name));
    $('presets').appendChild(b);
  }

  const toggles = { 't-coast': () => layers.coast, 't-grat': () => layers.graticule, 't-poi': () => layers.poi };
  for (const [id, get] of Object.entries(toggles)) {
    $(id).addEventListener('change', (e) => {
      const o = get(); if (o) o.visible = e.target.checked;
      if (id === 't-poi') layers.pois.forEach((p) => { p.el.hidden = !e.target.checked; });
    });
  }
  $('t-fill').addEventListener('change', () => setT(t));

  // Legend
  $('legend-bar').style.background = `linear-gradient(to right, ${DIVERGING.join(', ')})`;
  const ticks = $('legend-ticks');
  for (const v of [-100, -50, 0, 50, 100]) {
    const s = document.createElement('span');
    s.style.left = `${((v / VMAX + 1) / 2) * 100}%`;
    s.textContent = v === 0 ? '0' : fmtSigned(v);
    ticks.appendChild(s);
  }

  const mv = grid.poi?.['Mountain View'];
  if (mv) $('poi-note').innerHTML = `Mountain View: N = ${fmtSigned(mv.N, 1)} m, so h<sub>GPS</sub> = H<sub>MSL</sub> ${mv.N < 0 ? MINUS : '+'} ${Math.abs(mv.N).toFixed(1)} m`;

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    const n = Number(e.key);
    if (n >= 1 && n <= K_STOPS.length) animateToK(K_STOPS[n - 1]);
    const map = { g: 'global', l: 'low', h: 'high', m: 'mv' };
    if (map[e.key.toLowerCase()]) flyTo(map[e.key.toLowerCase()]);
    if (e.key === 'u') { $('ui').hidden = !$('ui').hidden; frame(); }   // hide panel for clean screenshots
  });
}

// ---------------------------------------------------------------- labels + loop
const tmp = new THREE.Vector3(), camDir = new THREE.Vector3();
function updateLabels() {
  if (!layers.pois) return;
  for (const p of layers.pois) {
    if (!$('t-poi').checked) continue;
    tmp.copy(p.dir).multiplyScalar(p.rel * uK.value + LIFT).add(p.base);
    camDir.copy(camera.position).sub(tmp);
    const facing = camDir.dot(p.dir) > 0;
    tmp.project(camera);
    p.el.hidden = !facing;
    p.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth + 8}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight - 8}px)`;
  }
}

renderer.setAnimationLoop((now) => {
  if (layers.geoid) stepTweens(now);
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
});

init().catch((err) => { console.error(err); status(err.message, true); });
