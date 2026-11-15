import {parseExternalClip} from './reel-validation.mjs';
export async function webDiscovery(query:string,key?:string){
 if(!key)return {clips:[],links:[],connected:false};
 const url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('q',query+' (site:clips.twitch.tv OR site:twitch.tv OR site:youtube.com/shorts OR site:kick.com)');url.searchParams.set('count','15');
 const r=await fetch(url,{headers:{'X-Subscription-Token':key,Accept:'application/json'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Web search could not refresh.');const d=await r.json() as any;
 const links=(d.web?.results||[]).slice(0,15).flatMap((x:any)=>{try{const u=new URL(x.url);if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','clips.twitch.tv','www.twitch.tv','twitch.tv','kick.com','www.kick.com'].includes(u.hostname))return [];return [{title:String(x.title).slice(0,180),url:u.href,description:String(x.description||'').replace(/<[^>]+>/g,'').slice(0,220)}];}catch{return [];}});
 const clips=links.flatMap((x:any)=>{try{const p=parseExternalClip(x.url);return [{...p,title:x.title,channel:'web-discovery',channelName:'Web discovery · check source',category:'Variety',thumbnail:p.provider==='youtube'?`https://i.ytimg.com/vi/${p.externalId}/hqdefault.jpg`:'/twitch-cover.svg',videoUrl:'',views:0,duration:0,createdAt:''}];}catch{return [];}});
 return {clips,links,connected:true};
}
