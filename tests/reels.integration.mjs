import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const base='http://127.0.0.1:5173';
const auth=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=auth.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const clip={provider:'twitch',url:'https://clips.twitch.tv/LocalIntegrationFixture-123456',title:'Temporary local-only fixture',category:'Grand Theft Auto V',views:999999};const id='twitch:LocalIntegrationFixture-123456';
const request=async(body,authenticated=true)=>{const r=await fetch(base+'/api/reels',{method:'POST',headers:{origin:base,'Content-Type':'application/json',...(authenticated?{cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
try{
 assert.equal((await request({clip,liked:true},false)).status,401);
 let r=await request({clip,publish:true});assert.equal(r.status,200);assert.equal(r.data.clip.views,0);
 r=await request({clip,liked:true});assert.equal(r.data.likes,1);assert.equal((await request({clip,liked:true})).data.likes,1);
 const searched=await(await fetch(base+'/api/search?q='+encodeURIComponent(clip.title),{headers:{cookie}})).json();assert.equal(searched.clips.find(c=>c.id===id)?.likes,1);assert.equal(searched.clips.find(c=>c.id===id)?.liked,true);
 let feed=await(await fetch(base+'/api/reels',{headers:{cookie}})).json();assert.equal(feed.reels.find(x=>x.id===id).liked,true);assert.equal(feed.reels.find(x=>x.id===id).likes,1);
 assert.equal((await request({clip,liked:false})).data.likes,0);
 feed=await(await fetch(base+'/api/reels',{headers:{cookie}})).json();assert.equal(feed.reels.find(x=>x.id===id).liked,false);
 assert.equal((await request({clip:{...clip,url:'https://evil.invalid/clip'},liked:true})).status,400);
 const discover=await(await fetch(base+'/api/clips')).json();assert.ok(discover.clips.some(c=>c.channel==='stableronaldo'));assert.ok(discover.clips.some(c=>c.channel==='ishowspeed'));for(const pattern of [/grand theft/i,/ea sports fc/i,/chatting|irl/i])assert.ok(discover.clips.some(c=>pattern.test(c.category)));
 console.log('Passed: authenticated reel imports, independent likes, idempotency, reload persistence, unlike, URL validation, real multi-platform/game discovery.');
}finally{
 const sql="DELETE FROM likes WHERE post_id='reel:"+id+"'; DELETE FROM reels WHERE id='"+id+"';";
 const r=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',sql],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);console.log('Temporary local reel and likes removed.');
}
