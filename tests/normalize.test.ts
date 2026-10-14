import { describe, expect, it } from "vitest";
import {
  foldAccents,
  normalizeForMatch,
  splitSentences,
  findQuoteInOriginal,
} from "../src/shared/normalize";

describe("normalizeForMatch", () => {
  it("applies NFKC and lowercases", () => {
    expect(normalizeForMatch("  GARANTİLİ   Kazanç ")).toContain("garant");
  });

  it("strips zero-width characters", () => {
    expect(normalizeForMatch("a​b")).toBe("ab");
  });

  it("turns emoji into spaces without gluing words", () => {
    expect(normalizeForMatch("para💰kazan")).toBe("para kazan");
  });

  it("collapses unicode whitespace", () => {
    expect(normalizeForMatch("a  b")).toBe("a b");
  });
});

describe("foldAccents", () => {
  it("folds Turkish dotted/dotless variants to a common form", () => {
    expect(foldAccents("sıfır")).toBe("sifir");
    expect(foldAccents("bırak")).toBe("birak");
    expect(foldAccents("garanti")).toBe("garanti");
  });

  it("leaves English words structurally intact", () => {
    expect(foldAccents("info money")).toBe("info money");
  });
});

describe("splitSentences", () => {
  it("splits on sentence boundaries", () => {
    expect(splitSentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
  });
});

describe("findQuoteInOriginal", () => {
  it("re-anchors a normalized quote to the original text", () => {
    const orig = "Herkese merhaba, GARANTİLİ KAZANÇ sağlıyoruz artık.";
    const q = findQuoteInOriginal(orig, "garantili kazanç");
    expect(q).toContain("GARANTİLİ KAZANÇ");
  });
});
