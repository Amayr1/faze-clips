import {validateClipId} from './comments-service.mjs';
import {ERAS,SPOTLIGHT} from './faze-experience.mjs';
const eraIds=new Set(ERAS.map(e=>e.id));
export class FanError extends Error{constructor(status,message){super(message);this.status=status;}}
export function createFanService({database,now=Date.now,uuid=()=>crypto.randomUUID()}){
 const profile=async owner=>{
  const row=owner?await database().prepare('SELECT audience,saved_eras FROM fan_profiles WHERE owner=?').bind(owner).first():null;
  let saved=[];try{saved=JSON.parse(row?.saved_eras||'[]');}catch{}
  return {audience:row?.audience||'exploring',savedEras:Array.isArray(saved)?saved.filter(id=>eraIds.has(id)):[]};
 };
 return {
  profile,
  async audience(owner,audience){
   if(!['new','returning','exploring'].includes(audience))throw new FanError(400,'Choose a fan experience.');
   const at=now();await database().prepare('INSERT INTO fan_profiles(owner,audience,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET audience=excluded.audience,updated_at=excluded.updated_at').bind(owner,audience,at,at).run();return profile(owner);
  },
  async era(owner,id,saved){
   if(!eraIds.has(id)||typeof saved!=='boolean')throw new FanError(400,'Choose a valid era for your passport.');
   const at=now();
   if(saved)await database().prepare("INSERT INTO fan_profiles(owner,saved_eras,created_at,updated_at) VALUES(?,json_array(?),?,?) ON CONFLICT(owner) DO UPDATE SET saved_eras=CASE WHEN EXISTS(SELECT 1 FROM json_each(fan_profiles.saved_eras) WHERE value=?) THEN fan_profiles.saved_eras ELSE json_insert(fan_profiles.saved_eras,'$[#]',?) END,updated_at=excluded.updated_at").bind(owner,id,at,at,id,id).run();
   else await database().prepare("UPDATE fan_profiles SET saved_eras=(SELECT json_group_array(value) FROM json_each(fan_profiles.saved_eras) WHERE value<>?),updated_at=? WHERE owner=?").bind(id,at,owner).run();
   return profile(owner);
  },
  async event(owner,kind,item){
   if(kind==='full_video_open')validateClipId(item);
   if(!(kind==='full_video_open'||kind==='story_open'&&eraIds.has(item)||kind==='store_open'&&item==='official-store'))throw new FanError(400,'Choose a valid destination.');
   const at=now(),id=uuid();const r=await database().prepare('INSERT INTO fan_events(id,owner,kind,item,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM fan_events WHERE owner=? AND created_at>?)<30').bind(id,owner,kind,item,at,owner,at-60000).run();
   if(!r.meta.changes)throw new FanError(429,'Activity updates are limited. Try again shortly.');return {ok:true,id};
  },
  async partnership(owner,{company,email,message}){
   if(typeof company!=='string'||company.trim().length<2||company.length>100||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof message!=='string'||message.trim().length<10||message.length>1000)throw new FanError(400,'Add your brand, a valid contact email and a short pilot brief.');
   const at=now(),id=uuid();const r=await database().prepare('INSERT INTO partner_requests(id,owner,company,email,message,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM partner_requests WHERE owner=? AND created_at>?)<3').bind(id,owner,company.trim(),email.trim(),message.trim(),at,owner,at-86400000).run();
   if(!r.meta.changes)throw new FanError(429,'You can save up to three pilot requests per day.');return {ok:true,id};
  },
  async pulse(){return await database().prepare("SELECT (SELECT COUNT(*) FROM likes) AS hearts,(SELECT COUNT(*) FROM comments) AS comments,(SELECT COUNT(*) FROM posts WHERE challenge_id=?) AS spotlightEntries,(SELECT COUNT(*) FROM fan_profiles) AS passports,(SELECT COUNT(*) FROM fan_events WHERE kind IN ('story_open','full_video_open')) AS storyOpens,(SELECT COUNT(*) FROM fan_events WHERE kind='store_open') AS storeOpens,(SELECT COUNT(*) FROM partner_requests) AS pilotRequests,COALESCE((SELECT SUM(seconds) FROM watches),0) AS watchSeconds").bind(SPOTLIGHT.id).first();},
  async spotlight(userId=''){
   const rows=await database().prepare('SELECT p.id,p.author,p.title,p.game,p.media_key,p.stream_url,p.source_url,p.created_at,COUNT(l.user_id) AS likes,MAX(CASE WHEN l.user_id=? THEN 1 ELSE 0 END) AS liked FROM posts p LEFT JOIN likes l ON l.post_id=p.id WHERE p.challenge_id=? GROUP BY p.id ORDER BY likes DESC,p.created_at DESC,p.id LIMIT 6').bind(userId,SPOTLIGHT.id).all();
   return rows.results.map(p=>({id:'upload:'+p.id,provider:'upload',title:p.title,channel:'creator:'+p.author,channelName:p.author,category:p.game,videoUrl:'/api/media/'+p.media_key,thumbnail:'/upload-cover.svg',streamUrl:p.stream_url||'',sourceVideoUrl:p.source_url||'',url:'/#clip='+p.id,duration:0,views:0,likes:p.likes,liked:!!p.liked,createdAt:new Date(p.created_at).toISOString()}));
  }
 };
}
