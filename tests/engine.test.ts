import { describe, expect, it } from "vitest";
import { runRulesEngine, type EngineInput } from "../src/shared/rules/engine";

function input(over: Partial<EngineInput> = {}): EngineInput {
  return {
    username: "test_user",
    profileUrl: "https://instagram.com/test_user",
    biography: "",
    externalUrl: null,
    biographyLinks: [],
    captions: [],
    followerCount: null,
    followingCount: null,
    isVerified: null,
    ...over,
  };
}

describe("rule engine: Turkish + English matches", () => {
  it("scores an income guarantee (TR)", () => {
    const r = runRulesEngine(input({ biography: "Garantili kazanç sağlıyoruz, katıl!" }));
    expect(r.ruleScore).toBeGreaterThanOrEqual(30);
    expect(r.flags).toContain("income_guarantee");
    expect(r.matchedCategories.map((c) => c.category)).toContain("A");
  });

  it("scores an income guarantee (EN)", () => {
    const r = runRulesEngine(input({ biography: "Guaranteed profits every month, join now!" }));
    expect(r.flags).toContain("income_guarantee");
  });

  it("scores risk-free investing with context", () => {
    const r = runRulesEngine(
      input({ biography: "Sıfır risk ile yatırım yap, zarar etmezsin." }),
    );
    expect(r.flags).toContain("riskfree_investing");
  });

  it("scores fast-money amount+period combos", () => {
    const r = runRulesEngine(
      input({ biography: "30 günde 100 bin kazan! DM'den BİLGİ yaz." }),
    );
    expect(r.ruleScore).toBeGreaterThanOrEqual(20);
    expect(r.flags).toContain("fast_money");
  });

  it("scores discord funnels", () => {
    const r = runRulesEngine(
      input({
        biography: "VIP signals here",
        externalUrl: "https://discord.gg/abc123",
      }),
    );
    expect(r.flags).toContain("discord_funnel");
    expect(r.flags).toContain("inner_circle");
  });
});

describe("rule engine: negations, quotes, reports", () => {
  it("drops negated claims", () => {
    const r = runRulesEngine(
      input({ biography: "Garantili kazanç diye bir şey yok, dikkatli olun." }),
    );
    expect(r.flags).not.toContain("income_guarantee");
    expect(r.ruleScore).toBe(0);
  });

  it("holds quoted claims as ambiguous, not scored", () => {
    const r = runRulesEngine(
      input({ biography: 'Herkes "garantili kazanç" diyor, araştırın.' }),
    );
    expect(r.flags).not.toContain("income_guarantee");
    expect(r.ambiguous.length).toBeGreaterThan(0);
  });

  it("holds reported speech as ambiguous", () => {
    const r = runRulesEngine(
      input({ biography: "Bu hesap günde $500 vaat ediyor, inceledik." }),
    );
    expect(r.ruleScore).toBe(0);
    expect(r.ambiguous.some((a) => a.reason === "reported")).toBe(true);
  });

  it("treats anti-scam warnings as context, not claims", () => {
    const r = runRulesEngine(
      input({ biography: "Dolandırıcılığa dikkat! Garantili kazanç vaat edenlere inanmayın." }),
    );
    expect(r.flags).not.toContain("income_guarantee");
  });
});

describe("rule engine: exclusions and singles", () => {
  it("does not count product/return guarantees as income guarantees", () => {
    const r = runRulesEngine(
      input({ biography: "Ürün iade garantisi veriyoruz. Kargo ücretsiz." }),
    );
    expect(r.flags).not.toContain("income_guarantee");
    expect(r.ruleScore).toBe(0);
  });

  it("gives zero points to lone trigger words", () => {
    for (const bio of [
      "Coach and mentor. I love AI and crypto.",
      "Dropshipping store owner. Shopify + Skool community.",
      "Find me on Telegram and Linktree.",
    ]) {
      const r = runRulesEngine(input({ biography: bio }));
      expect(r.ruleScore).toBe(0);
    }
  });

  it("does not lower the score for a no-advice disclaimer", () => {
    const withDisc = runRulesEngine(
      input({ biography: "Günde $500 kazan! Yatırım tavsiyesi değildir." }),
    );
    const without = runRulesEngine(input({ biography: "Günde $500 kazan!" }));
    expect(withDisc.ruleScore).toBeGreaterThanOrEqual(without.ruleScore);
  });
});

describe("rule engine: dedup and evidence", () => {
  it("counts one category once no matter the repeats", () => {
    const once = runRulesEngine(input({ biography: "Garantili kazanç!" }));
    const twice = runRulesEngine(
      input({ biography: "Garantili kazanç! Garantili kazanç! Garantili kazanç!" }),
    );
    expect(twice.ruleScore).toBe(once.ruleScore);
    expect(twice.evidence.length).toBeGreaterThanOrEqual(
      once.evidence.length,
    );
  });

  it("stacks independent categories in one sentence", () => {
    const r = runRulesEngine(
      input({ biography: "Garantili kazanç! Sadece bugün, son 3 kişi!" }),
    );
    const cats = r.matchedCategories.map((c) => c.category);
    expect(cats).toContain("A");
    expect(cats).toContain("H");
  });

  it("attaches original quotes to evidence", () => {
    const r = runRulesEngine(input({ biography: "GARANTİLİ KAZANÇ sağlıyoruz." }));
    expect(r.evidence.length).toBeGreaterThan(0);
    expect(r.evidence[0].quote).toContain("GARANTİLİ KAZANÇ");
    expect(r.evidence[0].field).toBe("biography");
  });

  it("labels tactic combos without extra points", () => {
    const r = runRulesEngine(
      input({
        biography:
          "Garantili kazanç ve sıfır risk ile yatırım! Ücretsiz strateji görüşmesi için DM.",
      }),
    );
    expect(r.tactics).toContain("guarantee + risk-free");
  });
});
