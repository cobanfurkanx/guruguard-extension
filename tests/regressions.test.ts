import { describe, expect, it } from "vitest";
import { runRulesEngine, type EngineInput } from "../src/shared/rules/engine";
const base: EngineInput = { username: "person", profileUrl: "", biography: "", externalUrl: null, biographyLinks: [], captions: [], followerCount: null, followingCount: null, isVerified: null };
describe("context and evidence regressions", () => {
  it.each(['Beware scam groups at t.me/example', 'They say "join t.me/example"', 'Do not join t.me/example'])("does not score warning/quote/negation: %s", biography => {
    const r = runRulesEngine({ ...base, biography });
    expect(r.ruleScore).toBe(0);
  });
  it("keeps the no-experience sales promise", () => {
    expect(runRulesEngine({ ...base, biography: "No experience needed to earn income." }).flags).toContain("easy_success");
  });
  it("anchors bio links to the biography", () => {
    const r = runRulesEngine({ ...base, biography: "Join t.me/example" });
    expect(r.evidence[0]).toMatchObject({ field: "biography", quote: "Join t.me/example" });
  });
  it("never scores account metadata", () => {
    expect(runRulesEngine({ ...base, biography: "Nature photographer.", username: "person1234", followerCount: 1, followingCount: 100 }).ruleScore).toBe(0);
    const plain = runRulesEngine({ ...base, biography: "Guaranteed profits!" });
    expect(runRulesEngine({ ...base, biography: "Guaranteed profits!", isVerified: true }).ruleScore).toBe(plain.ruleScore);
  });
});
