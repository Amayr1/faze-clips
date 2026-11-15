import {database,writer,failure} from '@/lib/community';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {PROVIDER,NETWORKS,publishingConfigured,linkedAccounts,linkSession,dispatchPost,syncPublications} from '@/lib/publisher';
export async function GET(){try{const u=await getChatGPTUser();const accounts=u?await linkedAccounts(u.userId):[];const rows=u?await database().prepare('SELECT id,post_id AS postId,platform,status,url,external_likes AS likes,external_views AS views,synced_at AS syncedAt,message FROM publications WHERE owner=? ORDER BY created_at DESC LIMIT 100').bind(u.userId).all():{results:[]};return Response.json({provider:PROVIDER,configured:publishingConfigured(),signedIn:!!u,accounts,publications:rows.results},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
  const u=await writer(request),b=await request.json() as any,origin=new URL(request.url).origin;
  if(!publishingConfigured())return Response.json({error:'Social publishing needs to be connected by the site owner. Your FaZe uploads and likes already work.'},{status:503});
  if(b.action==='connect')return Response.json({url:await linkSession(u.userId,origin)});
  if(b.action==='publish'){
    if(!Array.isArray(b.targets)||!b.targets.length||b.targets.length>4||b.targets.some((t:any)=>!NETWORKS.includes(t))||b.confirm!==true||typeof b.postId!=='string'||typeof b.caption!=='string'||!b.caption.trim()||b.caption.length>2000)throw Error('Choose connected platforms, review the caption and confirm that you own the clip.');
    return Response.json(await dispatchPost(u.userId,b.postId,[...new Set(b.targets)] as string[],b.caption,origin));
  }
  if(b.action==='sync')return Response.json(await syncPublications(u.userId));
  throw Error('Unknown publishing action.');
}catch(e){return failure(e);}}
