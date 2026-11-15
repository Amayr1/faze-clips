import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClipService, normalizeClip, parseClipQuery, trustedClipUrl, InputError } from "../lib/kick.mjs";

const raw = {
  id: "clip_01K3VHCYJPCACGTJEFFJJH41FN",
  title: "Broke clutch", category: { name: "Counter-Strike 2" },
  channel: { slug: "blastpremier", username: "BLASTPremier" },
  video_url: "https://clips.kick.com/clips/0c/clip_01K3VHCYJPCACGTJEFFJJH41FN/playlist.m3u8",
  thumbnail_url: "https://clips.kick.com/clips/0c/clip_01K3VHCYJPCACGTJEFFJJH41FN/thumbnail.webp",
  created_at: "2025-08-29T18:29:02.396548Z", duration: 21, views: 9023, is_mature: true,
};
const jsonResponse = (clips) => new Response(JSON.stringify({ clips }), { headers: { "Content-Type": "application/json" } });

test("channel and enum validation rejects unsafe and oversized requests", () => {
  assert.deepEqual(parseClipQuery("").channels, ["fazerain", "eslcs", "valorant", "xqc", "yourrage", "saab", "sennadobone", "ninja"]);
  assert.deepEqual(parseClipQuery("channels=ESLCS,blastpremier,eslcs&sort=date&time=week"), {
    channels: ["eslcs", "blastpremier"], sort: "date", time: "week",
  });
  for (const query of ["channels=", "channels=../api", "channels=a/b", "channels=x%3Fq=a", "channels=a,b,c,d,e,f,g,h,i,j,k,l,m", "sort=recent", "time=year"]) {
    assert.throws(() => parseClipQuery(query), InputError);
  }
});

test("media URL allowlist cannot be escaped by hostname, credentials or encoded paths", () => {
  assert.equal(trustedClipUrl(raw.video_url), raw.video_url);
  for (const url of [
    raw.video_url.replace("https:", "http:"),
    raw.video_url.replace("clips.kick.com", "clips.kick.com.evil.test"),
    raw.video_url.replace("clips.kick.com", "evil.test@clips.kick.com"),
    raw.video_url.replace("clips.kick.com", "clips.kick.com:8443"),
    "javascript:alert(1)", "https://clips.kick.com/clips/%2e%2e/api/private.m3u8",
    "https://clips.kick.com/clips/a/clip/thumbnail.svg",
    raw.video_url + "#bad", raw.thumbnail_url,
  ]) assert.equal(trustedClipUrl(url), "", url);
});

test("normalization keeps real game metadata, canonical attribution and mature flag", () => {
  const clip = normalizeClip(raw, "blastpremier");
  assert.equal(clip.views, 9023);
  assert.equal(clip.isMature, true);
  assert.equal(clip.url, `https://kick.com/blastpremier/clips/${raw.id}`);
  assert.equal(clip.createdAt, "2025-08-29T18:29:02.396Z");
  for (const invalid of [
    { ...raw, category: { name: "Slots & Casino" } },
    { ...raw, id: "<script>" }, { ...raw, duration: 181 },
    { ...raw, created_at: "invalid" }, { ...raw, video_url: "https://evil.test/video.mp4" },
    { ...raw, channel: { slug: "someoneelse" } },
    { ...raw, channel: { slug: 123 } },
  ]) assert.equal(normalizeClip(invalid, "blastpremier"), null);
});

test("cache reuses requests, expires and coalesces concurrent reads", async () => {
  let clock = Date.parse("2026-11-15T00:00:00Z");
  let calls = 0;
  const service = createClipService({ now: () => clock, ttlMs: 100,
    fetcher: async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 5)); return jsonResponse([raw]); },
  });
  await Promise.all([service.getClips("channels=blastpremier"), service.getClips("channels=blastpremier")]);
  assert.equal(calls, 1);
  await service.getClips("channels=blastpremier");
  assert.equal(calls, 1);
  clock += 101;
  await service.getClips("channels=blastpremier");
  assert.equal(calls, 2);
});

test("a failed source preserves successful clips and labels snapshot fallback", async () => {
  const snapshotClip = normalizeClip({ ...raw, channel: { slug: "pgl", username: "PGL" }, id: "clip_01JF54CHGCP0CG7593H5FD6FX0", views: 6000 }, "pgl");
  const capturedAt = "2026-11-14T12:00:00.000Z";
  const service = createClipService({ snapshot: { clips: [snapshotClip], capturedAt }, fetcher: async (url) => {
    if (url.includes("/pgl/")) return new Response("blocked", { status: 403 });
    return jsonResponse([raw]);
  } });
  const feed = await service.getClips("channels=blastpremier,pgl");
  assert.equal(feed.clips.length, 2);
  assert.deepEqual(feed.sources.map((source) => source.status), ["live", "cached"]);
  assert.equal(feed.mode, "cached");
  assert.equal(feed.capturedAt, capturedAt);
  assert.deepEqual(feed.errors.map((error) => error.channel), ["pgl"]);
});

test("empty feeds stay empty and upstream HTML is an error, with no fabricated clips", async () => {
  const empty = createClipService({ fetcher: async () => jsonResponse([]) });
  assert.equal((await empty.getClips("channels=blastpremier")).sources[0].status, "live");
  const blocked = createClipService({ fetcher: async () => new Response("<html>challenge</html>") });
  const feed = await blocked.getClips("channels=blastpremier");
  assert.deepEqual(feed.clips, []);
  assert.equal(feed.sources[0].status, "unavailable");
  assert.equal(feed.capturedAt, null);
});

test("edge-compatible redirect handling rejects redirects rather than following them", async () => {
  const service = createClipService({ fetcher: async (_url, init) => {
    assert.equal(init.redirect, "manual");
    return new Response(null, { status: 302, headers: { Location: "https://evil.test" } });
  } });
  const feed = await service.getClips("channels=blastpremier");
  assert.equal(feed.sources[0].status, "unavailable");
  assert.equal(feed.errors.length, 1);
  assert.deepEqual(feed.clips, []);
});

test("cache is bounded, stale reads are labeled and recent filters also apply to fallback", async () => {
  let clock = Date.parse("2026-11-15T00:00:00Z");
  let fail = false;
  const service = createClipService({ now: () => clock, ttlMs: 10, maxEntries: 2,
    snapshot: { clips: [normalizeClip(raw, "blastpremier")], capturedAt: "2026-11-14T12:00:00Z" },
    fetcher: async () => { if (fail) throw new Error("offline"); return jsonResponse([raw]); },
  });
  await service.getClips("channels=blastpremier");
  clock += 11; fail = true;
  assert.equal((await service.getClips("channels=blastpremier")).mode, "cached");
  assert.equal((await service.getClips("channels=blastpremier&time=day")).clips.length, 0);
  fail = false;
  await service.getClips("channels=eslcs,pgl");
  assert.equal(service.cacheSize, 2);
});

test("request timeouts fail promptly and use clearly labeled fallbacks", async () => {
  const service = createClipService({ timeoutMs: 10, fetcher: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }) });
  const feed = await service.getClips("channels=blastpremier");
  assert.match(feed.errors[0].message, /too long/);
  assert.equal(feed.sources[0].status, "unavailable");
});

test("bundled fallback contains real attributed Kick URLs and snapshot metadata", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../public/data/clips.json", import.meta.url), "utf8"));
  assert.equal(snapshot.cachedSnapshot, true);
  assert.ok(Date.parse(snapshot.capturedAt));
  assert.ok(snapshot.clips.length > 0);
  assert.ok(snapshot.clips.some((clip) => /faze|broky/i.test(clip.title)));
  assert.ok(snapshot.clips.some((clip) => clip.channel === "valorant" && clip.category === "VALORANT"));
  for (const clip of snapshot.clips) {
    assert.equal(trustedClipUrl(clip.videoUrl), clip.videoUrl);
    assert.equal(trustedClipUrl(clip.thumbnail, "thumbnail"), clip.thumbnail);
    assert.equal(clip.url, `https://kick.com/${clip.channel}/clips/${clip.id}`);
    assert.equal(typeof clip.isMature, "boolean");
  }
});

test("creator pagination preserves the source cursor and isolates page caches", async()=>{
 const seen=[];
 const service=createClipService({fetcher:async(url)=>{
  const params=new URL(url).searchParams;seen.push(params.get('cursor'));
  return Response.json({clips:[{...raw,id:params.has('cursor')?'clip_ABCDEFGHIJKLMNOPQRSTUVWX':'clip_01K3VHCYJPCACGTJEFFJJH41FN'}],...(params.has('cursor')?{}:{nextCursor:'native+/=cursor'})});
 }});
 const first=await service.getClips('channels=blastpremier');
 assert.equal(first.sources[0].nextCursor,'native+/=cursor');
 const second=await service.getClips(new URLSearchParams({channels:'blastpremier',cursor:first.sources[0].nextCursor}));
 assert.equal(second.sources[0].nextCursor,null);assert.notEqual(first.clips[0].id,second.clips[0].id);
 assert.deepEqual(seen,[null,'native+/=cursor']);
 assert.throws(()=>parseClipQuery('channels=a,b&cursor=x'),InputError);
 assert.throws(()=>parseClipQuery('channels=a&cursor='),InputError);
});
test("a failed later page never falls back to first-page snapshot clips",async()=>{
 const service=createClipService({snapshot:{clips:[normalizeClip(raw,'blastpremier')],capturedAt:'2026-11-15'},fetcher:async()=>{throw Error('offline');}});
 const page=await service.getClips('channels=blastpremier&cursor=second-page');
 assert.equal(page.clips.length,0);assert.equal(page.sources[0].status,'unavailable');
});
test("creator search can include every source category without changing the gaming feed default",async()=>{
 const source={...raw,category:{name:'Slots & Casino'}};
 assert.equal(normalizeClip(source,'blastpremier'),null);
 assert.ok(normalizeClip(source,'blastpremier',{includeAllCategories:true}));
 const service=createClipService({includeAllCategories:true,fetcher:async()=>jsonResponse([source])});
 assert.equal((await service.getClips('channels=blastpremier')).clips.length,1);
});

test("creator collection detects cursor stalls and does not truncate a source page",async()=>{
 const clips=Array.from({length:120},(_,i)=>({...raw,id:'clip_'+String(i).padStart(20,'0')}));
 const service=createClipService({fetcher:async()=>Response.json({clips,nextCursor:'stalled'})});
 const page=await service.getClips('channels=blastpremier&cursor=stalled');
 assert.equal(page.clips.length,120);assert.equal(page.sources[0].paginationIncomplete,true);
 const missing=createClipService({fetcher:async()=>new Response('not found',{status:404})});
 assert.equal((await missing.getClips('channels=unknown')).sources[0].found,false);
});
