/// <reference types="chrome" />
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {JSDOM} from "jsdom";

let dom:JSDOM,send:ReturnType<typeof vi.fn>,listeners:Array<(message:unknown,sender:unknown,reply:(value:unknown)=>void)=>unknown>;
function profile(name:string){document.querySelector("main")!.innerHTML=`<header><h2>${name}</h2><p>Guaranteed 10% daily profits. No risk. Join my VIP trading signals.</p></header>`;dom.window.history.pushState({},"",`/${name}/`);}
beforeEach(()=>{
  vi.resetModules();vi.useFakeTimers();listeners=[];
  dom=new JSDOM('<main></main>',{url:"https://www.instagram.com/demo/"});
  vi.stubGlobal("window",dom.window);vi.stubGlobal("document",dom.window.document);vi.stubGlobal("location",dom.window.location);vi.stubGlobal("MutationObserver",dom.window.MutationObserver);
  send=vi.fn().mockImplementation(async(message:any)=>message.type==="GET_PREFERENCES"?{hidden:[],automatic:true}:message.type==="PROFILE_LOOKUP"?{review:null}:{});
  vi.stubGlobal("chrome",{runtime:{sendMessage:send,onMessage:{addListener:(fn:any)=>listeners.push(fn)}}});profile("demo");
});
afterEach(async()=>{dom.window.close();await Promise.resolve();vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
async function start(){await import("../src/content/content");await vi.advanceTimersByTimeAsync(50);}
function message(value:unknown){return new Promise(resolve=>listeners[0](value,{},resolve));}
it("dismisses one review without disabling checks on the next profile",async()=>{
  await start();const panel=document.getElementById("guruguard-local-review")!;expect(panel.shadowRoot!.textContent).toContain("High-pressure offer");
  (panel.shadowRoot!.querySelector(".gg-close") as HTMLButtonElement).click();expect(document.getElementById("guruguard-local-review")!.shadowRoot!.textContent).toContain("Review dismissed");
  profile("other");await vi.advanceTimersByTimeAsync(1100);expect(document.getElementById("guruguard-local-review")!.shadowRoot!.textContent).toContain("@other");expect(send.mock.calls.filter(row=>row[0].type==="PROFILE_LOOKUP").map(row=>row[0].username)).toEqual(["demo","other"]);
});
it("returns the whole result to the popup and does not restart a finished check",async()=>{
  send.mockImplementation(async(message:any)=>message.type==="GET_PREFERENCES"?{hidden:[],automatic:true}:{review:null,community:{reason:"Course criticism",sources:["https://reddit.com/r/example"]}});
  await start();const calls=send.mock.calls.length,visible=await message({type:"VISIBLE_REVIEW"});expect(visible).toMatchObject({community:{reason:"Course criticism"}});
  expect(await message({type:"START_REVIEW"})).toMatchObject({community:{reason:"Course criticism"}});expect(send.mock.calls.length).toBe(calls);
});
it("stops on inbox routes and rejects a block request for the previous owner",async()=>{
  await start();const calls=send.mock.calls.length;dom.window.history.pushState({},"","/direct/inbox/");await vi.advanceTimersByTimeAsync(1100);
  expect(document.getElementById("guruguard-local-review")).toBeNull();expect(send.mock.calls.length).toBe(calls);expect(await message({type:"VISIBLE_REVIEW"})).toBeNull();expect(await message({type:"OPEN_BLOCK",username:"demo"})).toEqual({opened:false});
});
it("honors protection off, and a manual check cannot enable automatic checks on other profiles",async()=>{
  send.mockImplementation(async(message:any)=>message.type==="GET_PREFERENCES"?{hidden:[],automatic:false}:{review:null});
  await start();expect(send.mock.calls.map(row=>row[0].type)).toEqual(["GET_PREFERENCES"]);
  expect(await message({type:"START_REVIEW"})).toMatchObject({review:{username:"demo"}});
  profile("other");await vi.advanceTimersByTimeAsync(1100);expect(document.getElementById("guruguard-local-review")).toBeNull();expect(send.mock.calls.filter(row=>row[0].type==="PROFILE_LOOKUP")).toHaveLength(1);
});
it("hides a personally selected profile without lookup, model or private-content access",async()=>{
  send.mockImplementation(async()=>({hidden:["demo"],automatic:true}));await start();expect(document.getElementById("guruguard-hidden-profile")!.shadowRoot!.textContent).toContain("@demo is hidden");expect(send).toHaveBeenCalledTimes(1);expect(document.querySelector("main")!.getAttribute("aria-hidden")).toBe("true");
  await message({type:"AUTOMATIC_STATE",enabled:false});expect(document.getElementById("guruguard-hidden-profile")).toBeNull();expect(document.querySelector("main")!.getAttribute("aria-hidden")).toBeNull();
});
