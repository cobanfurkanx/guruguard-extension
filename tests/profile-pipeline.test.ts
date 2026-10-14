import { expect,it,vi } from "vitest";
import { checkProfile } from "../src/lib/pipeline";
import { reviewVisibleProfile,shouldShowBlockReview } from "../src/shared/local-review";
import { needsAI } from "../src/shared/profile-pipeline";
const ordinary={username:"sample",biography:"Family photos and long walks by the seaside. A personal travel journal and local food."};
it("finds a quantified income guarantee with a paid signals offer without needing AI",()=>{
  const input={username:"sample",biography:"Guaranteed 10% daily profits. No risk. Join my VIP trading signals. Link in bio."};
  const review=reviewVisibleProfile(input);expect(shouldShowBlockReview(review)).toBe(true);
  expect(review.evidence.some(row=>row.quote.includes("Guaranteed 10% daily profits"))).toBe(true);
  expect(needsAI(review,input)).toBe(false);
  const warning={...input,biography:'Beware of scammers promising "guaranteed 10% daily profits" and "VIP trading signals".'};
  const quoted=reviewVisibleProfile(warning);expect(shouldShowBlockReview(quoted)).toBe(false);expect(quoted.status).toBe("needs_review");
});
it("does not use AI for missing content or an ordinary personal biography",()=>{
  expect(needsAI(reviewVisibleProfile(ordinary),ordinary)).toBe(false);
  expect(needsAI(reviewVisibleProfile({username:"sample",biography:""}),{username:"sample",biography:""})).toBe(false);
});
it("checks shared storage first and makes no model or link calls for a valid result",async()=>{
  const input={...ordinary,captions:["Walking on the beach","A Sunday with family","Dinner with friends"]};
  const review=reviewVisibleProfile(input,"instagram_json");
  const send=vi.fn().mockResolvedValue({review});
  expect((await checkProfile(input,send,new AbortController().signal)).stage).toBe("database");
  expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][0].type).toBe("PROFILE_LOOKUP");
});
it("uses rules offline and does not equate a community opinion with a score",async()=>{
  const send=vi.fn().mockRejectedValue(new Error("offline"));
  const result=await checkProfile(ordinary,send,new AbortController().signal);
  expect(result.stage).toBe("rules");expect(result.review.reviewPriority).toBeNull();
  const community=await checkProfile(ordinary,vi.fn().mockResolvedValue({community:{reason:"Reported course experiences",sources:[]}}),new AbortController().signal);
  expect(community.stage).toBe("database");expect(community.review.reviewPriority).toBeNull();
});
it("uses AI only after rule uncertainty and never changes the rule score",async()=>{
  const input={username:"sample",biography:"I offer a trading academy for people interested in charts and market analysis. Courses open next month."};
  const review=reviewVisibleProfile(input);expect(needsAI(review,input)).toBe(true);
  const send=vi.fn().mockResolvedValueOnce({review:null}).mockResolvedValueOnce({available:true,explanation:"No income promise supplied.",credits:7});
  const result=await checkProfile(input,send,new AbortController().signal);
  expect(result.stage).toBe("ai");expect(result.review.reviewPriority).toBe(review.reviewPriority);expect(send.mock.calls.map(row=>row[0].type)).toEqual(["PROFILE_LOOKUP","AI_REVIEW"]);
});
it("ignores expired results and discards a response after navigation cancels the check",async()=>{
  const review=reviewVisibleProfile({...ordinary,captions:["one","two","three"]});review.expiresAt="2020-01-01T00:00:00.000Z";
  expect((await checkProfile(ordinary,vi.fn().mockResolvedValue({review}),new AbortController().signal)).stage).toBe("rules");
  const controller=new AbortController(),send=vi.fn().mockImplementation(async()=>{controller.abort();return {review};});
  await expect(checkProfile(ordinary,send,controller.signal)).rejects.toThrow();
  expect((await checkProfile(ordinary,vi.fn().mockResolvedValue({review:{invalid:true}}),new AbortController().signal)).stage).toBe("rules");
});
