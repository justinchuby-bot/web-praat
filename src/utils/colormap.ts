/**
 * Color maps for spectrogram visualization.
 */

/**
 * Jet-like colormap: blue → cyan → green → yellow → red
 * Input: value 0..1, Output: [r, g, b] each 0..255
 */
export function jetColormap(value: number): [number, number, number] {
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
export function grayscaleColormap(value: number): [number, number, number] {
  const v = Math.round(255 * (1 - Math.max(0, Math.min(1, value))));
  return [v, v, v];
}
