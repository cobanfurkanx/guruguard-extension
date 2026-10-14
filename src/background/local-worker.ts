import { API_BASE } from "../lib/config";
import { PREFERENCES_KEY, parsePreferences, updateHidden } from "../lib/preferences";
const TOKEN="gg_credit_token", SCRIPT="guruguard-profiles";

async function automaticProfiles() {
  await chrome.storage.local.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"});
  if(!await chrome.permissions.contains({origins:["https://www.instagram.com/*"]}))return;
  const setting=await chrome.storage.local.get("gg_auto_review"),existing=await chrome.scripting.getRegisteredContentScripts({ids:[SCRIPT]});
  if(existing.length)await chrome.scripting.unregisterContentScripts({ids:[SCRIPT]});
  if(setting.gg_auto_review===false)return;
  await chrome.scripting.registerContentScripts([{id:SCRIPT,matches:["https://www.instagram.com/*"],excludeMatches:["https://www.instagram.com/direct/*","https://www.instagram.com/accounts/*"],js:["content/content.js"],runAt:"document_idle",persistAcrossSessions:true}]);
}
let registration=Promise.resolve();
function scheduleAutomatic(){registration=registration.catch(()=>{}).then(automaticProfiles);return registration;}
chrome.runtime.onInstalled.addListener(()=>void scheduleAutomatic().catch(()=>{}));
chrome.runtime.onStartup.addListener(()=>void scheduleAutomatic().catch(()=>{}));
chrome.permissions.onAdded.addListener(()=>void scheduleAutomatic().catch(()=>{}));
void scheduleAutomatic().catch(()=>{});
const lookups=new Map<string,{until:number;promise:Promise<unknown>}>();
let creditConfig:{until:number;promise:Promise<{mode?:string}>}|undefined;
async function creditsMode(){
  if(!creditConfig||creditConfig.until<Date.now())creditConfig={until:Date.now()+60000,promise:fetch(`${API_BASE}/api/account/config`,{headers:{"X-GuruGuard-Version":"2"},signal:AbortSignal.timeout(3000)}).then(response=>{if(!response.ok)throw new Error("Unavailable");return response.json();})};
  return creditConfig.promise;
}
async function call(path:string,body?:unknown,authed=false,timeout=9000){
  const headers:Record<string,string>={"X-GuruGuard-Version":"2","Content-Type":"application/json"};
  if((authed||path==="/api/account/exchange")&&(await creditsMode()).mode==="mock")return {available:false,reason:"demo",mode:"mock",demo:true,credits:8,freeCredits:8};
  if(authed){const stored=await chrome.storage.local.get(TOKEN);if(!stored[TOKEN])return {available:false,reason:"sign_in"};headers.Authorization=`Bearer ${stored[TOKEN]}`;}
  const response=await fetch(`${API_BASE}${path}`,{method:body===undefined?"GET":"POST",headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(timeout)}),data=await response.json();
  if(!response.ok){if(response.status===401&&authed)await chrome.storage.local.remove(TOKEN);return {available:false,reason:data.reason??"unavailable",error:data.error,status:response.status};}return data;
}
let preferencesWrite=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  const ownUI=sender.id===chrome.runtime.id&&!sender.tab&&sender.url?.startsWith(chrome.runtime.getURL(""));
  let publicProfile=false;
  try{const url=new URL(sender.url??"");publicProfile=url.hostname==="www.instagram.com"&&!/^\/(?:direct|accounts|settings)(?:\/|$)/.test(url.pathname);}catch{}
  if(!ownUI&&!publicProfile)return;
  if(message.type==="GET_PREFERENCES"){
    void Promise.all([chrome.storage.local.get([PREFERENCES_KEY,"gg_auto_review"]),chrome.permissions.contains({origins:["https://www.instagram.com/*"]})]).then(([stored,granted])=>respond({...parsePreferences(stored[PREFERENCES_KEY]),automatic:granted&&stored.gg_auto_review!==false})).catch(()=>respond({hidden:[],automatic:false}));return true;
  }
  if(message.type==="SET_HIDDEN" && typeof message.hidden==="boolean" && typeof message.username==="string"){
    preferencesWrite=preferencesWrite.catch(()=>{}).then(async()=>{
      const stored=await chrome.storage.local.get(PREFERENCES_KEY),prefs=updateHidden(stored[PREFERENCES_KEY],message.username,message.hidden);
      await chrome.storage.local.set({[PREFERENCES_KEY]:prefs});
      for(const tab of await chrome.tabs.query({url:"https://www.instagram.com/*"}))if(tab.id)void chrome.tabs.sendMessage(tab.id,{type:"PREFERENCES_CHANGED",preferences:prefs}).catch(()=>{});
      respond({ok:true,preferences:prefs});
    }).catch(error=>respond({ok:false,error:error instanceof Error?error.message:"Could not save."}));return true;
  }
  if(message.type==="SUGGEST_ACCOUNT"){
    if(typeof message.username!=="string"||!/^[a-z0-9._]{1,30}$/.test(message.username)||typeof message.reason!=="string"||message.reason.trim().length<10||message.reason.length>700){respond({accepted:false,error:"Add a reason (10–700 characters)."});return;}
    void call("/api/account-suggestions",{username:message.username,reason:message.reason.trim()}).then(respond).catch(()=>respond({accepted:false}));return true;
  }
  if(ownUI&&message.type==="SET_AUTOMATIC"){
    void chrome.storage.local.set({gg_auto_review:Boolean(message.enabled)}).then(scheduleAutomatic).then(async()=>{for(const tab of await chrome.tabs.query({url:"https://www.instagram.com/*"})){if(tab.id)void chrome.tabs.sendMessage(tab.id,{type:"AUTOMATIC_STATE",enabled:Boolean(message.enabled)}).catch(()=>{});}respond({ok:true});}).catch(()=>respond({ok:false}));return true;
  }
  if(ownUI&&message.type==="PAIR_CREDITS"){
    void call("/api/account/exchange",{code:message.code}).then(async data=>{if(typeof data.token==="string"&&/^[a-f0-9]{64}$/.test(data.token)){await chrome.storage.local.set({[TOKEN]:data.token});respond({paired:true});}else respond({paired:false,error:data.error});}).catch(()=>respond({paired:false}));return true;
  }
  if(ownUI&&message.type==="CREDIT_BALANCE"){void call("/api/credits/balance",undefined,true).then(respond).catch(()=>respond({available:false}));return true;}
  if(!publicProfile)return;
  if(message.type==="PROFILE_LOOKUP"){
    if(typeof message.username!=="string"||!/^[a-z0-9._]{1,30}$/.test(message.username))return;
    let entry=lookups.get(message.username);
    if(!entry||entry.until<Date.now()){
      entry={until:Date.now()+60000,promise:call(`/api/extension/profile?username=${encodeURIComponent(message.username)}`,undefined,false,3000)};lookups.set(message.username,entry);
      if(lookups.size>100)lookups.delete(lookups.keys().next().value!);
    }
    void entry.promise.then(respond).catch(()=>respond({review:null,community:null}));return true;
  }
  if(message.type==="AI_REVIEW"){void call("/api/credits/review",message.input,true,14000).then(respond).catch(()=>respond({available:false,reason:"unavailable"}));return true;}
  if(message.type==="INSPECT_LINK"){void call("/api/link",{username:message.username,url:message.url},false,4500).then(respond).catch(()=>respond({available:false}));return true;}
  if(message.type==="CONTRIBUTE"){void call("/api/contributions",message.input,false,5000).then(respond).catch(()=>respond({accepted:false}));return true;}
});
