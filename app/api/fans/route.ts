import {database,writer,failure} from '@/lib/community';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {createFanService,FanError} from '@/lib/fan-service.mjs';
import {readCommentJson,CommentError} from '@/lib/comments-service.mjs';
const fans=createFanService({database});
function error(e:unknown){if(e instanceof FanError)return Response.json({error:e.message},{status:e.status});if(e instanceof CommentError)return Response.json({error:'Send a valid request under 16 KB.'},{status:e.status});return failure(e);}
export async function GET(){try{const u=await getChatGPTUser();const [profile,pulse,spotlight]=await Promise.all([fans.profile(u?.userId),fans.pulse(),fans.spotlight(u?.userId)]);return Response.json({signedIn:!!u,profile,pulse,spotlight},{headers:{'Cache-Control':'no-store'}});}catch(e){return error(e);}}
export async function POST(request:Request){try{
 const u=await writer(request),b=await readCommentJson(request);let result;
 if(b.action==='audience')result={profile:await fans.audience(u.userId,b.audience)};
 else if(b.action==='era')result={profile:await fans.era(u.userId,b.id,b.saved)};
 else if(b.action==='event')result=await fans.event(u.userId,b.kind,b.item);
 else if(b.action==='partner')result=await fans.partnership(u.userId,b);
 else throw new FanError(400,'Choose a valid fan action.');
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return error(e);}}
