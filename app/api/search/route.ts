import {env} from 'cloudflare:workers';
import {database,failure} from '@/lib/community';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {createClipService,InputError} from '@/lib/kick.mjs';
import snapshot from '@/public/data/clips.json';
import creators from '@/public/data/creator-clips.json';
import {webDiscovery} from '@/lib/web-discovery';
import {twitchCreatorClips} from '@/lib/twitch';
import {creatorNames,identity,searchOptions,mergeSearchClips,decodeSearchCursor,encodeSearchCursor} from '@/lib/creator-search.mjs';
const service=createClipService({snapshot,includeAllCategories:true});
const PAGE=100;
export async function GET(request:Request){try{
 const params=new URL(request.url).searchParams;
 let options:any,cursor:any;
 try{options=searchOptions(params);cursor=decodeSearchCursor(params.get('cursor'),options);}catch(e){return Response.json({error:(e as Error).message},{status:400});}
 const {query:q,sort,time}=options,config=env as any,offset=cursor?.offset||0;
 const known:any[]=[...snapshot.clips.map(c=>({...c,provider:'kick'})),...creators.clips];
 const names=creatorNames(q,known),norm=identity(q.replace(/^@/,'').replace(/\s+(?:top\s+|best\s+)?clips?$/i,''));
 if(cursor?.sources.some((s:any)=>!names.includes(s.channel)))return Response.json({error:'Start a new search for this creator.'},{status:400});
 const pattern='%'+q.toLowerCase().replace(/[!%_]/g,(value:string)=>'!'+value)+'%',cutoff=time==='all'?0:Date.now()-(({day:86400000,week:604800000,month:2592000000} as Record<string,number>)[time]||0);
 const order=sort==='top'?'likes DESC':sort==='date'?'created DESC':sort==='hot'?'(likes+1.0)/pow(2+MAX(0,(unixepoch()*1000-created)/3600000.0),1.25) DESC':'views DESC';
 const localOrder=sort==='hot'?'likes DESC':order; // Full Hot score is applied once candidates are merged.
 const stored=await database().prepare("SELECT data,added_at AS addedAt,(SELECT COUNT(*) FROM likes WHERE post_id='reel:'||reels.id) AS likes,COALESCE(json_extract(data,'$.views'),0) AS views,COALESCE(unixepoch(json_extract(data,'$.createdAt'))*1000,0) AS created FROM reels WHERE (lower(data) LIKE ? ESCAPE '!' OR lower(replace(replace(replace(json_extract(data,'$.channel'),' ',''),'_',''),'-',''))=?) AND (?=0 OR unixepoch(json_extract(data,'$.createdAt'))*1000>=?) ORDER BY "+localOrder+",id LIMIT ? OFFSET ?").bind(pattern,norm,cutoff,cutoff,PAGE+1,offset).all<any>();
 const uploads=await database().prepare("SELECT *,(SELECT COUNT(*) FROM likes WHERE post_id=posts.id) AS likes,0 AS views,created_at AS created FROM posts WHERE (lower(title||' '||author||' '||game) LIKE ? ESCAPE '!' OR lower(replace(replace(replace(author,' ',''),'_',''),'-',''))=?) AND created_at>=? ORDER BY "+localOrder+",id LIMIT ? OFFSET ?").bind(pattern,norm,cutoff,PAGE+1,offset).all<any>();
 const local=stored.results.slice(0,PAGE).map((r:any)=>({...JSON.parse(r.data),likes:r.likes,addedAt:r.addedAt}));
 local.push(...uploads.results.slice(0,PAGE).map((p:any)=>({id:'upload:'+p.id,provider:'upload',streamUrl:p.stream_url||'',sourceVideoUrl:p.source_url||'',challengeId:p.challenge_id||null,title:p.title,channel:'creator:'+p.author,channelName:p.author,category:p.game,videoUrl:'/api/media/'+p.media_key,thumbnail:'/upload-cover.svg',url:'/#clip='+p.id,duration:0,views:0,likes:p.likes,addedAt:p.created_at,createdAt:new Date(p.created_at).toISOString()})));
 const matches=(c:any)=>names.some(n=>identity(c.channel)===identity(n))||identity(c.channelName)===norm||q.toLowerCase().split(/\s+/).every((w:string)=>(c.title+' '+c.channelName+' '+c.category).toLowerCase().includes(w));
 const clips:any[]=[...(!cursor?known.filter(matches):[]),...local],errors:string[]=[],sources:any[]=[],next:any[]=[];
 const requested=cursor?cursor.sources:names.flatMap(channel=>[{provider:'kick',channel,cursor:''},{provider:'twitch',channel,cursor:''}]);
 await Promise.all(requested.map(async(s:any)=>{
  try{
   if(s.provider==='kick'){
    const p=new URLSearchParams({channels:s.channel,sort:sort==='date'?'date':'view',time});if(s.cursor)p.set('cursor',s.cursor);
    const result=await service.getClips(p),source=result.sources[0];
    clips.push(...result.clips.map(c=>({...c,provider:'kick'})));
    sources.push({provider:'kick',channel:s.channel,status:source.paginationIncomplete?'incomplete':source.found===false?'not-found':source.status,count:result.clips.length});
    if(source.nextCursor)next.push({...s,cursor:source.nextCursor});
    if(source.status==='cached')errors.push('Kick is showing cached clips for '+s.channel+'.');
    if(source.status==='unavailable')errors.push('Kick clips for '+s.channel+' could not be loaded.');
   }else if(/^[a-z0-9_]{1,25}$/.test(s.channel)){
    const result=await twitchCreatorClips(config,s.channel,{after:s.cursor,time});
    sources.push({provider:'twitch',channel:s.channel,status:!result.connected?'not-connected':result.error?'unavailable':result.found===false?'not-found':'live',count:result.clips.length});
    clips.push(...result.clips);
    if(result.nextCursor&&!result.error)next.push({...s,cursor:result.nextCursor});
    if(result.error)errors.push(result.error);
   }
  }catch{sources.push({provider:s.provider,channel:s.channel,status:'unavailable',count:0});errors.push('Could not refresh '+s.provider+' clips for '+s.channel+'.');}
 }));
 let web:any={clips:[],links:[],connected:!!config.BRAVE_SEARCH_API_KEY};
 if(!cursor){try{web=await webDiscovery(q,config.BRAVE_SEARCH_API_KEY);}catch{errors.push('Web search is temporarily unavailable.');}}
 // Unverified web attribution stays in source links for creator searches.
 const creatorLookup=cursor?.creatorOnly||known.some(c=>names.some(n=>identity(c.channel)===identity(n)))||sources.some(s=>s.status==='live'&&s.count>0);
 if(!creatorLookup)clips.push(...web.clips);
 const filtered=clips.filter(c=>(!creatorLookup||names.some(n=>identity(c.channel)===identity(n))||identity(c.channelName)===norm)&&(!cutoff||Date.parse(c.createdAt)>=cutoff));
 const merged=mergeSearchClips(filtered,sort),u=await getChatGPTUser();
 if(merged.length){
  const ids=merged.map(c=>c.id.startsWith('upload:')?c.id.slice(7):'reel:'+c.id);
  const counts:any[]=[];
  for(let i=0;i<ids.length;i+=80){const page=ids.slice(i,i+80);const rows=await database().prepare('SELECT post_id,COUNT(*) AS likes,MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS liked FROM likes WHERE post_id IN ('+page.map(()=>'?').join(',')+') GROUP BY post_id').bind(u?.userId||'',...page).all<any>();counts.push(...rows.results);}
  const byId=new Map(counts.map((r:any)=>[r.post_id,r]));
  for(const c of merged){const s:any=byId.get(c.id.startsWith('upload:')?c.id.slice(7):'reel:'+c.id);c.likes=s?.likes||0;c.liked=!!s?.liked;}
 }
 const moreCatalog=stored.results.length>PAGE||uploads.results.length>PAGE;
 const data={clips:mergeSearchClips(merged,sort),links:web.links,webConnected:web.connected,errors:[...new Set(errors)],sources,query:q,sort,time,nextCursor:next.length||moreCatalog?encodeSearchCursor(options,next,offset+PAGE,!!creatorLookup):null,coverage:'Available creator clips. YouTube uses saved clips and source links; automatic Twitch discovery requires a connected app.'};
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof InputError)return Response.json({error:e.message},{status:400});return failure(e);}}
