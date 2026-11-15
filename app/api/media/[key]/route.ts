import { bucket, database } from "@/lib/community";
export async function GET(request: Request, context: {params: Promise<{key:string}>}) {
  const {key}=await context.params;
  if(!/^[a-f0-9-]{36}\.(mp4|webm|mov)$/.test(key)) return new Response(null,{status:404});
  if(!await database().prepare("SELECT id FROM posts WHERE media_key=?").bind(key).first()) return new Response(null,{status:404});
  const object=await bucket().get(key,{range:request.headers});if(!object) return new Response(null,{status:404});
  const headers=new Headers({"Content-Type":object.httpMetadata?.contentType||"video/mp4","Accept-Ranges":"bytes","Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"});
  const range=object.range as {offset:number;length:number}|undefined;
  if(range){headers.set("Content-Range",`bytes ${range.offset}-${range.offset+range.length-1}/${object.size}`);headers.set("Content-Length",String(range.length));}else headers.set("Content-Length",String(object.size));
  return new Response(object.body,{status:range?206:200,headers});
}
