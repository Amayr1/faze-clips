import {FEATURED_STREAMERS,ROSTER_URL,parseActiveRoster,linkMembers,memberChannel,memberSchedule} from './schedule-directory.mjs';
import {parseTwitchCalendar} from './twitch-calendar.mjs';
const DAY=86400000;
export class ScheduleError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function scheduleWindow(params,now=Date.now()){
 const mode=params.get('mode')||'featured',start=params.get('start')||new Date(now).toISOString().slice(0,10);
 const date=Date.parse(start+'T00:00:00Z');
 if(!['featured','faze'].includes(mode))throw new ScheduleError('Choose Featured 12 or FaZe members.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==start||Math.abs(date-now)>366*DAY)throw new ScheduleError('Choose a week within the next or previous year.');
 // Cover either side of a local calendar week for every supported time zone.
 return {mode,start,from:date-DAY,to:date+8*DAY};
}
const within=(start,end,from,to)=>Date.parse(start)<to&&(end?Date.parse(end)>from:Date.parse(start)>=from);
export function createScheduleService({env={},snapshot,identities={},fetcher=fetch,now=Date.now}){
 let rosterCache=null,authCache=null,authPending=null;
 const results=new Map(),pending=new Map(),youtubeCache=new Map(),calendarCache=new Map(),calendarPending=new Map();
 async function request(url,options={}){
  return fetcher(url,{...options,redirect:'manual',signal:AbortSignal.timeout(10000)});
 }
 async function json(url,headers){const r=await request(url,{headers});if(!r.ok)throw Error('Source unavailable');return r.json();}
 async function directory(){
  if(rosterCache&&rosterCache.until>now())return rosterCache.value;
  try{
   const r=await request(ROSTER_URL);if(!r.ok)throw Error();
   const html=await r.text();if(html.length>2000000)throw Error();
   const value={members:parseActiveRoster(html),source:ROSTER_URL,checkedAt:new Date(now()).toISOString(),status:'live'};
   rosterCache={value,until:now()+6*3600000};return value;
  }catch{
   const value={...snapshot,status:'snapshot'};
   rosterCache={value,until:now()+60000};return value;
  }
 }
 async function auth(){
  if(authCache&&authCache.until>now())return authCache.headers;
  if(authPending)return authPending;
  authPending=(async()=>{
   const r=await request('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:env.TWITCH_CLIENT_ID,client_secret:env.TWITCH_CLIENT_SECRET,grant_type:'client_credentials'})});
   if(!r.ok)throw Error('Twitch unavailable');
   const d=await r.json();if(typeof d.access_token!=='string'||!Number.isFinite(Number(d.expires_in)))throw Error();
   const headers={'Client-Id':env.TWITCH_CLIENT_ID,Authorization:'Bearer '+d.access_token};
   authCache={headers,until:now()+Math.max(0,Number(d.expires_in)-120)*1000};return headers;
  })();
  try{return await authPending;}finally{authPending=null;}
 }
 async function twitchSchedule(member,user,headers,window){
  const events=[],seen=new Set();let after='',vacation=null;
  for(let page=0;page<20;page++){
   const q=new URLSearchParams({broadcaster_id:user.id,first:'25',start_time:new Date(window.from).toISOString()});if(after)q.set('after',after);
   const r=await request('https://api.twitch.tv/helix/schedule?'+q,{headers});
   if(r.status===404)return {status:'empty',events:[],vacation:null};
   if(!r.ok)throw Error();
   const body=await r.json();if(!body.data||!Array.isArray(body.data.segments))throw Error();
   vacation=body.data.vacation||vacation;
   const segments=body.data.segments;
   for(const s of segments){
    const start=Date.parse(s.start_time),end=s.end_time?Date.parse(s.end_time):null;
    if(typeof s.id!=='string'||!Number.isFinite(start)||(end!==null&&!Number.isFinite(end))||!within(s.start_time,s.end_time,window.from,window.to))continue;
    const onVacation=vacation&&start>=Date.parse(vacation.start_time)&&start<Date.parse(vacation.end_time);
    events.push({id:'twitch:'+s.id,memberId:member.id,provider:'twitch',title:String(s.title||'Scheduled stream').slice(0,250),start:new Date(start).toISOString(),end:end===null?null:new Date(end).toISOString(),category:String(s.category?.name||''),recurring:!!s.is_recurring,cancelled:!!s.canceled_until||!!onVacation,url:memberChannel(member)});
   }
   const cursor=body.pagination?.cursor;
   // The API's schedule is chronological; stop once its page passes this week's end.
   if(!cursor||segments.some(s=>Date.parse(s.start_time)>=window.to))return {status:events.length?'ready':'empty',events,vacation};
   if(typeof cursor!=='string'||cursor.length>2048||seen.has(cursor))return {status:'partial',events,vacation};
   seen.add(cursor);after=cursor;
  }
  return {status:'partial',events,vacation};
 }
 async function publicSchedule(member,window){
  const id=identities[member.twitch];if(!/^\d{1,24}$/.test(id||''))throw Error('No confirmed channel ID');
  let cached=calendarCache.get(id);
  if(!cached||cached.until<=now()){
   if(!calendarPending.has(id))calendarPending.set(id,(async()=>{
    const r=await request('https://api.twitch.tv/helix/schedule/icalendar?broadcaster_id='+id);if(!r.ok)throw Error('Calendar unavailable');
    const text=await r.text();if(text.length>2000000)throw Error('Calendar too large');
    const value={text,until:now()+6*3600000,checkedAt:new Date(now()).toISOString()};calendarCache.set(id,value);return value;
   })().finally(()=>calendarPending.delete(id)));
   cached=await calendarPending.get(id);
  }
  try{return {...parseTwitchCalendar(cached.text,member,window),checkedAt:cached.checkedAt};}
  catch(error){calendarCache.delete(id);throw error;}
 }
 async function youtubePrograms(member){
  const cached=youtubeCache.get(member.youtube);if(cached&&cached.until>now())return cached.value;
  const ids=new Set();let partial=false;
  // Search calls are quota sensitive: share this channel result across all week views for an hour.
  for(const kind of ['upcoming','live']){
   let pageToken='';const seen=new Set();
   for(let page=0;page<5;page++){
    const q=new URLSearchParams({key:env.YOUTUBE_API_KEY,part:'snippet',channelId:member.youtube,eventType:kind,type:'video',maxResults:'50'});if(pageToken)q.set('pageToken',pageToken);
    const data=await json('https://www.googleapis.com/youtube/v3/search?'+q);
    if(!Array.isArray(data.items))throw Error();
    for(const item of data.items)if(/^[\w-]{11}$/.test(item.id?.videoId))ids.add(item.id.videoId);
    if(!data.nextPageToken)break;
    if(seen.has(data.nextPageToken)||page===4){partial=true;break;}
    seen.add(data.nextPageToken);pageToken=data.nextPageToken;
   }
  }
  const videos=[],all=[...ids];
  for(let i=0;i<all.length;i+=50){
   const q=new URLSearchParams({key:env.YOUTUBE_API_KEY,part:'snippet,liveStreamingDetails',id:all.slice(i,i+50).join(',')});
   const data=await json('https://www.googleapis.com/youtube/v3/videos?'+q);if(!Array.isArray(data.items))throw Error();videos.push(...data.items);
  }
  const value={videos,partial,checkedAt:new Date(now()).toISOString()};
  youtubeCache.set(member.youtube,{value,until:now()+3600000});return value;
 }
 async function collect(window){
  const roster=window.mode==='faze'?await directory():null;
  const raw=window.mode==='faze'?linkMembers(roster.members,env.FAZE_TWITCH_CHANNELS):FEATURED_STREAMERS;
  const members=raw.map(m=>({...m,channelUrl:memberChannel(m),scheduleUrl:memberSchedule(m),status:m.twitch?'not-connected':m.youtube?'not-connected':'unlinked',live:null,events:[],vacation:null}));
  const connected={twitch:!!(env.TWITCH_CLIENT_ID&&env.TWITCH_CLIENT_SECRET),youtube:!!env.YOUTUBE_API_KEY,publicCalendars:members.some(m=>m.twitch&&identities[m.twitch])};
  const twitchMembers=members.filter(m=>m.twitch);
  let headers=null,users=[],live=[],liveKnown=false,twitchFailed=false;
  if(connected.twitch&&twitchMembers.length){
   try{
    headers=await auth();
    const logins=[...new Set(twitchMembers.map(m=>m.twitch))];
    for(let i=0;i<logins.length;i+=100){
     const data=await json('https://api.twitch.tv/helix/users?'+logins.slice(i,i+100).map(n=>'login='+encodeURIComponent(n)).join('&'),headers);
     if(!Array.isArray(data.data))throw Error();users.push(...data.data);
    }
    try{
     for(let i=0;i<users.length;i+=100){
      const data=await json('https://api.twitch.tv/helix/streams?'+users.slice(i,i+100).map(u=>'user_id='+encodeURIComponent(u.id)).join('&'),headers);
      if(!Array.isArray(data.data))throw Error();live.push(...data.data);
     }
     liveKnown=true;
    }catch{}
   }catch{twitchFailed=true;}
  }
  let index=0;
  async function worker(){while(index<members.length){const member=members[index++];
   if(member.twitch&&connected.twitch){
    if(twitchFailed){try{Object.assign(member,await publicSchedule(member,window));}catch{member.status='unavailable';}continue;}
    const user=users.find(u=>String(u.login).toLowerCase()===member.twitch);
    if(!user){member.status='not-found';continue;}
    const stream=live.find(s=>String(s.user_id)===String(user.id));
    member.live=liveKnown?!!stream:null;
    if(stream)member.liveTitle=String(stream.title||'Live now').slice(0,250);
    try{Object.assign(member,await twitchSchedule(member,user,headers,window));}catch{try{Object.assign(member,await publicSchedule(member,window));}catch{member.status='unavailable';}}
   }else if(member.twitch&&identities[member.twitch]){
    try{Object.assign(member,await publicSchedule(member,window));}catch{member.status='unavailable';}
   }else if(member.youtube&&connected.youtube){
    try{
     const data=await youtubePrograms(member);member.checkedAt=data.checkedAt;
     member.events=data.videos.filter(v=>v.snippet?.channelId===member.youtube&&!v.liveStreamingDetails?.actualEndTime&&Number.isFinite(Date.parse(v.liveStreamingDetails?.scheduledStartTime))).map(v=>({id:'youtube:'+v.id,memberId:member.id,provider:'youtube',title:String(v.snippet.title||'Scheduled stream').slice(0,250),start:v.liveStreamingDetails.scheduledStartTime,end:null,cancelled:false,recurring:false,category:'',url:'https://www.youtube.com/watch?v='+v.id})).filter(e=>within(e.start,null,window.from,window.to));
     member.live=data.videos.some(v=>v.snippet?.channelId===member.youtube&&v.snippet?.liveBroadcastContent==='live'&&!v.liveStreamingDetails?.actualEndTime);
     member.status=data.partial?'partial':member.events.length?'ready':'empty';
    }catch{member.status='unavailable';}
   }
  }}
  await Promise.all(Array.from({length:Math.min(4,members.length)},worker));
  for(const m of members)m.events=[...new Map(m.events.map(e=>[e.id,e])).values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  return {mode:window.mode,start:window.start,checkedAt:new Date(now()).toISOString(),connected,roster:roster?{source:ROSTER_URL,checkedAt:roster.checkedAt,status:roster.status}:null,members};
 }
 return {async get(params){
  const window=scheduleWindow(params,now()),key=window.mode+':'+window.start;
  const cached=results.get(key);if(cached&&cached.until>now())return cached.value;
  if(pending.has(key))return pending.get(key);
  const promise=collect(window).then(value=>{results.set(key,{value,until:now()+120000});while(results.size>30)results.delete(results.keys().next().value);return value;}).finally(()=>pending.delete(key));
  pending.set(key,promise);return promise;
 }};
}
