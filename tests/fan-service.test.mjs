import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {createFanService} from '../lib/fan-service.mjs';import {SPOTLIGHT,ERAS,archiveClip} from '../lib/faze-experience.mjs';
function fixture(t){const db=new DatabaseSync(':memory:');for(const name of ['0000_bumpy_domino','0001_soft_energizer','0002_bouncy_professor_monster','0003_watery_vapor','0004_slow_arclight','0005_lonely_wiccan'])db.exec(readFileSync(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));t.after(()=>db.close());const database=()=>({prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}})})})});return {db,fans:createFanService({database,now:()=>1794756000000})};}
test('fan personas and passports persist per owner, and simultaneous saves do not overwrite eras',async t=>{
 const {fans}=fixture(t);assert.deepEqual(await fans.profile(),{audience:'exploring',savedEras:[]});
 await fans.audience('alice','new');await fans.audience('bob','returning');
 await Promise.all([fans.era('alice','origins',true),fans.era('alice','million',true)]);
 await fans.era('alice','origins',true);let p=await fans.profile('alice');assert.equal(p.audience,'new');assert.deepEqual([...p.savedEras].sort(),['million','origins']);
 assert.deepEqual(await fans.profile('bob'),{audience:'returning',savedEras:[]});
 await fans.era('alice','origins',false);assert.deepEqual((await fans.profile('alice')).savedEras,['million']);
 await assert.rejects(fans.era('alice','invented',true));await assert.rejects(fans.audience('alice','anything'));
});
test('the pulse reports stored activity and keeps visits separate from purchases and private lead data',async t=>{
 const {fans}=fixture(t);let pulse=await fans.pulse();for(const count of Object.values(pulse))assert.equal(count,0);
 await fans.event('alice','story_open','origins');await fans.event('alice','store_open','official-store');await fans.event('alice','full_video_open','youtube:abcdefghijk');
 await fans.partnership('alice',{company:'Test Brand',email:'private@example.test',message:'We would like to explore a community pilot.'});
 pulse=await fans.pulse();assert.equal(pulse.storyOpens,2);assert.equal(pulse.storeOpens,1);assert.equal(pulse.pilotRequests,1);
 assert.equal('revenue' in pulse,false);assert.ok(!JSON.stringify(pulse).includes('private'));
 await assert.rejects(fans.event('alice','store_open','https://evil.test'));await assert.rejects(fans.event('alice','full_video_open','invalid'));
});
test('partner requests validate input and apply an atomic daily cap',async t=>{
 const {fans,db}=fixture(t);await assert.rejects(fans.partnership('alice',{company:'x',email:'bad',message:''}));
 const request={company:'Test Brand',email:'brand@example.test',message:'A community spotlight pilot.'};
 const results=await Promise.allSettled(Array.from({length:4},()=>fans.partnership('alice',request)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,3);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM partner_requests').get().n,3);
});
test('spotlight includes only opted-in uploads and ranks first-party hearts',async t=>{
 const {fans,db}=fixture(t),insert=db.prepare('INSERT INTO posts(id,owner,author,title,description,game,media_key,challenge_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
 for(const [id,challenge] of [['a',SPOTLIGHT.id],['b',SPOTLIGHT.id],['regular',null]])insert.run(id,'owner','Creator',id,'caption','GTA V',id+'.mp4',challenge,1000);
 for(const [post,user]of [['a','one'],['b','one'],['b','two'],['regular','one'],['regular','two'],['regular','three']])db.prepare('INSERT INTO likes(post_id,user_id) VALUES(?,?)').run(post,user);
 const rows=await fans.spotlight('two');assert.deepEqual(rows.map(r=>r.id),['upload:b','upload:a']);assert.equal(rows[0].likes,2);assert.equal(rows[0].liked,true);assert.equal((await fans.pulse()).spotlightEntries,2);
});
test('archive chapters use verified source identities without fabricated source statistics',()=>{
 assert.equal(new Set(ERAS.map(e=>e.id)).size,ERAS.length);
 for(const era of ERAS){const clip=archiveClip(era);assert.match(era.videoId,/^[\w-]{11}$/);assert.equal(clip.views,0);assert.equal(clip.createdAt,'');assert.match(clip.url,/^https:\/\/www.youtube.com\/watch\?v=/);}
});
