import localFont from "next/font/local";

// Self-hosted variable fonts (OFL). next/font preloads them and sizes the fallback to avoid layout shift.
export const figtree = localFont({
  src: "./figtree-latin-wght-normal.woff2",
  weight: "300 900",
  variable: "--font-figtree",
  display: "swap",
  preload: true,
});

export const bricolage = localFont({
  src: "./bricolage-grotesque-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
  preload: true,
});

export const jetbrains = localFont({
  src: "./jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const devanagari = localFont({
  src: "./noto-sans-devanagari-devanagari-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-devanagari",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF" }],
});

export const fontVars = [figtree.variable, bricolage.variable, jetbrains.variable, devanagari.variable].join(" ");
