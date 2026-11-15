import {env} from 'cloudflare:workers';
import snapshot from '@/public/data/faze-schedule-roster.json';
import identities from '@/public/data/twitch-schedule-identities.json';
import {createScheduleService,ScheduleError} from '@/lib/schedule-service.mjs';
const service=createScheduleService({env:env as {TWITCH_CLIENT_ID?:string;TWITCH_CLIENT_SECRET?:string;YOUTUBE_API_KEY?:string;FAZE_TWITCH_CHANNELS?:string},snapshot,identities:identities.ids});
export async function GET(request:Request){
 try{return Response.json(await service.get(new URL(request.url).searchParams),{headers:{'Cache-Control':'public, max-age=60'}});}
 catch(error){return Response.json({error:error instanceof ScheduleError?error.message:'Schedules could not refresh. Try again shortly.'},{status:error instanceof ScheduleError?error.status:503});}
}
