import {headlessPage} from './headless.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {siteArtifacts} from './site-artifacts.mjs';
const run=promisify(execFile);
export async function checkDemoSync({appPreview}={}){
 for(const [name,content] of Object.entries(await siteArtifacts())){
  const actual=await fs.readFile('docs/'+name,'utf8').catch(()=>null);
  if(actual!==content)throw Error(`演示资源过期或被单独修改：docs/${name}。请运行 npm run build:site，并暂存全部生成资源。`);
 }
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'codex-demo-gate-'));
 try{
  await fs.cp('docs',path.join(directory,'site'),{recursive:true});
  await fs.mkdir(path.join(directory,'native'));
  await run(process.execPath,['scripts/build-payload.mjs',path.join(directory,'native/skin.js')]);
  if(appPreview){
   const expected=await fs.readFile(path.join(directory,'native/preview.html'),'utf8');
   if(await fs.readFile(appPreview,'utf8')!==expected)throw Error('App 预览资源与源码不一致');
   await fs.copyFile(appPreview,path.join(directory,'native/preview.html'));
  }
  const harness=await fs.readFile('tests/fixtures/demo-sync.html','utf8');
  await fs.writeFile(path.join(directory,'test.html'),harness);
  const candidates=[process.env.CHROME_BIN,...(process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'])].filter(Boolean);
  let chrome;for(const candidate of candidates){try{await fs.access(candidate);chrome=candidate;break;}catch{}}
  if(!chrome)throw Error('同步门禁需要 Chrome/Chromium。安装后设置 CHROME_BIN；不会跳过浏览器检查。');
  const browser=await headlessPage(chrome,pathToFileURL(path.join(directory,'test.html')).href,path.join(directory,'profile'));
  let result;
  try{result=await browser.evaluate(`(async()=>{for(let i=0;i<200&&!globalThis.demoGateResult;i++)await new Promise(r=>setTimeout(r,25));if(!globalThis.demoGateResult)throw Error('Harness did not initialize');return await globalThis.demoGateResult;})()`);}finally{await browser.close();}
  if(!result.ok)throw Error('Headless 同步检查失败：'+result.error);
  console.log(`demo-sync: resources match; ${result.checks} headless checks passed`);
  return result;
 }finally{await fs.rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{await checkDemoSync({appPreview:process.argv[2]});}catch(error){console.error(error.message);process.exitCode=1;}
}
