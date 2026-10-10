import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {githubClient,resolveTag} from './github-api.mjs';
import {versionInfo,planRelease,deliverRelease} from './release-policy.mjs';
const api=githubClient(),version=JSON.parse(await fs.readFile('package.json','utf8')).version,v=versionInfo(version);
const sha=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[0-9a-f]{40}$/.test(sha))throw Error('无效提交 SHA');
const [release,tagSha]=await Promise.all([api('releases/tags/'+v.tag,{optional:true}),resolveTag(api,v.tag)]);
const plan=planRelease({version,sha,tagSha,release});
console.log(`${plan.action}: ${v.tag}${v.prerelease?' (prerelease)':''}`);
if(process.argv.includes('--dry-run')||plan.action==='skip')process.exit(0);
if(process.env.GITHUB_ACTIONS!=='true'||!['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))throw Error('发布仅能在受信任的 Actions 推送/手动任务中执行');
const repo=await api('');
if(process.env.GITHUB_REF!==`refs/heads/${repo.default_branch}`)throw Error('仅默认分支可以发布');
const dmg=path.join('dist',v.asset),checksum=dmg+'.sha256';
await deliverRelease({api,version,sha,tagSha,release,bytes:await fs.readFile(dmg),checksum:await fs.readFile(checksum,'utf8'),upload:async()=>{
 // Only the workflow's same-commit draft may be repaired, never a published release.
 execFileSync('gh',['release','upload',v.tag,dmg,checksum,'--clobber','--repo',process.env.GITHUB_REPOSITORY||'czm233/codex-mac-skin'],{stdio:'inherit'});
}});
console.log('Published '+v.tag);
