import { describe, expect, it } from "vitest";
import { reviewVisibleProfile, shouldShowBlockReview } from "../src/shared/local-review";
import { parseReviewResponse } from "../src/shared/review-contract";

describe("local-first review", () => {
  it("keeps ordinary links below the block threshold", () => {
    const r = reviewVisibleProfile({ username: "shop", biography: "Handmade crafts", externalUrl: "https://linktr.ee/shop" });
    expect(r.reviewPriority).toBeLessThan(15);
    expect(shouldShowBlockReview(r)).toBe(false);
  });
  it("shows strong compounded promises, including highlighted text", () => {
    const r = reviewVisibleProfile({ username: "seller", biography: "Guaranteed income!", highlights: ["Zero risk investing. AI powered passive income store."] });
    expect(r.reviewPriority).toBeGreaterThanOrEqual(60);
    expect(shouldShowBlockReview(r)).toBe(true);
    expect(r.evidence.some(e => e.field === "highlight[0]")).toBe(true);
    expect(parseReviewResponse(r).schemaVersion).toBe(2);
  });
  it("does not block anti-scam warnings or quoted claims", () => {
    const r = reviewVisibleProfile({ username: "educator", biography: 'Beware scams promising "guaranteed income" and zero risk investing.' });
    expect(shouldShowBlockReview(r)).toBe(false);
  });
  it("never calls absent data safe", () => {
    const r = reviewVisibleProfile({ username: "empty", biography: "" });
    expect(r.reviewPriority).toBeNull();
    expect(r.status).toBe("insufficient_data");
  });
  it("detects extreme win-rate promises in a trading context", () => {
    const r = reviewVisibleProfile({ username: "signals", biography: "Forex signals with 99% win rate. Double your money." });
    expect(r.reviewPriority).toBeGreaterThanOrEqual(50);
  });
});
