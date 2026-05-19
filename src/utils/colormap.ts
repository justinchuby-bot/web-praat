/**
 * Color maps for spectrogram visualization.
 */

/**
 * Jet-like colormap: blue → cyan → green → yellow → red
 * Input: value 0..1, Output: [r, g, b] each 0..255
 */
function jetColormap(value: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, value));
  let r: number, g: number, b: number;

  if (v < 0.25) {
    r = 0;
    g = Math.round(255 * (v / 0.25));
    b = 255;
  } else if (v < 0.5) {
    r = 0;
    g = 255;
    b = Math.round(255 * (1 - (v - 0.25) / 0.25));
  } else if (v < 0.75) {
    r = Math.round(255 * ((v - 0.5) / 0.25));
    g = 255;
    b = 0;
  } else {
    r = 255;
    g = Math.round(255 * (1 - (v - 0.75) / 0.25));
    b = 0;
  }

  return [r, g, b];
}

/**
 * Grayscale colormap (inverted — dark = high energy, like Praat).
 */
function grayscaleColormap(value: number): [number, number, number] {
  const v = Math.round(255 * (1 - Math.max(0, Math.min(1, value))));
  return [v, v, v];
}

/**
 * Viridis-like colormap: purple → blue → green → yellow
 */
function viridisColormap(value: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.round(255 * Math.min(1, Math.max(0, -1.25 + 4.03 * v - 1.4 * v * v)));
  const g = Math.round(255 * Math.min(1, Math.max(0, -0.15 + 1.2 * v)));
  const b = Math.round(255 * Math.min(1, Math.max(0, 0.5 + 1.5 * v - 2.8 * v * v)));
  return [r, g, b];
}

/**
 * Magma-like colormap: black → purple → orange → yellow
 */
function magmaColormap(value: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.round(255 * Math.min(1, Math.max(0, -0.05 + 2.5 * v * v)));
  const g = Math.round(255 * Math.min(1, Math.max(0, -0.2 + 1.0 * v * v + 0.5 * v)));
  const b = Math.round(255 * Math.min(1, Math.max(0, 0.1 + 2.0 * v - 2.5 * v * v)));
  return [r, g, b];
}

/**
 * Get colormap function by name.
 */
export function getColormap(name: string): (value: number) => [number, number, number] {
  switch (name) {
    case 'grayscale': return grayscaleColormap;
    case 'viridis': return viridisColormap;
    case 'magma': return magmaColormap;
    default: return jetColormap;
  }
}
