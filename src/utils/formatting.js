export function formatCoordinateValue(value, unit = 'm') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return `${value.toFixed(2)} ${unit}`;
}

const MINUS = '−';

/** Signed number with a true minus sign and explicit "+", e.g. "+12.3" / "−4". */
export function formatSigned(x, digits = 0) {
  return (x < 0 ? MINUS : '+') + Math.abs(x).toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** Signed length in m, switching to km at 1000 m, e.g. "−106 m", "+1.2 km". */
export function formatSignedLength(m) {
  if (Math.abs(m) >= 1000) return `${formatSigned(m / 1000, Math.abs(m) >= 1e4 ? 0 : 1)} km`;
  return `${formatSigned(m, 0)} m`;
}

/** Exaggeration factor, e.g. "3.2×", "1,000×". */
export function formatExaggeration(k) {
  return `${k < 9.95 ? k.toFixed(1) : Math.round(k).toLocaleString()}×`;
}

// Geodesy formatting utilities stay here and remain independent of rendering code.
