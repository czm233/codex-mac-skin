import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
let current='';try{current=execFileSync('git',['config','--get','core.hooksPath'],{encoding:'utf8'}).trim();}catch{}
if(current&&current!=='.githooks')throw Error(`已有 hooksPath=${current}，请合并已有钩子后安装，未覆盖。`);
const legacy=execFileSync('git',['rev-parse','--git-path','hooks/pre-commit'],{encoding:'utf8'}).trim();
if(!current&&fs.existsSync(legacy))throw Error('已有 pre-commit 钩子，请先合并；未覆盖。');
execFileSync('git',['config','--local','core.hooksPath','.githooks']);
console.log('pre-commit installed: staged snapshot + headless demo-sync');
