import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {createCommentService,validateClipId,validateComment,readCommentJson} from '../lib/comments-service.mjs';
const clip={id:'twitch:TestCommentClip-123456',provider:'twitch',url:'https://clips.twitch.tv/TestCommentClip-123456',title:'Comment fixture',channel:'creator'};
function fixture(t){
 const db=new DatabaseSync(':memory:');for(const name of ['0000_bumpy_domino','0001_soft_energizer','0002_bouncy_professor_monster','0003_watery_vapor','0004_slow_arclight'])db.exec(readFileSync(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));t.after(()=>db.close());
 const database=()=>({prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}})})})});
 return {db,service:createCommentService({database,now:()=>1794756000000})};
}
test('comments persist per canonical clip with server authors and no private identity leakage',async t=>{
 const {service}=fixture(t),user={userId:'private-user-id',fullName:'Alice',email:'private@example.test'};
 const comment=await service.add(user,clip,'  Great clutch!\nRun it back.  ');
 assert.equal(comment.body,'Great clutch!\nRun it back.');assert.equal(comment.author,'Alice');
 const thread=await service.list(clip.id,user.userId);assert.equal(thread.total,1);assert.equal(thread.comments[0].mine,true);
 const publicThread=await service.list(clip.id);assert.equal(publicThread.comments[0].mine,false);
 assert.ok(!JSON.stringify(publicThread).includes('private-user-id'));assert.ok(!JSON.stringify(publicThread).includes('private@example'));
 assert.equal((await service.list('youtube:abcdefghijk')).total,0);
});
test('comments require authentication, reject forged clip identities and nonexistent uploads',async t=>{
 const {service}=fixture(t);
 await assert.rejects(service.add(null,clip,'hello'),e=>e.status===401);
 await assert.rejects(service.add({userId:'a'},{...clip,id:'twitch:OtherClip-12345'},'hello'),/identity/);
 await assert.rejects(service.add({userId:'a'},{provider:'upload',id:'upload:'+crypto.randomUUID()},'hello'),e=>e.status===404);
 assert.throws(()=>validateClipId("bad' OR 1=1"));assert.throws(()=>validateComment('   '));assert.throws(()=>validateComment('x'.repeat(1001)));
});
test('any signed-in viewer can comment on an upload; only the author can delete their comment',async t=>{
 const {service,db}=fixture(t),id=crypto.randomUUID();
 db.prepare('INSERT INTO posts(id,owner,author,title,description,game,media_key,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,'uploader','Uploader','Clip','description','GTA V','file.mp4',1);
 const c=await service.add({userId:'viewer',fullName:null},{provider:'upload',id:'upload:'+id},'Nice!');
 assert.equal(c.author,'Player');assert.equal(await service.remove('uploader',c.id),false);
 assert.equal((await service.list('upload:'+id)).total,1);assert.equal(await service.remove('viewer',c.id),true);
 assert.equal((await service.list('upload:'+id)).total,0);
});
test('comment pagination is stable across equal timestamps and separates threads',async t=>{
 const {service,db}=fixture(t);const statement=db.prepare('INSERT INTO comments(id,clip_id,owner,author,body,created_at) VALUES(?,?,?,?,?,?)');
 for(let i=0;i<24;i++)statement.run(crypto.randomUUID(),clip.id,'owner','Player','Comment '+i,1000);
 const first=await service.list(clip.id);assert.equal(first.comments.length,20);assert.ok(first.nextCursor);
 const second=await service.list(clip.id,'',first.nextCursor);assert.equal(second.comments.length,4);assert.equal(second.nextCursor,null);
 assert.equal(new Set([...first.comments,...second.comments].map(c=>c.id)).size,24);assert.equal(second.total,24);
 await assert.rejects(service.list(clip.id,'','invalid-cursor'),e=>e.status===400);
});
test('rate limits remain atomic across simultaneous comment submissions',async t=>{
 const {service,db}=fixture(t);
 const results=await Promise.allSettled(Array.from({length:9},()=>service.add({userId:'viewer'},clip,'hello')));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,8);
 assert.equal(results.find(r=>r.status==='rejected').reason.status,429);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n,8);
});
test('comment JSON reader bounds request bodies and supports plain text safely',async()=>{
 const body={clip,body:'<script>alert("test")</script>'};
 assert.deepEqual(await readCommentJson(new Request('https://test.local',{method:'POST',body:JSON.stringify(body)})),body);
 await assert.rejects(readCommentJson(new Request('https://test.local',{method:'POST',body:'x'.repeat(17000)})),e=>e.status===413);
 await assert.rejects(readCommentJson(new Request('https://test.local',{method:'POST',body:'bad json'})),e=>e.status===400);
});
