// Run against local preview only: node tests/community.integration.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base='http://127.0.0.1:5173';
const auth=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=auth.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'local preview sign-in cookie');
const headers={cookie,origin:base};
const denied=await fetch(base+'/api/posts/like',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,401);
const invalid=new FormData();invalid.set('title','Invalid fixture');invalid.set('game','VALORANT');invalid.set('video',new File(['this is not a video'], 'bad.mp4',{type:'video/mp4'}));
assert.equal((await fetch(base+'/api/posts',{method:'POST',headers,body:invalid})).status,400);
const form=new FormData();form.set('title','Local integration test clip');form.set('description','Temporary test fixture; removed after verification.');form.set('game','VALORANT');form.set('video',new File([await readFile(new URL('../outputs/test-clip.mp4',import.meta.url))],'test.mp4',{type:'video/mp4'}));
const upload=await fetch(base+'/api/posts',{method:'POST',headers,body:form});const data=await upload.json();assert.equal(upload.status,201,JSON.stringify(data));
const id=data.id;
try{
 const get=async(path)=>(await fetch(base+path,{headers:{cookie}})).json();
 const mine=await get('/api/posts?mine=1');assert.equal(mine.signedIn,true);const post=mine.posts.find(p=>p.id===id);assert.ok(post);
 const like=async(liked)=>(await fetch(base+'/api/posts/like',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,liked})})).json();
 assert.equal((await like(true)).votes,1);assert.equal((await like(true)).votes,1,'likes are idempotent');
 assert.equal((await get('/api/posts?sort=top')).posts.find(p=>p.id===id).votes,1);
 assert.equal((await get('/api/posts?sort=hot')).posts.some(p=>p.id===id),true);
 assert.equal((await like(false)).votes,0);
 const range=await fetch(base+'/api/media/'+post.mediaKey,{headers:{cookie,Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,32);
 const spoof=await fetch(base+'/api/posts/like',{method:'POST',headers:{cookie,origin:'https://unrelated.invalid','Content-Type':'application/json'},body:JSON.stringify({id,liked:true})});assert.ok([400,403].includes(spoof.status));
 console.log('Passed: authentication, invalid video rejection, upload, My clips, hot/top, idempotent like/unlike, media ranges, origin protection.');
}finally{
 const result=await fetch(base+'/api/posts?id='+id,{method:'DELETE',headers});assert.equal(result.status,200);console.log('Temporary local upload deleted.');
}
