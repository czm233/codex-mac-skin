import fs from 'node:fs/promises';
import {githubClient} from './github-api.mjs';
const api=githubClient(),repo=await api('');
const tip=await api('commits/'+encodeURIComponent(repo.default_branch));
const current=process.env.GITHUB_REF===`refs/heads/${repo.default_branch}`&&tip.sha===process.env.GITHUB_SHA;
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`current=${current}\n`);
console.log(current?'Current default-branch commit: delivery enabled':'Superseded/non-default commit: delivery skipped');
