import test from 'node:test';import assert from 'node:assert/strict';import {twitchClips} from '../lib/twitch.ts';
test('Twitch requires configured credentials and maps the authenticated official API',async()=>{
 assert.deepEqual(await twitchClips({}),{clips:[],connected:false});
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,init});const data=url.includes('/oauth2/token')?{access_token:'test-only-token',expires_in:3600}:url.includes('/users?')?{data:[{id:'1'}]}:url.includes('/games?')?{data:[{id:'2',name:'Grand Theft Auto V'}]}:{data:[{id:'ValidClip-123',broadcaster_name:'Example',title:'A real API shape',game_id:'2',duration:20,view_count:40,created_at:'2026-11-15T00:00:00Z',thumbnail_url:'https://clips-media-assets2.twitch.tv/preview.jpg'}]};return Response.json(data);};
 try{const r=await twitchClips({TWITCH_CLIENT_ID:'test-client',TWITCH_CLIENT_SECRET:'test-secret'});assert.equal(r.connected,true);assert.equal(r.clips[0].provider,'twitch');assert.equal(r.clips[0].category,'Grand Theft Auto V');assert.equal(r.clips[0].views,40);assert.equal(calls.find(x=>x.url.includes('/clips?')).init.headers.Authorization,'Bearer test-only-token');assert.equal(r.clips[0].url,'https://clips.twitch.tv/ValidClip-123');}finally{globalThis.fetch=original;}
});

test('Twitch creator search requests top 100, follows cursor and keeps the canonical login',async()=>{
 const {twitchCreatorClips}=await import('../lib/twitch.ts');
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(input,init)=>{
  const url=String(input);calls.push(url);
  const data=url.includes('/oauth2/token')?{access_token:'paging-token',expires_in:3600}:url.includes('/users?')?{data:[{id:'7',login:'new_creator',display_name:'New Creator'}]}:url.includes('/games?')?{data:[]}:{data:[{id:url.includes('after=')?'SecondClip-123':'FirstClip-123',broadcaster_name:'New Creator',view_count:500,duration:20,created_at:'2026-11-15T00:00:00Z'}],pagination:url.includes('after=')?{}:{cursor:'cursor+/='}};
  return Response.json(data);
 };
 try{
  const config={TWITCH_CLIENT_ID:'paging-client',TWITCH_CLIENT_SECRET:'paging-secret'};
  const first=await twitchCreatorClips(config,'new_creator',{time:'week'});
  assert.equal(first.nextCursor,'cursor+/=');assert.equal(first.clips[0].channel,'new_creator');
  const second=await twitchCreatorClips(config,'new_creator',{time:'week',after:first.nextCursor});
  assert.equal(second.nextCursor,null);assert.notEqual(first.clips[0].id,second.clips[0].id);
  const requests=calls.filter(c=>c.includes('/clips?')).map(c=>new URL(c));
  assert.equal(requests[0].searchParams.get('first'),'100');assert.ok(requests[0].searchParams.has('started_at'));
  assert.equal(requests[1].searchParams.get('after'),'cursor+/=');
 }finally{globalThis.fetch=original;}
});

test('Twitch VOD context is linked only when the source supplies a real video ID',async()=>{
 const {twitchVodUrl}=await import('../lib/twitch.ts');
 assert.equal(twitchVodUrl({video_id:'12345',vod_offset:3723}),'https://www.twitch.tv/videos/12345?t=1h2m3s');
 assert.equal(twitchVodUrl({video_id:'',vod_offset:null}),'');
 assert.equal(twitchVodUrl({video_id:'javascript:bad'}),'');
});
