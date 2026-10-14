import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
import { JSDOM } from "jsdom";
import { createFeedFilter } from "../src/content/feed";
import { parsePreferences, updateHidden } from "../src/lib/preferences";
import { parseProfileCheck, presentation } from "../src/lib/presentation";
import { createReviewView } from "../src/lib/review-view";
import { reviewVisibleProfile } from "../src/shared/local-review";
import { openBlockConfirmation } from "../src/content/block";

let dom:JSDOM;
beforeEach(()=>{dom=new JSDOM('<main></main>',{url:"https://www.instagram.com/demo/"});vi.stubGlobal("document",dom.window.document);vi.stubGlobal("getComputedStyle",dom.window.getComputedStyle.bind(dom.window));});
afterEach(()=>{vi.unstubAllGlobals();dom.window.close();});
const high=()=>({review:reviewVisibleProfile({username:"demo",biography:"Guaranteed 10% daily profits. No risk. Join my VIP trading signals."}),stage:"rules" as const});
describe("consumer extension controls",()=>{
  it("keeps community opinions separate from rule scoring and sanitizes mixed client bundles",()=>{
    const check=parseProfileCheck({...high(),community:{reason:"Course experiences discussed",sources:["https://reddit.com/example","javascript:alert(1)"]}});
    expect(check.community?.sources).toEqual(["https://reddit.com/example"]);
    expect(presentation(check).title).toBe("On the community list");
    const view=createReviewView(check,{block:vi.fn(),hide:vi.fn(),suggest:vi.fn()});
    expect(view.querySelector(".gg-score")).toBeNull();expect(view.textContent).not.toContain("fraud probability");
    expect(parseProfileCheck(high().review).review.username).toBe("demo");
  });
  it("does not turn uncertain, stale or missing text into a definitive warning",()=>{
    const check=high();expect(presentation(check).tone).toBe("danger");
    expect(presentation({...check,review:{...check.review,status:"needs_review"}}).tone).toBe("caution");
    expect(presentation({...check,review:{...check.review,stale:true}}).expand).toBe(false);
    expect(presentation({review:reviewVisibleProfile({username:"demo",biography:""}),stage:"rules"}).title).toBe("Open a post to check more");
  });
  it("stores only bounded normalized account identifiers, with reversible personal hiding",()=>{
    const prefs=parsePreferences({hidden:["demo","demo","../bad","Other"],token:"secret"});expect(prefs).toEqual({hidden:["demo"]});
    expect(updateHidden(prefs,"demo",false).hidden).toEqual([]);
    expect(updateHidden(prefs,"other",true).hidden).toEqual(["demo","other"]);
    expect(()=>updateHidden({},"../bad",true)).toThrow();
    expect(()=>updateHidden({hidden:Array.from({length:500},(_,i)=>`u${i}`)},"new",true)).toThrow("full");
  });
  it("hides only selected author-labelled feed articles and restores styles on private routes/unhide",()=>{
    document.querySelector("main")!.innerHTML='<article id="a" style="display:flex"><header><a href="/demo/">demo</a></header>Post</article><article id="b"><header><a href="/other/">other</a></header><a href="/demo/">Comment</a></article><article id="c">No author</article>';
    const feed=createFeedFilter(document),a=document.getElementById("a")!;feed.apply("/",["demo"]);
    expect(a.style.display).toBe("none");expect(document.getElementById("b")!.style.display).toBe("");expect(document.getElementById("c")!.style.display).toBe("");
    feed.apply("/direct/inbox/",["demo"]);expect(a.style.display).toBe("flex");feed.apply("/",["demo"]);feed.apply("/",[]);expect(a.style.display).toBe("flex");
  });
  it("does not hide a recycled article belonging to another account",()=>{
    document.querySelector("main")!.innerHTML='<article><header><a href="/demo/">demo</a></header></article>';
    const feed=createFeedFilter(document),article=document.querySelector("article")!;feed.apply("/",["demo"]);article.querySelector("a")!.href="/other/";feed.apply("/",["demo"]);expect(article.style.display).toBe("");
  });
  it("renders untrusted text inertly and submits a reason only after an explicit form action",async()=>{
    const suggest=vi.fn().mockResolvedValue({accepted:true}),check={...high(),community:{reason:'<img src=x onerror=alert(1)>',sources:[]}};
    const view=createReviewView(check,{block:vi.fn(),hide:vi.fn(),suggest});document.body.append(view);expect(view.querySelector("img")).toBeNull();expect(suggest).not.toHaveBeenCalled();
    (view.querySelector(".gg-minor button") as HTMLButtonElement).click();expect(view.querySelector("form")!.hidden).toBe(false);
    (view.querySelector("textarea") as HTMLTextAreaElement).value="Unrealistic income guarantee.";
    view.querySelector("form")!.dispatchEvent(new dom.window.Event("submit",{cancelable:true}));await Promise.resolve();await Promise.resolve();
    expect(suggest).toHaveBeenCalledWith("demo","Unrealistic income guarantee.");expect(view.textContent).toContain("Submitted for review.");
  });
  it("opens only Instagram's first Block action and leaves final confirmation untouched",async()=>{
    document.querySelector("main")!.innerHTML='<header><button aria-label="Options">Options</button></header>';
    Object.defineProperty(dom.window.HTMLElement.prototype,"innerText",{get(){return this.textContent;},configurable:true});
    Object.defineProperty(dom.window.HTMLElement.prototype,"getClientRects",{value(){return [{width:100,height:20}];},configurable:true});
    const confirmed=vi.fn(),options=document.querySelector("button")!;options.onclick=()=>{const dialog=document.createElement("div");dialog.setAttribute("role","dialog");const button=document.createElement("button");button.textContent="Block";button.onclick=()=>{dialog.replaceChildren();const final=document.createElement("button");final.textContent="Block";final.onclick=confirmed;dialog.append(final);};dialog.append(button);document.body.append(dialog);};
    expect(await openBlockConfirmation()).toBe(true);expect(confirmed).not.toHaveBeenCalled();expect(document.querySelector('[role="dialog"] button')?.textContent).toBe("Block");
  });
});
