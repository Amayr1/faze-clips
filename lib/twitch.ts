type Config={TWITCH_CLIENT_ID?:string;TWITCH_CLIENT_SECRET?:string;TWITCH_CHANNELS?:string};
type PageOptions={after?:string;time?:string;first?:number};
let token:{client:string;value:string;until:number}|null=null;
let tokenRequest:Promise<Record<string,string>>|null=null;
const caches=new Map<string,{data:any;until:number}>();
async function get(url:string,headers?:Record<string,string>){const r=await fetch(url,{headers,signal:AbortSignal.timeout(8000),redirect:'manual'});if(!r.ok)throw Error('Twitch could not refresh right now.');return await r.json() as any;}
async function auth(env:Config):Promise<Record<string,string>>{
 if(token&&token.client===env.TWITCH_CLIENT_ID&&token.until>Date.now())return {'Client-Id':env.TWITCH_CLIENT_ID!,Authorization:'Bearer '+token.value};
 if(tokenRequest)return tokenRequest;
 tokenRequest=(async()=>{
  const r=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:env.TWITCH_CLIENT_ID!,client_secret:env.TWITCH_CLIENT_SECRET!,grant_type:'client_credentials'}),signal:AbortSignal.timeout(8000),redirect:'manual'});
  if(!r.ok)throw Error('Twitch credentials need attention.');
  const d=await r.json() as any;if(typeof d.access_token!=='string')throw Error('Twitch authentication failed.');
  token={client:env.TWITCH_CLIENT_ID!,value:d.access_token,until:Date.now()+Math.max(0,Number(d.expires_in)-120)*1000};
  return {'Client-Id':env.TWITCH_CLIENT_ID!,Authorization:'Bearer '+token.value};
 })();
 try{return await tokenRequest;}finally{tokenRequest=null;}
}
export function twitchVodUrl(clip:any){if(!/^\d{1,24}$/.test(String(clip.video_id||'')))return '';let url='https://www.twitch.tv/videos/'+clip.video_id;const seconds=clip.vod_offset;if(Number.isSafeInteger(seconds)&&seconds>=0)url+='?t='+Math.floor(seconds/3600)+'h'+Math.floor(seconds%3600/60)+'m'+seconds%60+'s';return url;}
export async function twitchCreatorClips(env:Config,username:string,{after='',time='all',first=100}:PageOptions={}){
 if(!env.TWITCH_CLIENT_ID||!env.TWITCH_CLIENT_SECRET)return {clips:[],connected:false,nextCursor:null};
 if(!/^[a-z0-9_]{1,25}$/.test(username)||after.length>2048)throw Error('Invalid Twitch creator.');
 const key=JSON.stringify([env.TWITCH_CLIENT_ID,username,after,time,first]),cached=caches.get(key);
 if(cached&&cached.until>Date.now())return cached.data;
 try{
  const headers=await auth(env),users=await get('https://api.twitch.tv/helix/users?login='+encodeURIComponent(username),headers);
  const user=users.data?.[0];if(!user)return {clips:[],connected:true,nextCursor:null,found:false};
  const params=new URLSearchParams({broadcaster_id:user.id,first:String(Math.min(100,Math.max(1,first)))});
  if(after)params.set('after',after);
  const window=({day:86400000,week:604800000,month:2592000000} as Record<string,number>)[time];
  if(window){params.set('started_at',new Date(Date.now()-window).toISOString());params.set('ended_at',new Date().toISOString());}
  const response=await get('https://api.twitch.tv/helix/clips?'+params,headers),raw=response.data||[];
  const ids=[...new Set(raw.map((c:any)=>c.game_id).filter(Boolean))];
  let games:any={data:[]};try{if(ids.length)games=await get('https://api.twitch.tv/helix/games?'+ids.slice(0,100).map(id=>'id='+encodeURIComponent(String(id))).join('&'),headers);}catch{}
  const clips=raw.filter((c:any)=>/^[\w-]{5,150}$/.test(c.id)).map((c:any)=>({id:'twitch:'+c.id,provider:'twitch',externalId:c.id,sourceVideoUrl:twitchVodUrl(c),title:String(c.title||'Twitch clip').slice(0,180),channel:user.login||String(c.broadcaster_name).toLowerCase(),channelName:c.broadcaster_name||user.display_name||username,category:games.data.find((g:any)=>g.id===c.game_id)?.name||'Variety',thumbnail:/^https:\/\/[^/]+\.twitch\.tv\//.test(c.thumbnail_url)?c.thumbnail_url:'/twitch-cover.svg',videoUrl:'',url:'https://clips.twitch.tv/'+c.id,duration:c.duration,views:Math.max(0,Number(c.view_count)||0),createdAt:c.created_at}));
  const cursor=response.pagination?.cursor;
  const nextCursor=typeof cursor==='string'&&cursor!==after&&cursor.length<=2048?cursor:null;
  const data={clips,connected:true,found:true,nextCursor,...(cursor&&!nextCursor?{error:'Twitch pagination did not advance. Full collection is incomplete.'}:{})};
  caches.set(key,{data,until:Date.now()+300000});while(caches.size>80)caches.delete(caches.keys().next().value!);
  return data;
 }catch{return {...(cached?.data||{clips:[],connected:true,nextCursor:null}),error:'Twitch could not refresh. Shared clips remain available.'};}
}
export async function twitchClips(env:Config){
 if(!env.TWITCH_CLIENT_ID||!env.TWITCH_CLIENT_SECRET)return {clips:[],connected:false};
 const names=(env.TWITCH_CHANNELS||'stableronaldo,kaicenat,jasontheween,shroud,pokimane,tarik,caseoh_,summit1g').split(',').map(s=>s.trim().toLowerCase()).filter(s=>/^[a-z0-9_]{1,25}$/.test(s)).slice(0,8);
 const responses=await Promise.all(names.map(n=>twitchCreatorClips(env,n,{first:20})));
 return {clips:responses.flatMap(r=>r.clips),connected:true,...(responses.some(r=>'error' in r)?{error:'Twitch could not refresh. Shared clips remain available.'}:{})};
}
