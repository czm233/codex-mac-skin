import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const gate=cwd=>run(process.execPath,['scripts/demo-gate.mjs'],{cwd,timeout:60000,maxBuffer:1024*1024});
test('demo-sync: real headless page and native preview match',{timeout:60000},async()=>{
 const {stdout}=await gate(process.cwd());assert.match(stdout,/headless checks passed/);
});
test('demo-sync: stale artifacts and native-only style drift block delivery',{timeout:60000},async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'demo-gate-negative-'));
 try{
  for(const dir of ['scripts','src','docs','app','tests/fixtures'])await fs.cp(dir,path.join(root,dir),{recursive:true});
  const css=path.join(root,'docs/workspace.css'),original=await fs.readFile(css,'utf8');
  await fs.appendFile(css,'\n.demo{color:red}\n');
  await assert.rejects(gate(root),e=>/演示资源过期/.test(e.stderr),'stale generated CSS must fail');
  await fs.writeFile(css,original);
  const template=path.join(root,'app/preview.html');
  await fs.writeFile(template,(await fs.readFile(template,'utf8')).replace('</style>','.sidebar{color:magenta!important}</style>'));
  await assert.rejects(gate(root),e=>/computed theme differs/.test(e.stderr),'native-only visual drift must fail in Chrome');
  await assert.rejects(run('bash',['scripts/build-app.sh'],{cwd:root,timeout:45000}),e=>/computed theme differs/.test(e.stderr),'App packaging must stop at the failed gate, before compilation');
  await assert.rejects(fs.access(path.join(root,'dist/Codex Skin.app/Contents/MacOS/CodexSkin')),'failed gate must not produce a binary');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('pre-commit checks the index, not unstaged working-tree fixes',{timeout:15000},async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'demo-index-test-'));
 const check=()=>run(process.execPath,[path.resolve('scripts/check-staged.mjs')],{cwd:root,timeout:10000});
 try{
  await fs.mkdir(path.join(root,'scripts'));
  // Only these two deliberately synthetic, credential-free files are staged.
  await fs.writeFile(path.join(root,'scripts/demo-gate.mjs'),"import fs from 'node:fs';if(fs.readFileSync('state.txt','utf8')!=='valid')process.exit(1);");
  await fs.writeFile(path.join(root,'state.txt'),'broken');
  await run('git',['init','-q'],{cwd:root});
  await run('git',['add','scripts/demo-gate.mjs','state.txt'],{cwd:root});
  await fs.writeFile(path.join(root,'state.txt'),'valid');
  await assert.rejects(check(),e=>/提交已阻止/.test(e.stderr),'unstaged fix cannot hide broken staged content');
  await run('git',['add','state.txt'],{cwd:root});
  await fs.writeFile(path.join(root,'state.txt'),'broken');
  await check();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
