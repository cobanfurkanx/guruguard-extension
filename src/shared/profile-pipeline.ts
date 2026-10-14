import type { VisibleProfile } from "./local-review";
import type { ReviewResponse } from "./review-contract";

/** A clear rule result ends the pipeline. Missing content cannot be invented by AI. */
export function needsAI(review: ReviewResponse, input: VisibleProfile): boolean {
  const text = [input.biography, ...(input.captions ?? []), ...(input.highlights ?? []), ...(input.landingTexts ?? [])].join(" ").trim();
  const commercialContext=/course|mentor|academy|trading|income|skool|coaching|affiliate|kurs|kazanç|yatırım|eğitim/i.test(`${text} ${input.externalUrl??""}`);
  return text.length >= 60 && (review.status === "needs_review" || (review.status === "insufficient_data" && commercialContext) || (review.reviewPriority !== null && review.reviewPriority >= 40 && review.reviewPriority <= 60));
}
