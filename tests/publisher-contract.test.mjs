import test from 'node:test';
import assert from 'node:assert/strict';
import {publishForm,publicationResult,extractMetrics,connectedAccounts,linkingUrl} from '../lib/publisher-contract.mjs';
import {uploadPostRequest,PublishingError} from '../lib/upload-post-client.mjs';

test('binary publishing targets only explicit networks and sends documented short-form fields', async()=>{
  const video=new Blob(['video'],{type:'video/mp4'});
  const form=publishForm({id:'abc',title:'Owned upload'},['youtube','tiktok'],video,'caption','https://site.example','fz_owner','stable-job');
  assert.deepEqual(form.getAll('platform[]'),['youtube','tiktok']);
  assert.equal(form.get('user'),'fz_owner');
  assert.equal(await form.get('video').text(),'video');
  assert.equal(form.get('request_id'),'stable-job');
  assert.equal(form.get('async_upload'),'true');
  assert.equal(form.get('privacyStatus'),'public');
  assert.equal(form.get('privacy_level'),'PUBLIC_TO_EVERYONE');
  assert.equal(form.get('media_type'),'REELS');
  assert.equal(form.get('facebook_media_type'),'REELS');
  assert.ok(form.get('youtube_description').includes('https://site.example/#clip=abc'));
});

test('accepted jobs and successful jobs without a public URL stay submitted',()=>{
  assert.equal(publicationResult({success:true,request_id:'job'},'tiktok').status,'submitted');
  assert.equal(publicationResult({status:'completed',results:[{platform:'tiktok',success:true,post_url:null,platform_post_id:'temp'}]},'tiktok').status,'submitted');
  assert.equal(publicationResult({results:[{platform:'tiktok',success:true,message:'Queued'}]},'tiktok').status,'submitted');
});

test('public URLs confirm individual platforms for both result shapes',()=>{
  assert.equal(publicationResult({results:{instagram:{success:true,url:'https://www.instagram.com/reel/abc/'}}},'instagram').status,'published');
  assert.equal(publicationResult({results:[{platform:'youtube',status:'completed',url:'https://youtu.be/abc'}]},'youtube').status,'published');
  assert.equal(publicationResult({results:[{platform:'tiktok',status:'failed'}]},'tiktok').status,'failed');
  assert.equal(publicationResult({status:'failed',results:[]},'instagram').status,'failed');
});

test('TikTok inbox fallback is a draft and skipped platforms are failures',()=>{
  const result=publicationResult({results:{tiktok:{success:true,fallback_to_inbox:true,post_url:'https://tiktok.com/@creator/video/123'}}},'tiktok');
  assert.equal(result.status,'draft');assert.equal(result.url,null);
  assert.equal(publicationResult({status:'completed',results:{instagram:{success:false,skipped:true}}},'instagram').status,'failed');
  assert.match(publicationResult({results:{tiktok:{status:'retryable'}}},'tiktok').message,/retrying/);
});

test('provider post links must belong to the matching social network',()=>{
  for(const url of ['javascript:alert(1)','http://instagram.com/reel/abc','https://instagram.com.evil.example/','https://evil.example/','https://user@instagram.com/reel/abc']){
    assert.equal(publicationResult({results:{instagram:{success:true,url}}},'instagram').url,null);
  }
  assert.equal(publicationResult({results:{instagram:{success:true,url:'https://youtube.com/watch?v=x'}}},'instagram').status,'submitted');
});

test('metrics use verified post totals, preserve missing counts, and never use profile snapshots',()=>{
  const response={platforms:{youtube:{success:true,post_metrics_source:'platform_api',post_metrics:{likes:120,views:5200},profile_snapshot_latest:{likes:999999}},tiktok:{success:true,profile_snapshot_latest:{likes:780}}}};
  assert.deepEqual(extractMetrics(response,'youtube'),{likes:120,views:5200});
  assert.deepEqual(extractMetrics(response,'tiktok'),{likes:null,views:null});
  const metrics=post_metrics=>extractMetrics({platforms:{instagram:{success:true,post_metrics_source:'platform_api',post_metrics}}},'instagram');
  assert.deepEqual(metrics({likes:'0',views:'100'}),{likes:0,views:100});
  assert.deepEqual(metrics({likes:-1,views:'Infinity'}),{likes:null,views:null});
  assert.deepEqual(metrics({likes:null,views:''}),{likes:null,views:null});
  assert.deepEqual(metrics({views:15}),{likes:null,views:15});
  assert.deepEqual(extractMetrics({platforms:{youtube:{success:true,post_metrics:{likes:10}}}},'youtube'),{likes:null,views:null});
  assert.deepEqual(extractMetrics({platforms:{youtube:{success:true,post_metrics_source:'platform_api',post_metrics_error:'unavailable',post_metrics:{likes:10}}}},'youtube'),{likes:null,views:null});
});

test('account list excludes placeholders and expired connections without exposing tokens',()=>{
  const accounts=connectedAccounts({social_accounts:{instagram:{username:'123',handle:'creator',access_token:'do-not-return'},tiktok:{username:'x',reauth_required:true},youtube:'',facebook:null,unknown:{username:'x'}}});
  assert.deepEqual(accounts,[{platform:'instagram',name:'creator'}]);
});

test('link sessions only return the official provider connection page',()=>{
  assert.equal(linkingUrl('https://app.upload-post.com/connect?token=one-time'),'https://app.upload-post.com/connect?token=one-time');
  for(const url of ['https://app.upload-post.com.evil.example/connect?token=x','https://evil.example/connect?token=x','https://app.upload-post.com/other?token=x','https://app.upload-post.com/connect','https://user@app.upload-post.com/connect?token=x'])assert.throws(()=>linkingUrl(url));
});

test('provider client uses server API key, multipart boundary and idempotency headers',async()=>{
  const body=new FormData();body.set('video',new Blob(['video']),'clip.mp4');
  let observed;
  const result=await uploadPostRequest('test-key','/api/upload',body,{idempotencyKey:'job-1',fetcher:async(url,options)=>{observed={url,...options};return Response.json({success:true,request_id:'job-1'});}});
  assert.equal(result.request_id,'job-1');assert.equal(observed.url,'https://api.upload-post.com/api/upload');
  assert.equal(observed.headers.Authorization,'Apikey test-key');assert.equal(observed.headers['Idempotency-Key'],'job-1');
  assert.equal(observed.headers['Content-Type'],undefined);assert.equal(observed.body,body);assert.equal(observed.redirect,'manual');
});

test('provider client handles JSON profile requests and redacts remote errors',async()=>{
  await uploadPostRequest('test-key','/api/uploadposts/users',{username:'fz_owner'},{fetcher:async(url,options)=>{
    assert.equal(options.method,'POST');assert.equal(options.headers['Content-Type'],'application/json');
    assert.deepEqual(JSON.parse(options.body),{username:'fz_owner'});return Response.json({success:true});}});
  for(const status of [403,409,500,302]){
    await assert.rejects(uploadPostRequest('test-key','/api/uploadposts/users',undefined,{fetcher:async()=>new Response('sensitive-provider-body',{status})}),e=>e instanceof PublishingError&&e.status===status&&!e.message.includes('sensitive'));
  }
  await assert.rejects(uploadPostRequest(undefined,'/api/upload'),/not configured/);
  await assert.rejects(uploadPostRequest('test-key','https://evil.example/'),/Invalid/);
});
