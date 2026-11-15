import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeStreamUrl,streamerPage} from '../lib/stream-links.mjs';
import {cleanReel} from '../lib/reel-validation.mjs';
test('stream pages are canonical platform links, never a live-status claim',()=>{
 assert.equal(normalizeStreamUrl('https://kick.com/FaZeRain/'),'https://kick.com/fazerain');
 assert.equal(normalizeStreamUrl('https://twitch.tv/StableRonaldo'),'https://www.twitch.tv/stableronaldo');
 assert.equal(normalizeStreamUrl('https://youtube.com/@IShowSpeed'),'https://www.youtube.com/@IShowSpeed/live');
 assert.equal(normalizeStreamUrl('https://youtube.com/channel/UC'+'a'.repeat(22)),'https://www.youtube.com/channel/UC'+'a'.repeat(22)+'/live');
 assert.equal(normalizeStreamUrl(''), '');
});
test('unsafe, unrelated and cross-platform attribution URLs are rejected',()=>{
 for(const url of ['javascript:alert(1)','http://kick.com/user','https://kick.com.evil.test/user','https://user:pass@kick.com/user','https://kick.com:8443/user','https://kick.com/user?token=secret','https://youtube.com/watch?v=abcdefghijk','https://twitch.tv/user/clip/Clip12345'])assert.throws(()=>normalizeStreamUrl(url),url);
 assert.throws(()=>normalizeStreamUrl('https://kick.com/user','twitch'));
});
test('native creator links are derived, unknown imported creators are not invented',()=>{
 assert.equal(streamerPage({provider:'kick',url:'https://kick.com/fazerain/clips/clip_ABCDEFGHIJKLMNO'}),'https://kick.com/fazerain');
 assert.equal(streamerPage({provider:'twitch',channel:'stableronaldo'}),'https://www.twitch.tv/stableronaldo');
 assert.equal(streamerPage({provider:'twitch',channel:'shared'}),null);
 assert.equal(streamerPage({provider:'youtube',channel:'unverifiedhandle'}),null);
 assert.equal(streamerPage({provider:'upload',streamUrl:'https://twitch.tv/owner'}),'https://www.twitch.tv/owner');
});
test('shared reel attribution is validated and retained with the clip',()=>{
 const reel=cleanReel({provider:'twitch',url:'https://clips.twitch.tv/StreamLinkFixture-12345',streamUrl:'https://twitch.tv/creator'});
 assert.equal(reel.streamUrl,'https://www.twitch.tv/creator');
 assert.throws(()=>cleanReel({...reel,streamUrl:'https://evil.test/creator'}));
});

test('full-video links reject unrelated hosts and keep validated Twitch timestamps',async()=>{
 const {normalizeSourceVideo}=await import('../lib/stream-links.mjs');
 assert.equal(normalizeSourceVideo('https://youtube.com/watch?v=abcdefghijk','youtube'),'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(normalizeSourceVideo('https://twitch.tv/videos/12345?t=1h2m3s','twitch'),'https://www.twitch.tv/videos/12345?t=1h2m3s');
 for(const link of ['https://evil.test/video','javascript:alert(1)','https://twitch.tv.evil.test/videos/123','https://user:pass@twitch.tv/videos/123'])assert.throws(()=>normalizeSourceVideo(link));
 assert.throws(()=>normalizeSourceVideo('https://youtube.com/watch?v=abcdefghijk','twitch'));
});
