import { type VisibleProfile } from "../shared/local-review";
import { checkProfile, type ProfileCheck } from "../lib/pipeline";
import { presentation } from "../lib/presentation";
import { createReviewView, icon, reviewStyles } from "../lib/review-view";
import { parsePreferences, type Preferences } from "../lib/preferences";
import { openBlockConfirmation } from "./block";
import { extractProfile, mergeVisible, profileUsername } from "./extract";
import { createFeedFilter } from "./feed";
import { within } from "../shared/deadline";

const scope=window as Window & {guruGuardInstalled?:boolean};
if(!scope.guruGuardInstalled){
  scope.guruGuardInstalled=true;
  let enabled=false,automaticEnabled=false,manualOwner="",owner="",signature="",accumulated:VisibleProfile|null=null,current:ProfileCheck|null=null;
  let panel:HTMLElement|null=null,curtain:HTMLElement|null=null,controller:AbortController|null=null,timer:ReturnType<typeof setTimeout>|undefined;
  let pendingCheck:Promise<ProfileCheck>|null=null;
  let hiddenMain:HTMLElement|null=null,originalInert=false,originalAria:string|null=null;
  let preferences:Preferences={hidden:[]},dismissed="",expanded=false;
  const highlights=new Set<string>(),aiAttempted=new Set<string>(),feed=createFeedFilter(document);
  const ready=chrome.runtime.sendMessage({type:"GET_PREFERENCES"}).then(value=>{preferences=parsePreferences(value);automaticEnabled=value?.automatic===true;enabled=automaticEnabled;}).catch(()=>{});
  function text(parent:HTMLElement,value:string,tag="p"){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
  function shell(){
    panel?.remove();panel=document.createElement("aside");panel.id="guruguard-local-review";panel.setAttribute("aria-label","GuruGuard profile check");
    panel.style.cssText="position:fixed;bottom:20px;right:20px;z-index:2147483646;width:min(328px,calc(100vw - 32px));max-height:calc(100vh - 48px)";
    const shadow=panel.attachShadow({mode:"open"}),style=document.createElement("style");
    style.textContent=reviewStyles+`.gg-panel{padding:18px;background:var(--gg-bg);border-radius:12px;box-shadow:0 6px 32px #0003;max-height:calc(100vh - 48px);overflow:auto}.gg-chip{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:12px 16px;border:0;border-radius:12px;background:#fff;color:#262626;box-shadow:0 4px 20px #0002;font:600 13px system-ui;cursor:pointer}.gg-dot{width:7px;height:7px;background:#666;border-radius:50%;flex-shrink:0}.gg-loading{display:flex;align-items:center;gap:10px;margin:16px 0 4px;color:#666;font-size:13px}.gg-spinner{width:18px;height:18px;border:2px solid #dbdbdb;border-top-color:#737373;border-radius:50%;animation:gg-spin .7s linear infinite}@keyframes gg-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.gg-spinner{animation:none}}@media(prefers-color-scheme:dark){:host{color-scheme:dark;--gg-bg:#202020;--gg-soft:#303030;--gg-ink:#f5f5f5;--gg-muted:#b8b8b8;--gg-line:#454545;--gg-red:#ff6479;--gg-blue:#75bcf0}.gg-panel{box-shadow:0 6px 32px #0006}.gg-chip{background:#202020;color:#f5f5f5}.gg-primary{background:#f5f5f5;color:#262626;border-color:#f5f5f5}.gg-danger .gg-primary,.gg-listed .gg-primary{background:#b51c32;color:#fff;border-color:#b51c32}.gg-caution .gg-title,.gg-listed .gg-title{color:#efb36b}.gg-loading{color:#b8b8b8}}`;
    shadow.append(style);document.body.append(panel);return shadow;
  }
  function compact(label:string){
    const shadow=shell(),chip=document.createElement("button");chip.className="gg-chip";chip.type="button";
    const dot=document.createElement("span");dot.className="gg-dot";dot.setAttribute("aria-hidden","true");chip.append(dot,document.createTextNode(`GuruGuard · ${label}`));
    chip.onclick=()=>{expanded=true;dismissed="";if(current)render(current);else{signature="";void tick();}};shadow.append(chip);
  }
  async function setHidden(name:string,hidden:boolean){
    const reply=await chrome.runtime.sendMessage({type:"SET_HIDDEN",username:name,hidden});
    if(!reply?.ok)throw new Error(reply?.error??"Could not save. Try again.");
    preferences=parsePreferences(reply.preferences);feed.apply(location.pathname,preferences.hidden);renderHidden();
    if(current&&owner===name)render(current);
  }
  function renderHidden(){
    clearCurtain();
    const name=profileUsername(location.pathname);
    if(!enabled||!name||!preferences.hidden.includes(name))return;
    controller?.abort();panel?.remove();
    curtain=document.createElement("aside");curtain.id="guruguard-hidden-profile";curtain.setAttribute("aria-label","Hidden profile");
    curtain.style.cssText="position:fixed;inset:0;z-index:2147483645;background:#fff;color:#262626;display:grid;place-items:center;font:14px/1.5 system-ui";
    const shadow=curtain.attachShadow({mode:"open"}),style=document.createElement("style");style.textContent=reviewStyles+":host{background:var(--gg-bg)}.gg-hidden{max-width:340px;padding:24px;text-align:center}.gg-hidden h2{font-size:24px;letter-spacing:-.03em}.gg-hidden .gg-button{width:100%;margin-top:10px}";shadow.append(style);
    const box=document.createElement("div");box.className="gg-hidden";text(box,"GuruGuard","strong");text(box,`@${name} is hidden`,"h2");text(box,"Your choice. Only in this browser.");
    const show=document.createElement("button");show.className="gg-button";show.textContent="Unhide profile";show.onclick=()=>{void setHidden(name,false).then(()=>{signature="";void tick();}).catch(()=>{show.textContent="Try again";});};box.append(show);
    const back=document.createElement("a");back.className="gg-button gg-primary";back.href="https://www.instagram.com/";back.textContent="Back to feed";box.append(back);shadow.append(box);document.body.append(curtain);
    hiddenMain=document.querySelector("main");if(hiddenMain){originalInert=hiddenMain.inert;originalAria=hiddenMain.getAttribute("aria-hidden");hiddenMain.inert=true;hiddenMain.setAttribute("aria-hidden","true");}show.focus();
  }
  function clearCurtain(){curtain?.remove();curtain=null;if(hiddenMain){hiddenMain.inert=originalInert;if(originalAria===null)hiddenMain.removeAttribute("aria-hidden");else hiddenMain.setAttribute("aria-hidden",originalAria);hiddenMain=null;}}
  function render(check:ProfileCheck){
    if(dismissed===owner){compact("Review dismissed");return;}
    if(preferences.hidden.includes(owner)){renderHidden();return;}
    const state=presentation(check);
    if(!expanded&&!state.expand){compact(state.title);return;}
    const shadow=shell(),box=document.createElement("div");box.className="gg-panel";
    const top=document.createElement("div");top.className="gg-top";text(top,"GuruGuard","span").className="gg-brand";
    const close=document.createElement("button");close.className="gg-close";close.type="button";close.setAttribute("aria-label","Dismiss this review");close.append(icon('<path d="m6 6 12 12M18 6 6 18"/>'));close.onclick=()=>{dismissed=owner;expanded=false;compact("Review dismissed");};top.append(close);box.append(top);
    box.append(createReviewView(check,{
      block:async()=>{if(!await openBlockConfirmation())throw new Error("Open the profile menu, then choose Block.");},
      hide:()=>setHidden(check.review.username,true),
      suggest:(username,reason)=>chrome.runtime.sendMessage({type:"SUGGEST_ACCOUNT",username,reason}),
    }));shadow.append(box);
  }
  async function tick(){
    await ready;
    if(!enabled)return;
    feed.apply(location.pathname,preferences.hidden);
    if(/^\/(?:direct|accounts|settings)(?:\/|$)/.test(location.pathname)){controller?.abort();accumulated=null;owner="";signature="";current=null;highlights.clear();panel?.remove();clearCurtain();return;}
    const name=profileUsername(location.pathname);
    if(!automaticEnabled&&manualOwner&&((name&&name!==manualOwner)||location.pathname==="/"||/^\/reels\/?$/.test(location.pathname))){enabled=false;controller?.abort();panel?.remove();clearCurtain();current=null;signature="";feed.apply("/direct/",[]);return;}
    if(name&&name!==owner){controller?.abort();owner=name;accumulated=null;signature="";current=null;expanded=false;dismissed="";highlights.clear();aiAttempted.clear();panel?.remove();clearCurtain();}
    if(name&&preferences.hidden.includes(name)){if(!curtain)renderHidden();return;}
    const input=extractProfile(document,location.pathname,owner,highlights);if(!input){if(!name){controller?.abort();panel?.remove();clearCurtain();current=null;}return;}
    accumulated=mergeVisible(accumulated,input);const next=JSON.stringify(accumulated,Object.keys(accumulated).sort());if(signature===next)return;signature=next;
    controller?.abort();const active=new AbortController();controller=active;
    if(!current){const shadow=shell(),box=document.createElement("div");box.className="gg-panel";text(box,"GuruGuard","strong");const loading=text(box,"","div");loading.className="gg-loading";loading.setAttribute("role","status");loading.setAttribute("aria-busy","true");const spinner=document.createElement("span");spinner.className="gg-spinner";spinner.setAttribute("aria-hidden","true");loading.append(spinner,document.createTextNode("Checking profile…"));shadow.append(box);}
    const timeout=setTimeout(()=>active.abort(),20000);
    const send=async(message:any)=>{
      if(message.type==="AI_REVIEW"){
        if(aiAttempted.has(input.username))return {available:false,reason:"already_checked"};
        aiAttempted.add(input.username);
      }
      return within(active.signal,()=>chrome.runtime.sendMessage(message));
    };
    const work=checkProfile(accumulated,send,active.signal);pendingCheck=work;
    try{const check=await work;if(controller===active&&!active.signal.aborted){current=check;render(check);}}
    catch{if(controller===active&&enabled){if(current)render(current);else compact("Retry check");}}
    finally{clearTimeout(timeout);if(pendingCheck===work)pendingCheck=null;}
  }
  new MutationObserver(records=>{if(!records.some(record=>!(record.target as Element).closest?.("#guruguard-local-review,#guruguard-block-review,#guruguard-hidden-profile")))return;clearTimeout(timer);timer=setTimeout(()=>void tick(),300);}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener("popstate",()=>void tick());window.addEventListener("hashchange",()=>void tick());setInterval(()=>void tick(),1000);
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message.type==="OPEN_BLOCK"){if(profileUsername(location.pathname)!==message.username){respond({opened:false});return;}void openBlockConfirmation().then(opened=>respond({opened})).catch(()=>respond({opened:false}));return true;}
    if(message.type==="AUTOMATIC_STATE"){automaticEnabled=Boolean(message.enabled);enabled=automaticEnabled;manualOwner="";signature="";if(enabled)void tick();else{controller?.abort();panel?.remove();clearCurtain();feed.apply("/direct/",[]);current=null;}respond({ok:true});}
    if(message.type==="STOP_REVIEW"){enabled=false;controller?.abort();panel?.remove();clearCurtain();feed.apply("/direct/",[]);current=null;signature="";respond({stopped:true});}
    if(message.type==="START_REVIEW"){void ready.then(async()=>{enabled=true;manualOwner=profileUsername(location.pathname)??"";expanded=true;dismissed="";if(owner===manualOwner&&current){render(current);return;}if(owner===manualOwner&&pendingCheck){await pendingCheck.catch(()=>{});if(current)render(current);return;}signature="";await tick();}).then(()=>respond(current));return true;}
    if(message.type==="VISIBLE_REVIEW")respond(current);
    if(message.type==="PREFERENCES_CHANGED"){preferences=parsePreferences(message.preferences);feed.apply(enabled?location.pathname:"/direct/",preferences.hidden);if(enabled){renderHidden();if(current)render(current);signature="";void tick();}respond({ok:true});}
  });
  void tick();
  if(location.hash==="#guruguard-block"&&profileUsername(location.pathname))void openBlockConfirmation();
}
