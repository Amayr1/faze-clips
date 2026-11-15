import { createClipService, InputError } from "@/lib/kick.mjs";
import snapshot from "@/public/data/clips.json";
import creatorSnapshot from "@/public/data/creator-clips.json";
import {twitchClips} from "@/lib/twitch";
import {database} from '@/lib/community';
import {env} from "cloudflare:workers";

const service = createClipService({ snapshot });

export async function GET(request: Request) {
  try {
    const data = await service.getClips(new URL(request.url).searchParams);
    const twitch=await twitchClips(env as {TWITCH_CLIENT_ID?:string;TWITCH_CLIENT_SECRET?:string;TWITCH_CHANNELS?:string});
    const cutoff=data.time==='all'?0:Date.now()-({day:86400000,week:604800000,month:2592000000}[data.time]||0);
    const external=[...twitch.clips,...creatorSnapshot.clips].filter(c=>data.time==='all'||Date.parse(c.createdAt)>=cutoff);
    const clips=[...new Map([...external,...data.clips.map(c=>({...c,provider:'kick'}))].map(c=>[c.id,c])).values()];
    try{await database().batch(clips.slice(0,200).map(c=>database().prepare('INSERT OR IGNORE INTO reels(id,data,added_at) VALUES(?,?,?)').bind(c.id,JSON.stringify(c),Date.now())));}catch{}
    return Response.json({...data,clips,twitch:{connected:twitch.connected,error:twitch.error},creatorSources:'Curated public Twitch clips and official Live Speedy Shorts'}, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    if (error instanceof InputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "The clip feed is temporarily unavailable." }, { status: 503 });
  }
}
