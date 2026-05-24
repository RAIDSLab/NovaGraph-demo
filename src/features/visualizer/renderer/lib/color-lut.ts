import chroma from "chroma-js";

export type Rgba = [number, number, number, number];

const GRADIENT_STOPS = ["#eadeff", "#5f5ffa"] as const;
export const GRADIENT_LUT_SIZE = 256;
export const RAINBOW_LUT_SIZE = 360;

const buildGradientLut = (): Rgba[] => {
  const scale = chroma.scale([...GRADIENT_STOPS]);
  const lut = new Array<Rgba>(GRADIENT_LUT_SIZE);
  for (let i = 0; i < GRADIENT_LUT_SIZE; i++) {
    const t = i / (GRADIENT_LUT_SIZE - 1);
    const rgb = scale(t).rgb();
    lut[i] = [rgb[0], rgb[1], rgb[2], 1];
  }
  return lut;
};

const buildRainbowLut = (): Rgba[] => {
  const lut = new Array<Rgba>(RAINBOW_LUT_SIZE);
  for (let i = 0; i < RAINBOW_LUT_SIZE; i++) {
    const rgb = chroma.hsl(i, 1, 0.75).rgb();
    lut[i] = [rgb[0], rgb[1], rgb[2], 1];
  }
  return lut;
};

const GRADIENT_LUT = buildGradientLut();
const RAINBOW_LUT = buildRainbowLut();

export const GRADIENT_MAX_RGBA: Rgba = GRADIENT_LUT[GRADIENT_LUT_SIZE - 1];

export const gradientIndex = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
  return Math.round(clamped * (GRADIENT_LUT_SIZE - 1));
};

export const gradientRgba = (value: number): Rgba => {
  const idx = gradientIndex(value);
  return GRADIENT_LUT[idx];
};

export const gradientRgbaByIndex = (idx: number): Rgba => {
  const clamped = idx < 0 ? 0 : idx >= GRADIENT_LUT_SIZE ? GRADIENT_LUT_SIZE - 1 : idx;
  return GRADIENT_LUT[clamped];
};

export const rainbowIndex = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const hue = (((value * 137.508 + 50) % 360) + 360) % 360;
  return Math.floor(hue) % RAINBOW_LUT_SIZE;
};

export const rainbowRgba = (value: number): Rgba => {
  if (!Number.isFinite(value)) return NEUTRAL_RGBA;
  return RAINBOW_LUT[rainbowIndex(value)];
};

export const rainbowRgbaByIndex = (idx: number): Rgba => {
  const clamped = idx < 0 ? 0 : idx >= RAINBOW_LUT_SIZE ? RAINBOW_LUT_SIZE - 1 : idx;
  return RAINBOW_LUT[clamped];
};

export const cssToRgba = (css: string): Rgba => {
  const c = chroma(css);
  const [r, g, b] = c.rgb();
  return [r, g, b, c.alpha()];
};

export const NEUTRAL_RGBA: Rgba = cssToRgba("#75757580");
export const CRITICAL_RGBA: Rgba = cssToRgba("#fd4958");
export const PRIMARY_LOW_RGBA: Rgba = cssToRgba("#5f5ffad9");
export const DISABLED_RGBA: Rgba = cssToRgba("#757575");
