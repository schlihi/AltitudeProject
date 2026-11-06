export function formatCoordinateValue(value, unit = 'm') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return `${value.toFixed(2)} ${unit}`;
}

// Future geodesy formatting utilities should stay here and remain independent of rendering code.
