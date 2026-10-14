import { parseReviewResponse, type ReviewResponse } from "./review-contract";

/** One user search: cache first, collect on a miss, reuse pending snapshots. */
export async function searchProfile(username:string, options:{base?:string;signal:AbortSignal;refresh?:boolean;fetcher?:typeof fetch}):Promise<ReviewResponse>{
 const fetcher=options.fetcher??fetch;
 const base=options.base??"";
 const headers={"X-GuruGuard-Version":"2"};
 const read=async(detail:boolean)=>{
  const response=await fetcher(detail?`${base}/api/details${options.refresh?"?refresh=true":""}`:`${base}/api/check?username=${encodeURIComponent(username)}`,{method:detail?"POST":"GET",headers:detail?{...headers,"Content-Type":"application/json"}:headers,...(detail?{body:JSON.stringify({username})}:{}),signal:options.signal});
  if(response.status===426)throw new Error("Update GuruGuard.");
  if(!response.ok)throw new Error("Profile checks are unavailable.");
  return parseReviewResponse(await response.json());
 };
 if(!options.refresh){const saved=await read(false);if(saved.servedFromCache)return saved;}
 const started=Date.now();
 while(true){
  options.signal.throwIfAborted();
  const result=await read(true);
  if(!result.pending||Date.now()-started>=17000)return result;
  await new Promise<void>((resolve,reject)=>{
   const cancel=()=>{clearTimeout(timer);reject(options.signal.reason);};
   const timer=setTimeout(()=>{options.signal.removeEventListener("abort",cancel);resolve();},2000);
   options.signal.addEventListener("abort",cancel,{once:true});
   if(options.signal.aborted)cancel();
  });
 }
}
