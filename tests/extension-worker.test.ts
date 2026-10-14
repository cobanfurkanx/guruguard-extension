/// <reference types="chrome" />
import {afterEach,beforeEach,expect,it,vi} from "vitest";
let listener:(message:any,sender:any,respond:(data:any)=>void)=>unknown,stored:Record<string,any>,fetcher:ReturnType<typeof vi.fn>,tabsSend:ReturnType<typeof vi.fn>;
const own={id:"gg",url:"chrome-extension://gg/popup/popup.html"};
const profile={id:"gg",url:"https://www.instagram.com/demo/",tab:{id:1}};
beforeEach(async()=>{
  vi.resetModules();stored={gg_credit_token:"private-token",gg_auto_review:true};fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({accepted:true}),{status:202}));tabsSend=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal("fetch",fetcher);
  vi.stubGlobal("chrome",{runtime:{id:"gg",getURL:(p:string)=>`chrome-extension://gg/${p}`,onMessage:{addListener:(fn:any)=>listener=fn},onInstalled:{addListener:()=>{}},onStartup:{addListener:()=>{}}},permissions:{contains:async()=>true,onAdded:{addListener:()=>{}}},storage:{local:{setAccessLevel:async()=>{},get:async(key:string|string[])=>Object.fromEntries((Array.isArray(key)?key:[key]).map(k=>[k,stored[k]])),set:async(value:any)=>{await Promise.resolve();Object.assign(stored,value);},remove:async()=>{}}},scripting:{getRegisteredContentScripts:async()=>[],unregisterContentScripts:async()=>{},registerContentScripts:async()=>{}},tabs:{query:async()=>[{id:1}],sendMessage:tabsSend}});
  await import("../src/background/local-worker");
});
afterEach(()=>vi.unstubAllGlobals());
function message(data:any,sender:any=own){return new Promise<any>(resolve=>{if(listener(data,sender,resolve)!==true)resolve(undefined);});}
it("returns preferences without leaking wallet credentials and rejects inbox senders",async()=>{
  const value=await message({type:"GET_PREFERENCES"});expect(value).toEqual({hidden:[],automatic:true});expect(JSON.stringify(value)).not.toContain("private-token");
  expect(await message({type:"GET_PREFERENCES"},{...profile,url:"https://www.instagram.com/direct/inbox/"})).toBeUndefined();expect(fetcher).not.toHaveBeenCalled();
});
it("serializes concurrent hidden-list updates without losing any account",async()=>{
  const results=await Promise.all(Array.from({length:20},(_,i)=>message({type:"SET_HIDDEN",username:`u${i}`,hidden:true},profile)));
  expect(results.every(row=>row.ok)).toBe(true);expect(stored.gg_profile_preferences.hidden).toHaveLength(20);expect(fetcher).not.toHaveBeenCalled();
});
it("sends only explicit valid account suggestions to the existing moderated API",async()=>{
  expect(await message({type:"SUGGEST_ACCOUNT",username:"demo",reason:"short"})).toMatchObject({accepted:false});expect(fetcher).not.toHaveBeenCalled();
  expect(await message({type:"SUGGEST_ACCOUNT",username:"demo",reason:"Unrealistic income promise."})).toEqual({accepted:true});
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/account-suggestions$/);expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({username:"demo",reason:"Unrealistic income promise."});
});
it("turning protection off immediately notifies open Instagram tabs",async()=>{
  expect(await message({type:"SET_AUTOMATIC",enabled:false})).toEqual({ok:true});expect(stored.gg_auto_review).toBe(false);expect(tabsSend).toHaveBeenCalledWith(1,{type:"AUTOMATIC_STATE",enabled:false});
});
it("demo credits require no account and never send profile text or wallet credentials",async()=>{
  delete stored.gg_credit_token;
  fetcher.mockImplementation(async()=>new Response(JSON.stringify({mode:"mock"})));
  expect(await message({type:"CREDIT_BALANCE"})).toMatchObject({demo:true,credits:8});
  expect(await message({type:"AI_REVIEW",input:{biography:"Private fixture text"}},profile)).toMatchObject({available:false,reason:"demo"});
  expect(await message({type:"PAIR_CREDITS",code:"a".repeat(64)})).toMatchObject({paired:false});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/account\/config$/);
  expect(fetcher.mock.calls[0][1].body).toBeUndefined();expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
});
