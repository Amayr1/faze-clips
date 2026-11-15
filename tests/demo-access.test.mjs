import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoCredential,redeemDemoCredential} from '../scripts/demo-access.mjs';

test('local demo credentials expire and can be claimed only once, including concurrent requests',async()=>{
 const root=await mkdtemp(join(tmpdir(),'faze-demo-'));
 try{
  const link=await createDemoCredential(root,undefined,1000),code=new URL(link).searchParams.get('code');
  const outcomes=await Promise.all(Array.from({length:5},()=>redeemDemoCredential(root,code,2000)));
  assert.equal(outcomes.filter(Boolean).length,1);
  assert.equal(await redeemDemoCredential(root,code,2000),false);
  const expired=new URL(await createDemoCredential(root,undefined,1000)).searchParams.get('code');
  assert.equal(await redeemDemoCredential(root,expired,1000+86400000),false);
  assert.equal(await redeemDemoCredential(root,'../../elsewhere'),false);
  await assert.rejects(()=>createDemoCredential(root,'https://public.example'));
 }finally{await rm(root,{recursive:true,force:true});}
});
