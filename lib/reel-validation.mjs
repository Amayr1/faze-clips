import { trustedClipUrl } from './kick.mjs';
import {normalizeStreamUrl,normalizeSourceVideo} from './stream-links.mjs';
export function parseExternalClip(value) {
  let u;try{u=new URL(value);}catch{throw Error('Paste a Twitch clip or YouTube video link.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use an HTTPS Twitch or YouTube link.');
  let provider,externalId;
  if(u.hostname==='clips.twitch.tv'){provider='twitch';externalId=u.pathname.split('/')[1];}
  else if(['www.twitch.tv','twitch.tv','m.twitch.tv'].includes(u.hostname)){provider='twitch';externalId=u.pathname.match(/^\/[a-zA-Z0-9_]+\/clip\/([\w-]+)\/?$/)?.[1];}
  else if(['www.youtube.com','youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)){provider='youtube';externalId=u.hostname==='youtu.be'?u.pathname.slice(1):u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:u.searchParams.get('v');}
  if(!provider||!externalId||!(provider==='youtube'?/^[\w-]{11}$/:/^[\w-]{5,150}$/).test(externalId))throw Error('Use a direct Twitch clip or YouTube video/Short link.');
  return {provider,externalId,id:`${provider}:${externalId}`,url:provider==='twitch'?`https://clips.twitch.tv/${externalId}`:`https://www.youtube.com/watch?v=${externalId}`};
}
export function cleanReel(input) {
  if(!input||typeof input!=='object')throw Error('Invalid reel.');
  const text=(v,max,fallback='')=>typeof v==='string'?v.trim().slice(0,max):fallback;
  const common={title:text(input.title,180,'Shared clip')||'Shared clip',channel:text(input.channel,40,'shared'),channelName:text(input.channelName,80,'Community share'),category:text(input.category,80,'Variety'),createdAt:Number.isFinite(Date.parse(input.createdAt))?new Date(input.createdAt).toISOString():'',duration:Math.min(180,Math.max(0,Number(input.duration)||0)),views:0};
  common.streamUrl=normalizeStreamUrl(input.streamUrl,input.provider||'kick');
  common.sourceVideoUrl=normalizeSourceVideo(input.sourceVideoUrl,input.provider||'kick');
  if(input.provider==='twitch'||input.provider==='youtube'){
    const parsed=parseExternalClip(input.url);
    if(parsed.provider!==input.provider)throw Error('Source mismatch.');
    return {...common,...parsed,thumbnail:parsed.provider==='youtube'?`https://i.ytimg.com/vi/${parsed.externalId}/hqdefault.jpg`:'/twitch-cover.svg',videoUrl:''};
  }
  const videoUrl=trustedClipUrl(input.videoUrl),thumbnail=trustedClipUrl(input.thumbnail,'thumbnail');
  if(!/^clip_[A-Za-z0-9]{12,40}$/.test(input.id)||!videoUrl||!thumbnail||!videoUrl.includes(input.id)||!/^https:\/\/kick\.com\/[a-z0-9][a-z0-9_-]{0,29}\/clips\//.test(input.url)||!input.url.endsWith('/'+input.id))throw Error('Invalid Kick clip.');
  return {...common,id:input.id,provider:'kick',url:input.url,videoUrl,thumbnail};
}
