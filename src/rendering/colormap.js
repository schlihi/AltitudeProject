// ColorBrewer RdBu (11-class), reversed so negative N = blue, positive N = red. sRGB hex.
export const DIVERGING = [
  '#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7',
  '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f',
];

const hexToRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
const STOPS = DIVERGING.map(hexToRgb);

/** sRGB [r, g, b] in 0..1 for value v on a symmetric diverging scale clamped at +/- vmax. */
export function divergingColor(v, vmax) {
  const t = Math.min(Math.max((v / vmax + 1) / 2, 0), 1) * (STOPS.length - 1);
  const k = Math.min(Math.floor(t), STOPS.length - 2);
  const f = t - k;
  const a = STOPS[k];
  const b = STOPS[k + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
