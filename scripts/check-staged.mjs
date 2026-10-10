import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
// checkout-index exports the index, not the working tree. Unstaged fixes cannot
// hide a broken commit. No changes to the real index or worktree are made.
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'codex-staged-'));
try{
 execFileSync('git',['checkout-index','--all','--prefix='+directory+path.sep],{stdio:'inherit'});
 execFileSync(process.execPath,['scripts/demo-gate.mjs'],{cwd:directory,stdio:'inherit',timeout:90000});
}catch{console.error('提交已阻止：暂存区未通过 demo-sync。修复并重新 git add 后重试。');process.exitCode=1;}
finally{await fs.rm(directory,{recursive:true,force:true});}
