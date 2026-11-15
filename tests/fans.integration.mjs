import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFile} from 'node:fs/promises';import {ERAS,SPOTLIGHT} from '../lib/faze-experience.mjs';
const base='http://127.0.0.1:5173',started=Date.now(),auth=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=auth.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const headers={cookie,origin:base,'Content-Type':'application/json'},eventIds=[];let requestId,postId,baseline;
async function get(){const r=await fetch(base+'/api/fans',{headers:{cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');return r.json();}
async function act(b,custom=headers){const r=await fetch(base+'/api/fans',{method:'POST',headers:custom,body:JSON.stringify(b)}),text=await r.text();let d;try{d=JSON.parse(text);}catch{d={error:text};}return {r,d};}
try{
 baseline=await get();assert.equal(baseline.signedIn,true);
 assert.equal((await act({action:'audience',audience:'new'},{origin:base,'Content-Type':'application/json'})).r.status,401);
 assert.ok([400,403].includes((await act({action:'audience',audience:'new'},{...headers,origin:'https://elsewhere.invalid'})).r.status));
 assert.equal((await act({action:'audience',audience:'invalid'})).r.status,400);
 assert.equal((await act({action:'audience',audience:'new'})).r.status,200);
 assert.equal((await act({action:'era',id:'origins',saved:true})).r.status,200);assert.ok((await get()).profile.savedEras.includes('origins'));
 for(const [kind,item]of [['story_open','origins'],['store_open','official-store']]){const {r,d}=await act({action:'event',kind,item});assert.equal(r.status,200);assert.ok(d.id);eventIds.push(d.id);}
 const lead=await act({action:'partner',company:'LOCAL TEST '+crypto.randomUUID(),email:'fixture@example.test',message:'Temporary local API validation of a spotlight pilot.'});assert.equal(lead.r.status,200);requestId=lead.d.id;assert.ok(requestId);
 const form=new FormData();form.set('title','Local FaZe spotlight fixture');form.set('game','Call of Duty');form.set('challengeId',SPOTLIGHT.id);form.set('sourceVideoUrl','https://www.youtube.com/watch?v=BvpbYhQWEDA');form.set('video',new File([await readFile(new URL('../outputs/test-clip.mp4',import.meta.url))],'fixture.mp4',{type:'video/mp4'}));
 const uploaded=await fetch(base+'/api/posts',{method:'POST',headers:{cookie,origin:base},body:form}),body=await uploaded.json();assert.equal(uploaded.status,201,JSON.stringify(body));postId=body.id;
 let state=await get();let clip=state.spotlight.find(c=>c.id==='upload:'+postId);assert.ok(clip);assert.equal(clip.sourceVideoUrl,'https://www.youtube.com/watch?v=BvpbYhQWEDA');
 const liked=await fetch(base+'/api/reels',{method:'POST',headers,body:JSON.stringify({clip,liked:true})});assert.equal(liked.status,200);
 state=await get();assert.equal(state.spotlight.find(c=>c.id==='upload:'+postId).likes,1);assert.ok(state.pulse.spotlightEntries>=1);assert.ok(state.pulse.storyOpens>=baseline.pulse.storyOpens+1);assert.ok(state.pulse.storeOpens>=baseline.pulse.storeOpens+1);assert.ok(!JSON.stringify(state.pulse).includes('fixture@example'));
 console.log('Passed: authenticated fan personas, saved eras, measured source/store opens, private pilot request, spotlight upload, full-video metadata, shared hearts and pulse aggregation.');
}finally{
 if(postId)await fetch(base+'/api/posts?id='+postId,{method:'DELETE',headers:{cookie,origin:base}});
 if(baseline){for(const era of ERAS)await act({action:'era',id:era.id,saved:baseline.profile.savedEras.includes(era.id)});await act({action:'audience',audience:baseline.profile.audience});}
 const sql=[];
 if(requestId){sql.push("DELETE FROM fan_profiles WHERE created_at>="+started+" AND owner IN (SELECT owner FROM partner_requests WHERE id='"+requestId+"')");sql.push("DELETE FROM partner_requests WHERE id='"+requestId+"'");}
 if(eventIds.length)sql.push("DELETE FROM fan_events WHERE id IN ("+eventIds.map(id=>"'"+id+"'").join(',')+")");
 if(sql.length){const r=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',sql.join(';')+';'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
 console.log('Temporary spotlight, events and pilot request removed; previous passport restored.');
}
