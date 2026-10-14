import { describe, expect, it } from "vitest";
import { priorityLevel, parseReviewResponse } from "../src/shared/review-contract";
describe("review contract", () => {
  it("has no level for unassessed data", () => expect(priorityLevel(null)).toBeNull());
  it.each([[0,"low"], [14,"low"], [15,"medium"], [34,"medium"], [35,"high"], [100,"high"]] as const)("classifies %i as %s", (n, level) => expect(priorityLevel(n)).toBe(level));
  it("rejects legacy payloads explicitly", () => expect(() => parseReviewResponse({ trustScore: 8 })).toThrow(/Update/));
});
