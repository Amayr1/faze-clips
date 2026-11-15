// Local preview only. Credential files never enter the application or build.
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const directory=root=>resolve(root,'.sites-runtime','demo-access');
const credentialPath=(root,code)=>resolve(directory(root),createHash('sha256').update(code).digest('hex')+'.json');
export async function createDemoCredential(root,origin='http://127.0.0.1:5173',now=Date.now()){
 const url=new URL(origin);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!['http:','https:'].includes(url.protocol))throw Error('Demo access is local only.');
 const code=randomBytes(24).toString('base64url');
 await mkdir(directory(root),{recursive:true});
 await writeFile(credentialPath(root,code),JSON.stringify({expiresAt:now+86400000}),{mode:0o600,flag:'wx'});
 url.pathname='/demo-signin';url.search='';url.hash='';url.searchParams.set('code',code);
 return url.href;
}
export async function redeemDemoCredential(root,code,now=Date.now()){
 if(typeof code!=='string'||!/^[-\w]{32}$/.test(code))return false;
 const path=credentialPath(root,code),claimed=path+'.'+randomUUID()+'.used';
 try{
  const record=JSON.parse(await readFile(path,'utf8'));
  if(!Number.isFinite(record.expiresAt)||record.expiresAt<=now)return false;
  // Only one request can claim a credential, including simultaneous requests.
  await rename(path,claimed);
  await unlink(claimed);
  return true;
 }catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return false;throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(await createDemoCredential(fileURLToPath(new URL('../',import.meta.url))));
}
