import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const base='http://127.0.0.1:5173';
const auth=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=auth.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const headers={cookie,origin:base,'Content-Type':'application/json'};
const clip={id:'twitch:CommentsIntegrationFixture-12345',provider:'twitch',url:'https://clips.twitch.tv/CommentsIntegrationFixture-12345',channel:'stableronaldo',title:'Local comment integration'};
const ids=[];let uploadId;
async function post(body,custom=headers){const r=await fetch(base+'/api/comments',{method:'POST',headers:custom,body:JSON.stringify(body)});const text=await r.text();let d;try{d=JSON.parse(text);}catch{d={error:text};}if(r.status===201)ids.push(d.comment.id);return {r,d};}
async function list(id,signed=true){const r=await fetch(base+'/api/comments?'+new URLSearchParams({clipId:id}),{headers:signed?{cookie}:{}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');return r.json();}
try{
 assert.equal((await post({clip,body:'no auth'},{origin:base,'Content-Type':'application/json'})).r.status,401);
 assert.ok([400,403].includes((await post({clip,body:'wrong origin'},{...headers,origin:'https://elsewhere.invalid'})).r.status));
 assert.equal((await post({clip,body:' '.repeat(20)})).r.status,400);
 assert.equal((await post({clip,body:'x'.repeat(1001)})).r.status,400);
 const text='Great play!\n<script>This stays plain text</script>';
 const {r,d}=await post({clip,body:text,author:'Forged author',owner:'forged-owner'});assert.equal(r.status,201,JSON.stringify(d));assert.notEqual(d.comment.author,'Forged author');assert.equal(d.comment.body,text);
 let thread=await list(clip.id);assert.equal(thread.total,1);assert.equal(thread.comments[0].mine,true);
 const publicThread=await list(clip.id,false);assert.equal(publicThread.comments[0].mine,false);assert.equal('owner' in publicThread.comments[0],false);
 assert.equal((await fetch(base+'/api/comments?id='+d.comment.id,{method:'DELETE',headers:{origin:base}})).status,401);
 const form=new FormData();form.set('title','Comments integration upload');form.set('game','GTA V');form.set('streamUrl','https://twitch.tv/creator_fixture');form.set('video',new File([await readFile(new URL('../outputs/test-clip.mp4',import.meta.url))],'fixture.mp4',{type:'video/mp4'}));
 const uploaded=await fetch(base+'/api/posts',{method:'POST',headers:{cookie,origin:base},body:form}),p=await uploaded.json();assert.equal(uploaded.status,201,JSON.stringify(p));uploadId=p.id;
 const owned=await(await fetch(base+'/api/posts?mine=1',{headers:{cookie}})).json();assert.equal(owned.posts.find(x=>x.id===uploadId).streamUrl,'https://www.twitch.tv/creator_fixture');
 const feed=await(await fetch(base+'/api/reels',{headers:{cookie}})).json();assert.equal(feed.reels.find(x=>x.id==='upload:'+uploadId).streamUrl,'https://www.twitch.tv/creator_fixture');
 assert.equal((await post({clip:{provider:'upload',id:'upload:'+uploadId},body:'Comment on uploaded clip'})).r.status,201);
 assert.equal((await list('upload:'+uploadId)).total,1);
 assert.equal((await fetch(base+'/api/posts?id='+uploadId,{method:'DELETE',headers:{cookie,origin:base}})).status,200);
 assert.equal((await list('upload:'+uploadId)).total,0,'clip deletion removes its comments');
 uploadId=null;
 assert.equal((await fetch(base+'/api/comments?id='+d.comment.id,{method:'DELETE',headers:{cookie,origin:base}})).status,200);
 assert.equal((await list(clip.id)).total,0);
 console.log('Passed: authenticated comments, persistent threads, plain text, server attribution, anonymous reads, origin protection, deletion, stream-link storage, shared upload metadata and comment cleanup.');
}finally{
 for(const id of ids)await fetch(base+'/api/comments?id='+id,{method:'DELETE',headers:{cookie,origin:base}});
 if(uploadId)await fetch(base+'/api/posts?id='+uploadId,{method:'DELETE',headers:{cookie,origin:base}});
 console.log('Temporary comments and upload removed.');
}
