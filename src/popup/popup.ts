import { API_BASE } from "../lib/api";
import { reviewVisibleProfile } from "../shared/local-review";
import { searchProfile } from "../shared/profile-search";
import { profileUsername } from "../content/extract";
import { parseProfileCheck } from "../lib/presentation";
import { createReviewView, reviewStyles } from "../lib/review-view";
import { parsePreferences, type Preferences } from "../lib/preferences";
import type { ProfileCheck } from "../lib/pipeline";

const style=document.createElement("style");style.textContent=reviewStyles;document.head.append(style);
const form=document.querySelector<HTMLFormElement>("#search-form")!,input=document.querySelector<HTMLInputElement>("#username")!,scan=form.querySelector<HTMLButtonElement>("button")!,result=document.querySelector<HTMLElement>("#result")!,localScan=document.querySelector<HTMLButtonElement>("#local-scan")!;
const automatic=document.getElementById("auto-reviews") as HTMLInputElement,hiddenSelect=document.getElementById("hidden-profiles") as HTMLSelectElement,unhide=document.getElementById("unhide-profile") as HTMLButtonElement;
let request:AbortController|null=null,generation=0,current:ProfileCheck|null=null,preferences:Preferences={hidden:[]};
function add(tag:string,text:string,className=""){const el=document.createElement(tag);el.textContent=text;el.className=className;result.append(el);return el;}
function loading(){result.replaceChildren();const box=add("div","","loading");box.setAttribute("role","status");const spinner=document.createElement("span");spinner.className="loading-circle";spinner.setAttribute("aria-hidden","true");box.append(spinner,document.createTextNode("Checking profile…"));result.setAttribute("aria-busy","true");}
function refreshHidden(){hiddenSelect.replaceChildren();if(!preferences.hidden.length){hiddenSelect.add(new Option("No hidden accounts",""));unhide.disabled=true;return;}for(const name of preferences.hidden)hiddenSelect.add(new Option(`@${name}`,name));unhide.disabled=false;}
async function hideAccount(username:string,hidden:boolean){const reply=await chrome.runtime.sendMessage({type:"SET_HIDDEN",username,hidden});if(!reply?.ok)throw new Error(reply?.error??"Could not save. Try again.");preferences=parsePreferences(reply.preferences);refreshHidden();if(current)showReview(current);}
async function block(username:string){
  const tabs=await chrome.tabs.query({active:true,currentWindow:true}),tab=tabs[0];
  if(tab?.id&&tab.url&&new URL(tab.url).hostname==="www.instagram.com"&&profileUsername(new URL(tab.url).pathname)===username){
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content/content.js"]});
    const reply=await chrome.tabs.sendMessage(tab.id,{type:"OPEN_BLOCK",username});if(!reply?.opened)throw new Error("Open the profile menu, then choose Block.");
  }else await chrome.tabs.create({url:`https://www.instagram.com/${encodeURIComponent(username)}/#guruguard-block`});
}
function showReview(raw:unknown){
  const check=parseProfileCheck(raw);current=check;result.replaceChildren();result.setAttribute("aria-busy","false");
  result.append(createReviewView(check,{block:()=>block(check.review.username),hide:()=>hideAccount(check.review.username,!preferences.hidden.includes(check.review.username)),hidden:preferences.hidden.includes(check.review.username),suggest:(username,reason)=>chrome.runtime.sendMessage({type:"SUGGEST_ACCOUNT",username,reason})}));
}
function error(message:string){result.replaceChildren();result.setAttribute("aria-busy","false");add("p",message,"empty");}
form.addEventListener("submit",event=>{
  event.preventDefault();const username=input.value.trim().replace(/^@/,"").toLowerCase();
  if(!/^[a-z0-9._]{1,30}$/.test(username)){error("Enter a valid username.");return;}
  request?.abort();const controller=new AbortController();request=controller;const id=++generation,timeout=setTimeout(()=>controller.abort(),22000);
  scan.disabled=true;localScan.disabled=false;loading();
  void (async()=>{
    const response=await fetch(`${API_BASE}/api/extension/profile?username=${encodeURIComponent(username)}`,{headers:{"X-GuruGuard-Version":"2"},signal:controller.signal}).catch(()=>null);
    if(response?.status===426)throw new Error("Update GuruGuard.");
    const lookup=response?.ok?await response.json():null;
    if(lookup?.community)return parseProfileCheck({review:lookup.review??reviewVisibleProfile({username,biography:""}),community:lookup.community,stage:"database"});
    return parseProfileCheck(await searchProfile(username,{base:API_BASE,signal:controller.signal}));
  })().then(r=>{if(generation===id)showReview(r);}).catch(e=>{if(generation===id)error(e instanceof Error&&e.message==="Update GuruGuard."?e.message:"Could not load this profile. Check its open Instagram page.");}).finally(()=>{clearTimeout(timeout);if(generation===id){scan.disabled=false;result.setAttribute("aria-busy","false");}});
});
async function scanOpen(automaticStart=false){
  request?.abort();request=null;const id=++generation;scan.disabled=false;localScan.disabled=true;
  try{
    const tabs=await chrome.tabs.query({active:true,currentWindow:true}),tab=tabs[0];
    if(!tab?.id||!tab.url)throw new Error("Open an Instagram profile first.");
    const url=new URL(tab.url),name=url.hostname==="www.instagram.com"?profileUsername(url.pathname):null;
    if(!name)throw new Error("Open an Instagram profile first.");
    document.getElementById("current-profile-label")!.textContent=`Check @${name}`;
    const raw=await chrome.tabs.sendMessage(tab.id,{type:"VISIBLE_REVIEW"}).catch(()=>null);
    if(raw&&parseProfileCheck(raw).review.username===name){if(generation===id)showReview(raw);return;}
    if(automaticStart&&!automatic.checked)return;
    loading();await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content/content.js"]});
    const check=await chrome.tabs.sendMessage(tab.id,{type:"START_REVIEW"});
    if(!check){if(preferences.hidden.includes(name)){error(`@${name} is hidden. Unhide it in Settings.`);return;}throw new Error("Wait for the profile to load. Private profiles are excluded.");}
    if(generation===id)showReview(check);
  }catch(e){if(generation===id&&!automaticStart)error(e instanceof Error?e.message:"Open the profile and try again.");}
  finally{if(generation===id){localScan.disabled=false;result.setAttribute("aria-busy","false");}}
}
localScan.onclick=()=>void scanOpen();
function protectionLabel(){document.getElementById("protection-label")!.textContent=automatic.checked?"Protection is on":"Protection is off";document.getElementById("permission-status")!.textContent=automatic.checked?"Profiles checked as you browse.":"Enable once. Checks run as you browse.";}
automatic.onchange=()=>{automatic.disabled=true;void(async()=>{
  if(automatic.checked&&!await chrome.permissions.request({origins:["https://www.instagram.com/*"]})){automatic.checked=false;protectionLabel();document.getElementById("permission-status")!.textContent="Instagram permission is needed.";return;}
  const reply=await chrome.runtime.sendMessage({type:"SET_AUTOMATIC",enabled:automatic.checked});if(!reply?.ok)throw new Error("Could not save. Try again.");protectionLabel();if(automatic.checked)await scanOpen();
})().catch(()=>{automatic.checked=!automatic.checked;protectionLabel();document.getElementById("permission-status")!.textContent="Could not save. Try again.";}).finally(()=>{automatic.disabled=false;});};
void Promise.all([chrome.permissions.contains({origins:["https://www.instagram.com/*"]}),chrome.storage.local.get("gg_auto_review"),chrome.runtime.sendMessage({type:"GET_PREFERENCES"})]).then(([granted,settings,prefs])=>{automatic.checked=granted&&settings.gg_auto_review!==false;preferences=parsePreferences(prefs);refreshHidden();protectionLabel();if(generation===0)void scanOpen(true);}).catch(()=>{protectionLabel();});
unhide.onclick=()=>{const name=hiddenSelect.value;if(!name)return;unhide.disabled=true;void hideAccount(name,false).then(()=>{document.getElementById("hidden-status")!.textContent=`@${name} is visible again.`;}).catch(e=>{document.getElementById("hidden-status")!.textContent=e instanceof Error?e.message:"Try again.";}).finally(()=>{unhide.disabled=!preferences.hidden.length;});};
async function creditBalance(){const data=await chrome.runtime.sendMessage({type:"CREDIT_BALANCE"});document.getElementById("credit-balance")!.textContent=data?.demo?"8 demo credits · Purchases are paused.":typeof data?.credits==="number"?`${data.credits} AI credits left. Profile checks are free.`:"Connect your account to use AI credits.";document.getElementById("credit-count")!.textContent=data?.demo?"Preview":typeof data?.credits==="number"?String(data.credits):"";document.getElementById("pair-form")!.hidden=Boolean(data?.demo);}
void creditBalance().catch(()=>{});
document.getElementById("pair-form")!.addEventListener("submit",event=>{event.preventDefault();const code=(document.getElementById("pair-code") as HTMLInputElement).value.trim(),status=document.getElementById("pair-status")!,button=(event.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>("button")!;if(!/^[a-f0-9]{64}$/.test(code)){status.textContent="Paste the code from your account page.";return;}button.disabled=true;void chrome.runtime.sendMessage({type:"PAIR_CREDITS",code}).then(data=>{status.textContent=data?.paired?"Account connected.":data?.error??"Could not connect.";if(data?.paired){(document.getElementById("pair-code") as HTMLInputElement).value="";void creditBalance();}}).catch(()=>{status.textContent="Could not connect.";}).finally(()=>{button.disabled=false;});});
