// Types minimaux d'opentype.js 2.0 (le paquet n'en fournit pas), limités à ce
// qu'utilise scripts/build-brand.ts.
declare module 'opentype.js' {
  type PathCommand =
    | { type: 'M' | 'L'; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Z' };

  interface Path {
    commands: PathCommand[];
  }

  interface Glyph {
    advanceWidth?: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }

  interface Font {
    unitsPerEm: number;
    stringToGlyphs(text: string): Glyph[];
    getAdvanceWidth(text: string, fontSize: number): number;
    getKerningValue(left: Glyph, right: Glyph): number;
  }

  const opentype: { parse(buffer: ArrayBuffer): Font };
  export default opentype;
}
