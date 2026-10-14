// Text normalization for the rule engine (§4).
// - Lowercase first, then Unicode NFKC; zero-width/format characters removed.
// - Unicode whitespace collapsed; emoji and symbols become a SPACE
//   (never removed silently, so words are never glued together).
// - Turkish dotted/dotless I variants are covered by NFKC + the
//   accent-folded second pass (foldAccents), not by destructive mapping
//   (mapping I to dotless-i would corrupt English words like INFO).
// - Original text is always preserved; matching happens on normalized
//   copies and evidence quotes are re-anchored to the original.

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD\u0307]/g;
const WS = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g;
// Emoji / pictographs / symbols → space (keeps word separation).
const SYMBOLS = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]+/gu;

const ACCENT_MAP: Record<string, string> = {
  á: "a", à: "a", â: "a", ä: "a", ã: "a", å: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i", ı: "i",
  ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ć: "c", č: "c",
  ğ: "g", ĝ: "g",
  ñ: "n", ś: "s", š: "s", ş: "s", ź: "z", ż: "z", ž: "z",
  ý: "y", ÿ: "y",
};

export function normalizeForMatch(input: string): string {
  // Lowercase FIRST: "İ".toLowerCase() is "i" + combining dot (U+0307),
  // which NFKC does not fold back (it is İ's decomposition), so the
  // combining dot is stripped explicitly via ZERO_WIDTH.
  return input
    .toLowerCase()
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(SYMBOLS, " ")
    .replace(WS, " ")
    .trim();
}

/** Accent-tolerant second pass: sifir matches sıfır, INFO stays intact. */
export function foldAccents(input: string): string {
  return input
    .split("")
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .join("");
}

/** Split into sentences on a COPY; caller splits the original with the same
 *  splitter to keep 1:1 alignment for evidence quotes. */
const SENTENCE_SPLIT = /(?<=[.!\u2026?\n])\s+|\n+/;

export function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Re-anchor a normalized quote to the original text: skeleton search that
 * ignores case, accents, punctuation and whitespace, then returns the
 * original slice with surrounding context. Never fabricates text.
 */
export function findQuoteInOriginal(
  original: string,
  normalizedQuote: string,
  contextChars = 40,
): string {
  if (normalizedQuote.trim() && original.includes(normalizedQuote)) return normalizedQuote.trim();
  const skeleton = (s: string): string =>
    foldAccents(s.normalize("NFKC").toLowerCase()).replace(/[^a-z0-9]/g, "");
  const needle = skeleton(normalizedQuote).slice(0, 60);
  if (needle.length < 8) return original.slice(0, 120);
  const hay = skeleton(original);
  const idx = hay.indexOf(needle);
  if (idx < 0) return original.slice(0, 120);
  // Map skeleton offset back to original offset (approximate, then expand).
  let origIdx = 0;
  let sk = 0;
  while (origIdx < original.length && sk < idx) {
    const folded = foldAccents(
      original.charAt(origIdx).normalize("NFKC").toLowerCase(),
    ).replace(/[^a-z0-9]/g, "");
    sk += folded.length;
    origIdx += 1;
  }
  const start = Math.max(0, origIdx - contextChars);
  const end = Math.min(original.length, origIdx + needle.length + contextChars);
  return original.slice(start, end).trim();
}
