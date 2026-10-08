import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {attachSettings} from './panel.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {connect} from './cdp.mjs';
import {installVideoSkin} from './renderer.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const PORT=10270;
export const KEY='window.__codexVideoSkinV1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function readVideo(filename) {
  const stat=await fs.lstat(filename);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size<=0 || stat.size>64*1024*1024) throw new Error('Use a regular MP4 file below 64 MiB. Prepare a 1080p H.264 copy first.');
  const bytes=await fs.readFile(filename);
  if(path.extname(filename).toLowerCase()!=='.mp4' || bytes.toString('ascii',4,8)!=='ftyp') throw new Error('Expected an MP4 container');
  return bytes;
}

export async function apply(client, bytes, dim=0.30, options={}) {
  await client.evaluate(`(${installVideoSkin.toString()})(${JSON.stringify({dim})})`);
  try {
    await client.evaluate(`${KEY}.begin(${bytes.length})`);
    for(let offset=0;offset<bytes.length;offset+=256*1024) {
      const chunk=bytes.subarray(offset,offset+256*1024).toString('base64');
      await client.evaluate(`${KEY}.append(${JSON.stringify(chunk)})`);
    }
    await client.evaluate(`${KEY}.commit()`);
    if(options.panel)await client.evaluate(`(${attachSettings.toString()})(${KEY},${JSON.stringify({id:createHash('sha256').update(bytes).digest('hex'),name:options.name,preferSaved:options.preferSaved})})`);
    return await client.evaluate(`${KEY}.status()`);
  } catch(error) {
    await client.evaluate(`${KEY}?.destroy()`).catch(()=>{}); throw error;
  }
}

// Refuse a browser or unrelated service on the registered app port.
export function verifyOwner() {
  const pids=[...new Set(execFileSync('/usr/sbin/lsof',['-nP',`-iTCP:${PORT}`,'-sTCP:LISTEN','-t'],{encoding:'utf8'}).trim().split(/\s+/))];
  if(!pids.length || pids.some(p=>!/^\d+$/.test(p))) throw new Error('Codex debug endpoint is unavailable');
  const rows=execFileSync('/bin/ps',['-axo','pid=,ppid=,command='],{encoding:'utf8'}).split('\n');
  const processes=new Map(rows.map(row=>row.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>[m[1],{parent:m[2],args:m[3]}]));
  const roots=pids.filter(pid=>{
    const args=processes.get(pid)?.args||'';
    return args.startsWith('/Applications/ChatGPT.app/Contents/MacOS/ChatGPT ') && args.includes(`--remote-debugging-port=${PORT}`);
  });
  if(roots.length!==1) throw new Error('Port has no unique official Codex owner; refusing to attach');
  // Native helper processes can inherit the listening FD. Only descendants of
  // the verified app are accepted; unrelated listeners still fail closed.
  for(const pid of pids) {
    let ancestor=pid;
    for(let depth=0;depth<40 && ancestor!==roots[0];depth++) ancestor=processes.get(ancestor)?.parent;
    if(ancestor!==roots[0]) throw new Error('Port belongs to another application; refusing to attach');
  }
  const addresses=execFileSync('/usr/sbin/lsof',['-nP',`-iTCP:${PORT}`,'-sTCP:LISTEN'],{encoding:'utf8'});
  if(addresses.split('\n').slice(1).filter(Boolean).some(line=>!line.includes(`127.0.0.1:${PORT}`)&&!line.includes(`[::1]:${PORT}`))) throw new Error('Debug endpoint is not loopback-only');
}

export async function appClients() {
  verifyOwner();
  const response=await fetch(`http://127.0.0.1:${PORT}/json/list`,{signal:AbortSignal.timeout(3000)});
  const targets=await response.json(); const clients=[];
  for(const target of targets) {
    if(target.type!=='page' || !/^app:\/\//.test(target.url) || !target.webSocketDebuggerUrl) continue;
    const page=new URL(target.url);
    if(page.pathname!=='/index.html' || page.searchParams.get('initialRoute')==='/avatar-overlay') continue;
    const endpoint=new URL(target.webSocketDebuggerUrl);
    if(endpoint.port!==String(PORT)) continue;
    const c=await connect(target.webSocketDebuggerUrl);
    const valid=await c.evaluate(`Boolean(document.getElementById('root') && document.querySelector('main, [role="main"]'))`).catch(()=>false);
    if(valid) clients.push(c); else c.close();
  }
  if(!clients.length) throw new Error('No supported Codex window found. Wait for the main window to load.');
  return clients;
}

async function main() {
  const [command='status',arg]=process.argv.slice(2);
  const allowed=['apply','status','pause','resume','restore','dim','glass','fit','wait-apply'];
  if(!allowed.includes(command)) throw new Error(`Commands: ${allowed.join(', ')}`);
  const file=arg?path.resolve(arg):path.join(ROOT,'media/background.mp4');
  const bytes=['apply','wait-apply'].includes(command)?await readVideo(file):null;
  let clients;
  if(command==='wait-apply') {
    for(let i=0;i<45;i++) {try {clients=await appClients();break;} catch {await sleep(1000);}}
    if(!clients) throw new Error('Codex did not expose a supported debug window within 45 seconds');
  } else clients=await appClients();
  try {
    for(const c of clients) {
      let result;
      if(bytes) result=await apply(c,bytes,.3,{panel:true,name:path.basename(file),preferSaved:!arg});
      else if(command==='dim') {
        const value=Number(arg); if(!Number.isFinite(value)||value<0||value>0.9) throw new Error('Dim must be between 0 and 0.9');
        result=await c.evaluate(`${KEY}?.setDim(${value}) ?? {active:false}`);
      } else if(command==='glass') {
        const value=Number(arg); if(!Number.isFinite(value)||value<0||value>0.45) throw new Error('Glass must be between 0 and 0.45');
        result=await c.evaluate(`${KEY}?.setGlass(${value}) ?? {active:false}`);
      } else if(command==='fit') {
        if(!['contain','cover'].includes(arg)) throw new Error('Fit must be contain or cover');
        result=await c.evaluate(`${KEY}?.setFit(${JSON.stringify(arg)}) ?? {active:false}`);
      } else if(command==='restore') result=await c.evaluate(`(() => {${KEY}?.destroy();return {restored:!document.getElementById('cvs-video')&&!document.documentElement.classList.contains('cvs-active')};})()`);
      else result=await c.evaluate(`${KEY}?.${command}() ?? {active:false}`);
      console.log(JSON.stringify(result));
    }
  } finally {clients.forEach(c=>c.close());}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message);process.exitCode=1;});
