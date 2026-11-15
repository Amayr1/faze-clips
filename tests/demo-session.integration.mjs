// Local only. Fixtures use a unique clip and are removed without resetting a profile.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createDemoCredential} from '../scripts/demo-access.mjs';
const base='http://127.0.0.1:5173',root=fileURLToPath(new URL('../',import.meta.url));
const link=await createDemoCredential(root);
assert.equal((await fetch(link,{redirect:'manual',headers:{purpose:'prefetch'}})).status,204);
assert.equal((await fetch(link,{redirect:'manual',headers:{origin:'https://unrelated.invalid'}})).status,403);
const login=await fetch(link,{redirect:'manual'});
assert.equal(login.status,302);
assert.match(login.headers.get('set-cookie'),/Max-Age=2592000/);
assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
assert.equal(login.headers.get('referrer-policy'),'no-referrer');
assert.equal((await fetch(link,{redirect:'manual'})).status,410,'credential cannot be reused');
let cookie=login.headers.get('set-cookie').split(';')[0],commentId;
const clip={provider:'twitch',url:'https://clips.twitch.tv/DemoSession-'+randomBytes(8).toString('hex'),title:'Temporary demo session test',category:'Grand Theft Auto V',channel:'demo-fixture'};
const id='twitch:'+new URL(clip.url).pathname.slice(1);
const send=async(path,body,method='POST')=>{
 const r=await fetch(base+path,{method,headers:{cookie,origin:base,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;
};
const get=async path=>(await fetch(base+path,{headers:{cookie}})).json();
try{
 await send('/api/reels',{clip,liked:true});
 await send('/api/recommendations',{clip,seconds:40,completed:true});
 const comment=await send('/api/comments',{clip,body:'Temporary demo persistence check'});commentId=comment.comment.id;
 const logout=await fetch(base+'/signout-with-chatgpt',{redirect:'manual',headers:{cookie}});
 assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 const relogin=await fetch(base+'/signin-with-chatgpt',{redirect:'manual'});
 cookie=relogin.headers.get('set-cookie').split(';')[0];
 const history=await get('/api/recommendations');
 assert.equal(history.signedIn,true);
 const signal=history.signals.find(s=>s.id===id);
 assert.equal(signal.seconds,40);assert.equal(signal.completions,1);assert.equal(signal.liked,1);
 assert.equal((await get('/api/reels')).reels.find(c=>c.id===id).liked,true);
 const thread=await get('/api/comments?'+new URLSearchParams({clipId:id}));
 assert.equal(thread.comments.find(c=>c.id===commentId).mine,true);
 console.log('Passed: single-use login, prefetch/origin protection, persistent cookie, watch history, likes and comments across sign-out/sign-in.');
}finally{
 if(commentId)await send('/api/comments?id='+commentId,null,'DELETE');
 await send('/api/reels',{clip,liked:false});
 const sql="DELETE FROM watches WHERE reel_id='"+id+"'; DELETE FROM reels WHERE id='"+id+"';";
 const cleaned=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',sql],{cwd:root,encoding:'utf8'});
 assert.equal(cleaned.status,0,cleaned.stderr);
 console.log('Only temporary demo-session fixtures removed.');
}
