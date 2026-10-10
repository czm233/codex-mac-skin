import fs from 'node:fs/promises';
import path from 'node:path';
import {githubClient} from './github-api.mjs';
import {renderReleaseLinks,pagesDigest} from './release-policy.mjs';
const api=githubClient(),release=await api('releases/latest');
const output='work/pages';await fs.mkdir('work',{recursive:true});await fs.rm(output,{recursive:true,force:true});await fs.cp('docs',output,{recursive:true});
const index=path.join(output,'index.html');await fs.writeFile(index,renderReleaseLinks(await fs.readFile(index,'utf8'),release));
const entries=[];
async function visit(directory){for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const file=path.join(directory,entry.name);if(entry.isDirectory())await visit(file);else if(entry.isFile()){const bytes=await fs.readFile(file);entries.push([path.relative(output,file),bytes]);}else throw Error('Pages 不允许符号链接');}}
await visit(output);const digest=pagesDigest(entries);
const page=await api('pages');
if(!page.html_url?.startsWith('https://czm233.github.io/'))throw Error('Pages URL 不属于目标站点');
const response=await fetch(new URL('_deployment.json',page.html_url),{cache:'no-store',signal:AbortSignal.timeout(30000)});
let previous=null;
if(response.ok)previous=await response.json();else if(response.status!==404)throw Error('读取 Pages 发布指纹失败：'+response.status);
const changed=previous?.digest!==digest;
await fs.writeFile(path.join(output,'_deployment.json'),JSON.stringify({digest,release:release.tag_name,commit:process.env.GITHUB_SHA||null})+'\n');
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`changed=${changed}\n`);
console.log(JSON.stringify({changed,release:release.tag_name,digest,output}));
