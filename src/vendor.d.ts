declare module '@react-native/normalize-colors' {
  /** Returns the color as 0xRRGGBBAA, or null if it can't be parsed. */
  export default function normalizeColor(color: string | number): number | null;
}
