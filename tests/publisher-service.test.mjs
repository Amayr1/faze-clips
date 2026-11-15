import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createPublisherService} from '../lib/publisher-service.mjs';
import {PublishingError} from '../lib/upload-post-client.mjs';

function fixture(t){
  const db=new DatabaseSync(':memory:');
  for(const file of ['0000_bumpy_domino','0001_soft_energizer','0002_bouncy_professor_monster','0003_watery_vapor'])db.exec(readFileSync(new URL('../drizzle/'+file+'.sql',import.meta.url),'utf8'));
  t.after(()=>db.close());
  const database=()=>({prepare:sql=>({bind:(...values)=>({
    first:async()=>db.prepare(sql).get(...values)||null,
    all:async()=>({results:db.prepare(sql).all(...values)}),
    run:async()=>({meta:{changes:db.prepare(sql).run(...values).changes}})
  })})});
  const profiles=new Map(),uploads=[],calls=[];
  let uploadError=null,metrics={likes:8,views:120},status='published';
  const request=async(path,body,key)=>{
    calls.push(path);
    if(path==='/api/uploadposts/users'){
      if(profiles.has(body.username))throw new PublishingError(409);
      profiles.set(body.username,{username:body.username,social_accounts:{}});
      return {success:true,profile:profiles.get(body.username)};
    }
    if(path==='/api/uploadposts/users/generate-jwt')return {success:true,access_url:'https://app.upload-post.com/connect?token='+body.username};
    if(path.startsWith('/api/uploadposts/users/')){
      const profile=profiles.get(decodeURIComponent(path.split('/').at(-1)));
      if(!profile)throw new PublishingError(404);
      return {success:true,profile};
    }
    if(path==='/api/upload'){
      assert.equal(body.get('request_id'),key,'provider request and idempotency identifiers match');
      uploads.push({form:body,key});
      if(uploadError)throw uploadError;
      return {success:true,request_id:key};
    }
    if(path.startsWith('/api/uploadposts/status?')){
      const results=['instagram','tiktok','youtube'].map(platform=>({platform,success:true,...(status==='published'?{url:'https://'+(platform==='youtube'?'youtube.com':platform+'.com')+'/post/123'}:{fallback_to_inbox:true})}));
      return {status:'completed',results};
    }
    if(path.startsWith('/api/uploadposts/post-analytics/')){
      const platform=new URL('https://example.test'+path).searchParams.get('platform');
      return {platforms:{[platform]:{success:true,post_metrics_source:'platform_api',post_metrics:metrics,profile_snapshot_latest:{likes:999999}}}};
    }
    throw Error('Unexpected provider request '+path);
  };
  const service=createPublisherService({database,bucket:()=>({get:async()=>({arrayBuffer:async()=>new TextEncoder().encode('fixture').buffer})}),configured:()=>true,request});
  function post(id,owner,extension='mp4'){
    db.prepare('INSERT INTO posts(id,owner,author,title,description,game,media_key,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,owner,'Creator','My clip','description','GTA V',id+'.'+extension,Date.now());
  }
  async function connect(user){
    await service.linkSession(user,'http://localhost:5173');
    const id=db.prepare('SELECT profile_id FROM publisher_profiles WHERE user_id=?').get(user).profile_id;
    profiles.get(id).social_accounts={instagram:{username:user+'-ig',handle:user},youtube:{username:user+'-yt',handle:user},tiktok:{username:user+'-tt',handle:user}};
    return id;
  }
  return {db,service,post,connect,profiles,uploads,calls,setUploadError:e=>uploadError=e,setMetrics:m=>metrics=m,setStatus:s=>status=s};
}

test('creator profiles are isolated and repeat connection recovers an existing profile',async t=>{
  const f=fixture(t),alice=await f.connect('alice'),bob=await f.connect('bob');
  assert.notEqual(alice,bob);assert.match(alice,/^fz_[a-f0-9]{32}$/);
  await f.service.linkSession('alice','http://localhost:5173');
  assert.equal(f.profiles.size,2);
  assert.deepEqual(await f.service.linkedAccounts('alice'),[{platform:'instagram',name:'alice'},{platform:'tiktok',name:'alice'},{platform:'youtube',name:'alice'}]);
  assert.deepEqual(await f.service.linkedAccounts('unknown'),[]);
});

test('publishing requires an owned MP4 and linked destinations',async t=>{
  const f=fixture(t);await f.connect('alice');await f.connect('bob');f.post('a','alice');f.post('mov','alice','mov');
  await assert.rejects(f.service.dispatchPost('bob','a',['tiktok'],'caption','https://site.test'),/not found/);
  await assert.rejects(f.service.dispatchPost('alice','mov',['tiktok'],'caption','https://site.test'),/MP4/);
  await assert.rejects(f.service.dispatchPost('alice','a',['facebook'],'caption','https://site.test'),/Connect every/);
  assert.equal(f.uploads.length,0);
});

test('duplicate and concurrent requests send one social copy per post and platform',async t=>{
  const f=fixture(t);await f.connect('alice');f.post('a','alice');
  await Promise.all([f.service.dispatchPost('alice','a',['instagram','tiktok'],'caption','https://site.test'),f.service.dispatchPost('alice','a',['instagram','tiktok'],'caption','https://site.test')]);
  await f.service.dispatchPost('alice','a',['instagram','tiktok'],'caption','https://site.test');
  const destinations=f.uploads.flatMap(u=>u.form.getAll('platform[]'));
  assert.equal(destinations.filter(p=>p==='instagram').length,1);assert.equal(destinations.filter(p=>p==='tiktok').length,1);
  for(const row of f.db.prepare('SELECT * FROM publications').all()){
    assert.equal(row.owner,'alice');assert.equal(row.provider,'upload-post');assert.equal(row.status,'submitted');assert.ok(row.remote_id);
  }
});

test('lost upload response retains a recoverable job and never automatically republishes',async t=>{
  const f=fixture(t);await f.connect('alice');f.post('a','alice');f.setUploadError(Error('timeout'));
  await assert.rejects(f.service.dispatchPost('alice','a',['tiktok'],'caption','https://site.test'),/timeout/);
  const uncertain=f.db.prepare('SELECT * FROM publications').get();assert.equal(uncertain.status,'needs-review');assert.ok(uncertain.remote_id);
  f.setUploadError(null);await f.service.dispatchPost('alice','a',['tiktok'],'caption','https://site.test');
  assert.equal(f.uploads.length,1);
  await f.service.syncPublications('alice');
  const recovered=f.db.prepare('SELECT * FROM publications').get();assert.equal(recovered.status,'published');assert.equal(recovered.external_likes,8);
});

test('sync isolates creators and legacy jobs, rate limits reads and preserves missing analytics',async t=>{
  const f=fixture(t);await f.connect('alice');await f.connect('bob');f.post('a','alice');f.post('b','bob');
  await f.service.dispatchPost('alice','a',['instagram'],'caption','https://site.test');
  await f.service.dispatchPost('bob','b',['instagram'],'caption','https://site.test');
  f.db.prepare("INSERT INTO publications(id,post_id,owner,platform,status,remote_id,created_at) VALUES('legacy','legacy','alice','youtube','submitted','old-provider',0)").run();
  const synced=await f.service.syncPublications('alice');assert.equal(synced.checked,1);
  const row=()=>f.db.prepare("SELECT * FROM publications WHERE post_id='a'").get();
  assert.equal(row().external_likes,8);assert.equal(row().external_views,120);
  assert.equal(f.db.prepare("SELECT status FROM publications WHERE post_id='b'").get().status,'submitted');
  assert.equal(f.db.prepare("SELECT last_checked_at FROM publications WHERE id='legacy'").get().last_checked_at,null);
  assert.equal((await f.service.syncPublications('alice')).checked,0);
  f.db.prepare("UPDATE publications SET last_checked_at=0 WHERE post_id='a'").run();f.setMetrics({views:140});
  await f.service.syncPublications('alice');assert.equal(row().external_likes,8);assert.equal(row().external_views,140);
  f.db.prepare("UPDATE publications SET last_checked_at=0 WHERE post_id='a'").run();f.setMetrics({});
  await f.service.syncPublications('alice');assert.equal(row().external_likes,8);assert.equal(row().external_views,140);
  assert.ok(!f.calls.some(p=>p.includes('old-provider')));
});

test('TikTok inbox delivery stays a draft and does not count account-wide engagement',async t=>{
  const f=fixture(t);await f.connect('alice');f.post('a','alice');f.setStatus('draft');
  await f.service.dispatchPost('alice','a',['tiktok'],'caption','https://site.test');
  await f.service.syncPublications('alice');
  const row=f.db.prepare('SELECT * FROM publications').get();assert.equal(row.status,'draft');assert.equal(row.url,null);assert.equal(row.synced_at,null);
});
