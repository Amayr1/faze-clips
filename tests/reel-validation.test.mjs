import test from 'node:test';import assert from 'node:assert/strict';
import {parseExternalClip,cleanReel} from '../lib/reel-validation.mjs';
test('clip link parsing canonicalizes source URLs and rejects unrelated hosts or executables',()=>{
 assert.equal(parseExternalClip('https://www.twitch.tv/stableronaldo/clip/ValidClip-123?lang=en').url,'https://clips.twitch.tv/ValidClip-123');
 assert.equal(parseExternalClip('https://www.youtube.com/shorts/H9PbZ9Sqluc?feature=share').id,'youtube:H9PbZ9Sqluc');
 for(const u of ['http://clips.twitch.tv/ValidClip-123','https://clips.twitch.tv.evil.test/ValidClip-123','https://evil.test/watch?v=H9PbZ9Sqluc','https://user@clips.twitch.tv/ValidClip-123','https://www.twitch.tv/stableronaldo','javascript:alert(1)'])assert.throws(()=>parseExternalClip(u));
});
test('shared reel metadata cannot inject a player URL or external like counts',()=>{
 const r=cleanReel({provider:'youtube',url:'https://youtu.be/H9PbZ9Sqluc',title:'A short',views:99999,videoUrl:'https://evil.test/video',thumbnail:'https://evil.test/x'});
 assert.equal(r.id,'youtube:H9PbZ9Sqluc');assert.equal(r.views,0);assert.equal(r.videoUrl,'');assert.equal(r.thumbnail,'https://i.ytimg.com/vi/H9PbZ9Sqluc/hqdefault.jpg');
 assert.throws(()=>cleanReel({provider:'twitch',url:'https://youtu.be/H9PbZ9Sqluc'}));
});
test('all game and variety metadata remains eligible while source IDs must match',async()=>{
 const snapshot=JSON.parse(await(await import('node:fs/promises')).readFile(new URL('../public/data/clips.json',import.meta.url),'utf8'));
 const mp4=snapshot.clips.find(c=>c.channel==='ninja');assert.ok(mp4);assert.equal(cleanReel(mp4).id,mp4.id);
 assert.throws(()=>cleanReel({...mp4,id:'clip_01K3VHCYJPCACGTJEFFJJH41FN'}));
 for(const game of ['Grand Theft Auto V (GTA)','EA Sports FC 27','IRL'])assert.ok(snapshot.clips.some(c=>c.category===game));
});
