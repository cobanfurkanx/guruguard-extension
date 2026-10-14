import { z } from "zod";

export const SCHEMA_VERSION = 2 as const;
export const ReviewStatus = z.enum(["completed", "needs_review", "insufficient_data", "failed"]);
export const EvidenceSchema = z.object({
  ruleId: z.string(), category: z.string(), quote: z.string().min(1), field: z.string(), weight: z.number(),
  sourceUrl: z.string().url().optional(),
});
export const ReviewResponseSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  username: z.string(),
  reviewPriority: z.number().min(0).max(100).nullable(),
  status: ReviewStatus,
  source: z.string(),
  evidence: z.array(EvidenceSchema),
  ambiguous: z.array(z.object({ quote: z.string(), field: z.string(), reason: z.string() })),
  coverage: z.object({ fields: z.array(z.string()), captionCount: z.number(), captionsAnalyzed: z.number(), missing: z.array(z.string()), truncated: z.boolean() }),
  analyzedAt: z.string().nullable(), fetchedAt: z.string().nullable(), expiresAt: z.string().nullable(),
  servedFromCache: z.boolean(), stale: z.boolean(),
  pending: z.boolean().optional(),
  assessmentScope: z.enum(["limited","sampled"]).optional(),
  summary: z.string(), model: z.string(), analysisMethod: z.enum(["rules", "llm"]),
  flags: z.array(z.string()), tactics: z.array(z.string()),
  matchedCategories: z.array(z.object({ category: z.string(), points: z.number(), ruleIds: z.array(z.string()) })),
  signals: z.array(z.object({ label: z.string(), weight: z.number(), hit: z.boolean() })),
  rulesVersion: z.string(), promptVersion: z.string(), modelVersion: z.string(),
}).superRefine((r, ctx) => {
  const unassessed = r.status === "failed" || r.status === "insufficient_data";
  if (unassessed !== (r.reviewPriority === null)) ctx.addIssue({ code: "custom", message: "Invalid priority for status" });
});
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
export type PriorityLevel = "low" | "medium" | "high";
export function priorityLevel(score: number | null): PriorityLevel | null {
  return score === null ? null : score >= 35 ? "high" : score >= 15 ? "medium" : "low";
}
export function parseReviewResponse(data: unknown): ReviewResponse {
  const result = ReviewResponseSchema.safeParse(data);
  if (!result.success) throw new Error("GuruGuard version mismatch. Update the app or extension.");
  return result.data;
}
