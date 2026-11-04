// Guards the brand palette: white text on the brand fill and brand-coloured text on cards
// must clear WCAG AA (4.5:1) in both themes. Reads the real tokens from globals.css.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.join(__dirname, "../src/app/globals.css"), "utf8");

/** All values of `--name: H S% L%;` in file order (first = light, second = dark). */
function tokens(name: string): [number, number, number][] {
  const re = new RegExp("--" + name + String.raw`:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%`, "g");
  return [...css.matchAll(re)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number]);
}

function luminance([h, s, l]: [number, number, number]): number {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const WHITE: [number, number, number] = [0, 0, 100];

describe("brand tokens", () => {
  it("defines brand tokens for light and dark", () => {
    for (const t of ["brand", "brand-text", "brand-tint", "card"]) expect(tokens(t).length, t).toBeGreaterThanOrEqual(2);
  });

  it("white text on the brand fill is AA in both themes", () => {
    for (const fill of tokens("brand").slice(0, 2)) expect(contrast(fill, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("brand-coloured text is AA on cards in light and dark", () => {
    const [textLight, textDark] = tokens("brand-text");
    const [cardLight, cardDark] = tokens("card");
    expect(contrast(textLight, cardLight)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(textDark, cardDark)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps no leftover HANDLL palette", () => {
    expect(css).not.toMatch(/224 94% 53%/);
    expect(css).not.toMatch(/--line-handll|--line-marketing/);
  });
});
