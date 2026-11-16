// Three.js scene for the geoid-over-ellipsoid globe. Framework-agnostic: React mounts it into a
// container element (see SceneCanvas.jsx) and drives it through the returned API.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WGS84_A, geodeticToUnitEllipsoid, geodeticNormal } from '../geodesy/wgs84';
import { buildGlobeArrays, buildDrapedSegments, graticulePolylines } from './globeGeometry';
import { divergingColor } from './colormap';

// ---------------------------------------------------------------- settings
export const K_MAX = 10000; // must match the kHi used for aNormalHi
export const K_STOPS = [1, 10, 100, 1000, 10000];
export const VMAX = 110; // colormap clamp (m), symmetric
const FADE_K = [100, 316]; // k range where the ellipsoid fill fades in and the graticule settles onto h = 0
const FILL_OPACITY = 0.14;
const LIFT = 5e-5; // ~320 m in radii: keeps draped lines above their surface
const TWEEN_S = 1.2;

/** Slider position t in 0..1 <-> exaggeration k = 10^(4t). */
export const kOf = (t) => 10 ** (4 * t);
export const tOf = (k) => Math.log10(k) / 4;

/** Camera presets available for a grid: { name: { lat, lon, dist } }. */
export function globePresets(grid) {
  const mv = grid.poi?.['Mountain View'];
  return {
    global: { lat: 15, lon: 70, dist: 3.6 },
    low: { lat: grid.min.lat, lon: grid.min.lon, dist: 3.0 },
    high: { lat: grid.max.lat, lon: grid.max.lon, dist: 3.0 },
    ...(mv ? { mv: { lat: mv.lat, lon: mv.lon, dist: 3.0 } } : {}),
  };
}

const smoothstep = (a, b, x) => {
  const u = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return u * u * (3 - 2 * u);
};
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

// ---------------------------------------------------------------- materials
/** Patch a line/points material so vertices move to position + aDir * (aN * uK + uLift). */
function draped(material, uK, liftUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uK = uK;
    shader.uniforms.uLift = liftUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aDir; attribute float aN; uniform float uK; uniform float uLift;`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = position + aDir * (aN * uK + uLift);');
  };
  return material;
}

function geoidMaterial(uK) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uK = uK;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aN; attribute vec3 aNormalHi; uniform float uK;`,
      )
      // Blend toward the precomputed normal of the K_MAX surface so shading tracks the bumps.
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 objectNormal = normalize(mix(normal, aNormalHi, clamp((uK - 1.0) / ${(K_MAX - 1).toFixed(1)}, 0.0, 1.0)));`,
      )
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

/**
 * Mount the globe into `container` (which should be position: relative).
 * @param {HTMLElement} container
 * @param {object} grid - from loadGeoidGrid()
 * @param {object} [opts]
 * @param {Array} [opts.coastlines] - [lon, lat] polylines, optional
 * @param {(k: number, t: number) => void} [opts.onKChange]
 */
export function createGeoidGlobe(container, grid, { coastlines = null, onKChange = () => {} } = {}) {
  const uK = { value: 1 };
  const uGratLift = { value: 0 };
  const uCoastLift = { value: LIFT };

  let maxAbsRel = 0;
  for (const v of grid.data) maxAbsRel = Math.max(maxAbsRel, Math.abs(v));
  maxAbsRel /= WGS84_A;

  // -------------------------------------------------------------- renderer / scene
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0b0e14);
  renderer.domElement.style.display = 'block';
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0, 3.6);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x30343c, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(-2, 2, 3); // child of the camera: lighting follows the view
  camera.add(key);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.25;
  controls.maxDistance = 8;
  controls.rotateSpeed = 0.6;

  let width = 1;
  let height = 1;
  function resize() {
    width = Math.max(container.clientWidth, 1);
    height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // -------------------------------------------------------------- build scene
  const layers = {};
  const g = buildGlobeArrays(grid, K_MAX);

  const colors = new Float32Array(g.aN.length * 3);
  const c = new THREE.Color();
  for (let v = 0; v < grid.data.length; v++) {
    const [r, gg, b] = divergingColor(grid.data[v], VMAX);
    c.setRGB(r, gg, b, THREE.SRGBColorSpace); // converted to linear for rendering
    colors[3 * v] = c.r;
    colors[3 * v + 1] = c.g;
    colors[3 * v + 2] = c.b;
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
  layers.geoid = new THREE.Mesh(geoidGeom, geoidMaterial(uK));
  layers.geoid.frustumCulled = false; // bounds grow with k
  scene.add(layers.geoid);

  // Ellipsoid fill: same vertices, undisplaced. No depth writes, drawn after the geoid, so it
  // only tints where the ellipsoid lies outside the geoid (N < 0).
  const fillGeom = new THREE.BufferGeometry();
  fillGeom.setAttribute('position', pos);
  fillGeom.setAttribute('normal', nrm);
  fillGeom.setIndex(idx);
  layers.fill = new THREE.Mesh(
    fillGeom,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  layers.fill.renderOrder = 2;
  layers.fill.frustumCulled = false;
  scene.add(layers.fill);

  // Graticule on the ellipsoid (h = 0); lifted above everything at low k to avoid z-fighting.
  layers.graticule = new THREE.LineSegments(
    segmentsGeometry(buildDrapedSegments(graticulePolylines(15, 1), null)),
    draped(new THREE.LineBasicMaterial({ color: 0x1a9850, transparent: true, opacity: 0.8 }), uK, uGratLift),
  );
  layers.graticule.renderOrder = 1;
  layers.graticule.frustumCulled = false;
  scene.add(layers.graticule);

  // Coastlines draped on the geoid (optional data file).
  if (coastlines) {
    layers.coast = new THREE.LineSegments(
      segmentsGeometry(buildDrapedSegments(coastlines, grid, 1)),
      draped(new THREE.LineBasicMaterial({ color: 0x111418, transparent: true, opacity: 0.85 }), uK, uCoastLift),
    );
    layers.coast.renderOrder = 1;
    layers.coast.frustumCulled = false;
    scene.add(layers.coast);
  }

  // Points of interest, draped on the geoid, with HTML labels positioned over the canvas.
  const pois = Object.entries(grid.poi || {}).map(([name, p]) => ({ name, ...p }));
  if (pois.length) {
    const segs = buildDrapedSegments(pois.map((p) => [[p.lon, p.lat], [p.lon, p.lat]]), grid, 1);
    layers.poi = new THREE.Points(
      segmentsGeometry(segs),
      draped(new THREE.PointsMaterial({ color: 0xffffff, size: 7, sizeAttenuation: false }), uK, uCoastLift),
    );
    layers.poi.frustumCulled = false;
    scene.add(layers.poi);
    for (const p of pois) {
      const el = document.createElement('div');
      el.className = 'poi-label';
      el.textContent = p.name;
      container.appendChild(el);
      p.el = el;
      p.base = new THREE.Vector3(...geodeticToUnitEllipsoid(p.lat, p.lon));
      p.dir = new THREE.Vector3(...geodeticNormal(p.lat, p.lon));
      p.rel = (p.N ?? 0) / WGS84_A;
    }
  }

  // -------------------------------------------------------------- exaggeration state
  let t = 0;
  let showFill = true;
  let showLabels = true;

  function setT(tt) {
    t = Math.min(Math.max(tt, 0), 1);
    const k = kOf(t);
    uK.value = k;
    const fade = smoothstep(Math.log10(FADE_K[0]), Math.log10(FADE_K[1]), Math.log10(k));
    layers.fill.material.opacity = FILL_OPACITY * fade;
    layers.fill.visible = showFill && fade > 0.001;
    uGratLift.value = (1 - fade) * (maxAbsRel * k + LIFT);
    onKChange(k, t);
  }

  // -------------------------------------------------------------- tweens
  let kTween = null;
  let camTween = null;

  function flyTo(name, dur = TWEEN_S) {
    const p = globePresets(grid)[name];
    if (!p) return;
    const to = new THREE.Vector3(...geodeticNormal(p.lat, p.lon)).multiplyScalar(p.dist);
    if (dur === 0) {
      camera.position.copy(to);
      controls.update();
      return;
    }
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

  // -------------------------------------------------------------- labels + loop
  const tmp = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  function updateLabels() {
    for (const p of pois) {
      if (!showLabels) {
        p.el.hidden = true;
        continue;
      }
      tmp.copy(p.dir).multiplyScalar(p.rel * uK.value + LIFT).add(p.base);
      camDir.copy(camera.position).sub(tmp);
      const facing = camDir.dot(p.dir) > 0;
      tmp.project(camera);
      p.el.hidden = !facing;
      p.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * width + 8}px, ${(-tmp.y * 0.5 + 0.5) * height - 8}px)`;
    }
  }

  renderer.setAnimationLoop((now) => {
    stepTweens(now);
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
  });

  setT(0);
  flyTo('global', 0);

  // -------------------------------------------------------------- public API
  return {
    hasCoastlines: Boolean(layers.coast),
    /** Jump to slider position t (0..1), cancelling any exaggeration tween. */
    setT(tt) {
      kTween = null;
      setT(tt);
    },
    animateToK(k) {
      kTween = { from: t, to: tOf(k), t0: performance.now(), dur: TWEEN_S * 1000 };
    },
    flyTo,
    /** name: 'coast' | 'graticule' | 'fill' | 'labels' */
    setLayerVisible(name, visible) {
      if (name === 'fill') {
        showFill = visible;
        setT(t);
      } else if (name === 'labels') {
        showLabels = visible;
        if (layers.poi) layers.poi.visible = visible;
      } else if (layers[name]) {
        layers[name].visible = visible;
      }
    },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        obj.material?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      for (const p of pois) p.el.remove();
    },
  };
}
