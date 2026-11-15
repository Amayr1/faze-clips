const unknown=new Set(['shared','web-discovery','unknown','community']);
export function normalizeStreamUrl(value,provider){
 if(value==null||value==='')return '';
 if(typeof value!=='string'||value.length>400)throw Error('Use a Kick, Twitch or YouTube creator channel link.');
 let u;try{u=new URL(value.trim());}catch{throw Error('Use a valid creator stream URL.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)throw Error('Use an HTTPS creator channel link without query parameters.');
 const host=u.hostname.replace(/^www\./,''),path=decodeURIComponent(u.pathname);
 let network,canonical;
 if(host==='kick.com'&&/^\/[a-z0-9][a-z0-9_-]{0,29}\/?$/i.test(path)){
  network='kick';canonical='https://kick.com/'+path.split('/')[1].toLowerCase();
 }else if(host==='twitch.tv'&&/^\/[a-z0-9_]{1,25}\/?$/i.test(path)){
  network='twitch';canonical='https://www.twitch.tv/'+path.split('/')[1].toLowerCase();
 }else if(host==='youtube.com'){
  const handle=path.match(/^\/@([\p{L}\p{N}_.-]{3,100})(?:\/live)?\/?$/u),channel=path.match(/^\/channel\/(UC[\w-]{22})(?:\/live)?\/?$/);
  if(handle)canonical='https://www.youtube.com/@'+encodeURIComponent(handle[1])+'/live';
  else if(channel)canonical='https://www.youtube.com/channel/'+channel[1]+'/live';
  network='youtube';
 }
 if(!canonical||provider&&provider!=='upload'&&provider!==network)throw Error('Use the creator’s channel on the same platform as this clip.');
 return canonical;
}
export function streamerPage(clip){
 try{
  if(clip.streamUrl)return normalizeStreamUrl(clip.streamUrl,clip.provider||'kick');
  const provider=clip.provider||'kick';
  if(provider==='kick'){
   const u=new URL(clip.url),slug=u.pathname.match(/^\/([a-z0-9][a-z0-9_-]{0,29})\/clips\//i)?.[1];
   if(u.hostname==='kick.com'&&slug)return normalizeStreamUrl('https://kick.com/'+slug,'kick');
  }
  if(provider==='twitch'&&!unknown.has(clip.channel)&&/^[a-z0-9_]{1,25}$/i.test(clip.channel))return normalizeStreamUrl('https://www.twitch.tv/'+clip.channel,'twitch');
 }catch{}
 return null;
}
export function normalizeSourceVideo(value,provider){
 if(value==null||value==='')return '';
 if(typeof value!=='string'||value.length>500)throw Error('Use a valid full-video or VOD link.');
 let u;try{u=new URL(value);}catch{throw Error('Use a valid full-video or VOD link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)throw Error('Use an HTTPS full-video or VOD link.');
 const host=u.hostname.replace(/^www\./,'');let network,url;
 if(host==='youtube.com'&&u.pathname==='/watch'&&/^[\w-]{11}$/.test(u.searchParams.get('v')||'')){network='youtube';url='https://www.youtube.com/watch?v='+u.searchParams.get('v');}
 else if(host==='twitch.tv'&&/^\/videos\/\d{1,24}\/?$/.test(u.pathname)){
  network='twitch';url='https://www.twitch.tv'+u.pathname.replace(/\/$/,'');const t=u.searchParams.get('t');if(t){if(!/^(?:\d+h)?(?:\d+m)?(?:\d+s)?$/.test(t)||!t.length)throw Error('Use a valid VOD timestamp.');url+='?t='+t;}
 }else if(host==='kick.com'&&/^\/[a-z0-9][a-z0-9_-]{0,29}\/videos\/[a-f0-9-]{36}\/?$/.test(u.pathname)){network='kick';url='https://kick.com'+u.pathname.replace(/\/$/,'');}
 if(!url||provider&&provider!=='upload'&&provider!==network)throw Error('Use a full video from this clip’s platform.');
 return url;
}
