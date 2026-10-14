import { parseReviewResponse, type ReviewResponse } from "../shared/review-contract";
import { reviewVisibleProfile, type VisibleProfile } from "../shared/local-review";
import { needsAI } from "../shared/profile-pipeline";
import { RULES_VERSION } from "../shared/rules/rules.v1";

export interface ProfileCheck { review: ReviewResponse; community?: { reason: string; sources: string[] }; ai?: { available: boolean; explanation?: string; reason?: string; credits?: number }; stage: "database" | "rules" | "ai" }
export async function checkProfile(input: VisibleProfile, send: (message: unknown) => Promise<any>, signal: AbortSignal): Promise<ProfileCheck> {
  signal.throwIfAborted();
  let lookup: any;
  try { lookup = await send({ type: "PROFILE_LOOKUP", username: input.username }); } catch { /* Rules remain available offline. */ }
  signal.throwIfAborted();
  if (lookup?.review) {
    try{
      const review = parseReviewResponse(lookup.review);
      if (review.username === input.username && review.rulesVersion===RULES_VERSION && ["instagram_json","brightdata"].includes(review.source) && review.expiresAt && Date.parse(review.expiresAt) > Date.now() && review.reviewPriority !== null && !review.stale) return { review, community: lookup.community, stage: "database" };
    }catch{/* An unusable shared record cannot suppress the local check. */}
  }
  if (lookup?.community) return { review: reviewVisibleProfile(input, "instagram_visible"), community: lookup.community, stage: "database" };
  let enriched = input;
  if (input.externalUrl) {
    try {
      const link = await send({ type: "INSPECT_LINK", username: input.username, url: input.externalUrl });
      signal.throwIfAborted();
      if (link?.available && link.page?.username === input.username && Array.isArray(link.page.texts) && link.page.texts.length <= 12 && link.page.texts.every((text: unknown) => typeof text === "string" && text.length < 3000)) enriched = { ...input, landingTexts: link.page.texts, landingUrls: link.page.texts.map(() => link.page.url) };
    } catch { signal.throwIfAborted(); }
  }
  const review = reviewVisibleProfile(enriched, "instagram_visible");
  if (!needsAI(review, enriched)) return { review, stage: "rules" };
  try {
    const ai = await send({ type: "AI_REVIEW", input: enriched });
    signal.throwIfAborted();
    return { review, ai, stage: ai?.available ? "ai" : "rules" };
  } catch { signal.throwIfAborted(); return { review, stage: "rules" }; }
}
