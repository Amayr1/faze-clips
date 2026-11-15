import {NETWORKS,publishForm,publicationResult,extractMetrics,connectedAccounts,linkingUrl} from './publisher-contract.mjs';
import {PublishingError} from './upload-post-client.mjs';
export const PROVIDER='upload-post';
export function createPublisherService({database,bucket,request:api,configured}){
const publishingConfigured=configured;
async function profile(userId,create=false){
  const row=await database().prepare('SELECT profile_id FROM publisher_profiles WHERE provider=? AND user_id=?').bind(PROVIDER,userId).first();
  if(!create)return row?.profile_id||null;
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('faze-clips-v1:'+userId));
  const username=row?.profile_id||'fz_'+Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,32);
  // Reserve our mapping before the network call, so an interrupted create can be recovered.
  await database().prepare('INSERT OR IGNORE INTO publisher_profiles(provider,user_id,profile_id) VALUES(?,?,?)').bind(PROVIDER,userId,username).run();
  try{await api('/api/uploadposts/users',{username,display_name:'FaZe creator'});}catch(e){
    if(!(e instanceof PublishingError)||e.status!==409)throw e;
    const existing=await api('/api/uploadposts/users/'+encodeURIComponent(username));
    if(existing.profile?.username!==username)throw Error('Could not verify your publishing profile.');
  }
  return username;
}

async function linkedAccounts(userId){
  if(!publishingConfigured())return [];
  const p=await profile(userId);if(!p)return [];
  try{const d=await api('/api/uploadposts/users/'+encodeURIComponent(p));return connectedAccounts(d.profile);}
  catch(e){if(e instanceof PublishingError&&e.status===404)return [];throw e;}
}

async function linkSession(userId,origin){
  const username=await profile(userId,true);
  const d=await api('/api/uploadposts/users/generate-jwt',{username,platforms:[...NETWORKS],redirect_url:origin+'/#creator-studio',redirect_button_text:'Return to FaZe Clips',connect_title:'Connect your creator accounts',connect_theme:'dark',show_calendar:false});
  return linkingUrl(d.access_url);
}

async function dispatchPost(userId,postId,targets,caption,origin){
  const p=await profile(userId);if(!p)throw Error('Connect your social accounts first.');
  const post=await database().prepare('SELECT * FROM posts WHERE id=? AND owner=?').bind(postId,userId).first();
  if(!post)throw Error('Clip not found.');
  if(!post.media_key.endsWith('.mp4'))throw Error('Cross-posting currently requires an MP4. Download and convert other formats first.');
  const linked=await linkedAccounts(userId);
  if(targets.some(t=>!linked.some(a=>a.platform===t)))throw Error('Connect every selected social account first.');
  const pending=[],requestId=crypto.randomUUID();
  for(const t of targets){
    const r=await database().prepare("INSERT OR IGNORE INTO publications(id,post_id,owner,platform,status,remote_id,provider,created_at) VALUES(?,?,?,?,'sending',?,?,?)").bind(postId+':'+t,postId,userId,t,requestId,PROVIDER,Date.now()).run();
    if(r.meta.changes)pending.push(t);
  }
  if(!pending.length)return {status:'already-recorded'};
  let submitted=false;
  try{
    const object=await bucket().get(post.media_key);if(!object)throw Error('Uploaded video is unavailable.');
    const form=publishForm(post,pending,new Blob([await object.arrayBuffer()],{type:'video/mp4'}),caption,origin,p,requestId);
    submitted=true;
    const d=await api('/api/upload',form,requestId);
    // Persist the returned job ID; our client-provided ID already survives lost responses.
    const remoteId=typeof d.request_id==='string'&&d.request_id?d.request_id:requestId;
    for(const t of pending){const state=publicationResult(d,t);await database().prepare('UPDATE publications SET status=?,remote_id=?,url=?,message=? WHERE id=? AND owner=?').bind(state.status,remoteId,state.url,state.message,postId+':'+t,userId).run();}
    return {status:'submitted'};
  }catch(e){
    const uncertain=submitted&&(!(e instanceof PublishingError)||e.status>=500);
    for(const t of pending)await database().prepare('UPDATE publications SET status=?,message=? WHERE id=? AND owner=?').bind(uncertain?'needs-review':'failed',uncertain?'Submission outcome is uncertain. Sync status and check your social account before posting again.':'No social post was confirmed. Check your publishing plan, connection and media requirements.',postId+':'+t,userId).run();
    throw e;
  }
}

async function syncPublications(userId){
  if(!await profile(userId))throw Error('Connect social accounts first.');
  const rows=await database().prepare('SELECT * FROM publications WHERE owner=? AND provider=? AND remote_id IS NOT NULL AND (last_checked_at IS NULL OR last_checked_at<?) ORDER BY COALESCE(last_checked_at,0),created_at LIMIT 8').bind(userId,PROVIDER,Date.now()-300000).all();
  const jobs=new Map();let checked=0,unavailable=0;
  for(const row of rows.results){
    await database().prepare('UPDATE publications SET last_checked_at=? WHERE id=? AND owner=?').bind(Date.now(),row.id,userId).run();
    try{
      if(!jobs.has(row.remote_id))jobs.set(row.remote_id,api('/api/uploadposts/status?request_id='+encodeURIComponent(row.remote_id)));
      const history=await jobs.get(row.remote_id),state=publicationResult(history,row.platform);
      await database().prepare('UPDATE publications SET status=?,url=COALESCE(?,url),message=? WHERE id=? AND owner=?').bind(state.status,state.url,state.message,row.id,userId).run();
      checked++;
      if(state.status!=='published')continue;
      const d=await api('/api/uploadposts/post-analytics/'+encodeURIComponent(row.remote_id)+'?platform='+encodeURIComponent(row.platform));
      const m=extractMetrics(d,row.platform);
      if(m.likes===null&&m.views===null){unavailable++;continue;}
      await database().prepare('UPDATE publications SET external_likes=COALESCE(?,external_likes),external_views=COALESCE(?,external_views),synced_at=? WHERE id=? AND owner=?').bind(m.likes,m.views,Date.now(),row.id,userId).run();
    }catch{unavailable++;}
  }
  return {ok:true,checked,unavailable};
}

return {linkedAccounts,linkSession,dispatchPost,syncPublications};
}