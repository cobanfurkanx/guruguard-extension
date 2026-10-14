import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { extractProfile, mergeVisible, profileUsername } from "../src/content/extract";
const doc = (html: string) => new JSDOM(html, { url:"https://www.instagram.com/demo/" }).window.document;
describe("local profile privacy and ownership", () => {
  it("never extracts inbox, login or reserved paths", () => {
    for (const p of ["/direct/", "/direct/inbox/", "/accounts/", "/explore/"]) {
      expect(profileUsername(p)).toBeNull();
      expect(extractProfile(doc('<main>Guaranteed income</main>'),p,"demo",new Set())).toBeNull();
    }
  });
  it("checks author ownership and excludes other people's comments", () => {
    const d = doc('<main><header><h2>demo</h2><span>Education</span></header><article><header><a href="/demo/">demo</a></header><h1>Guaranteed income</h1><div>comment: Zero risk investing</div></article><article><header><a href="/other/">other</a></header><h1>Get rich quick</h1></article></main>');
    expect(extractProfile(d,"/demo/","",new Set())?.captions).toEqual(["Guaranteed income"]);
    expect(extractProfile(d,"/other/","",new Set())).toBeNull();
  });
  it("does not extract private profiles", () => {
    expect(extractProfile(doc('<main><header><h2>demo</h2></header>This account is private</main>'),"/demo/","",new Set())).toBeNull();
  });
  it("retains biography when a highlight is opened and resets for another owner", () => {
    const a = { username:"demo", biography:"Guaranteed income", captions:["Hello"] };
    const b = mergeVisible(a,{ username:"demo", biography:"", highlights:["Zero risk investing"] });
    expect(b.biography).toBe(a.biography); expect(b.captions).toEqual(["Hello"]);
    expect(mergeVisible(b,{ username:"other", biography:"Education" }).highlights).toBeUndefined();
  });
});
