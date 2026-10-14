import { parseReviewResponse, type ReviewResponse } from "../shared/review-contract";
import { shouldShowBlockReview } from "../shared/local-review";
import type { ProfileCheck } from "./pipeline";

export function parseProfileCheck(raw: unknown): ProfileCheck {
  const value = raw as Partial<ProfileCheck> | null;
  const review = parseReviewResponse(value?.review ?? raw);
  const community = value?.community;
  return { review, stage: value?.stage === "ai" ? "ai" : value?.stage === "database" ? "database" : "rules",
    ...(community && typeof community.reason === "string" && community.reason.trim() && community.reason.length <= 2000 && Array.isArray(community.sources) ? {community: {reason: community.reason, sources: community.sources.filter(url => typeof url === "string" && /^https:\/\//.test(url)).slice(0, 8)}} : {}),
    ...(value?.ai && typeof value.ai.available === "boolean" ? {ai: value.ai} : {}),
  };
}
export function presentation(check: ProfileCheck) {
  const r: ReviewResponse = check.review;
  if (check.community) return {tone:"listed", title:"On the community list", expand:true};
  if (r.pending) return {tone:"neutral",title:"Still checking",expand:false};
  if (r.stale) return {tone:"neutral",title:"Result needs a refresh",expand:false};
  if (r.status === "needs_review") return {tone:"caution",title:"Claims need a closer look",expand:true};
  if (shouldShowBlockReview(r)) return {tone:"danger",title:"High-pressure offer",expand:true};
  if (r.reviewPriority === null) return {tone:"neutral",title:"Open a post to check more",expand:false};
  if (r.reviewPriority >= 15) return {tone:"caution",title:"Check these claims",expand:true};
  return {tone:"neutral",title:"No strong claims found",expand:false};
}
