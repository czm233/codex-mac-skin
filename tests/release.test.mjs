import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {versionInfo,planRelease,verifyChecksum,renderReleaseLinks,deliverRelease,pagesDigest} from '../scripts/release-policy.mjs';
const sha='a'.repeat(40),other='b'.repeat(40);
function release(version='0.4.0'){
 const v=versionInfo(version);return {tag_name:v.tag,draft:false,prerelease:v.prerelease,assets:[{name:v.asset,size:100,browser_download_url:`https://github.com/czm233/codex-mac-skin/releases/download/${v.tag}/${v.asset}`},{name:v.asset+'.sha256',size:100}]};
}
test('release policy distinguishes new, prerelease, published, draft and conflicting tags',()=>{
 assert.equal(planRelease({version:'0.4.0',sha}).action,'create');
 for(const version of ['0.4.0-dev.1','0.4.0-alpha','0.4.0-beta.1','0.4.0-rc.1'])assert.throws(()=>planRelease({version,sha}),/禁止预发布/);
 assert.throws(()=>planRelease({version:'0.4.0',sha,tagSha:sha,release:{...release(),prerelease:true}}),/预发布/);
 assert.equal(planRelease({version:'0.4.0',sha,tagSha:other,release:release()}).action,'skip');
 assert.throws(()=>planRelease({version:'0.4.0',sha,tagSha:other}),/其他提交/);
 assert.equal(planRelease({version:'0.4.0',sha,tagSha:sha,release:{draft:true,body:`<!-- codex-skin-cd:${sha} -->`}}).action,'resume');
 assert.throws(()=>planRelease({version:'0.4.0',sha,release:{draft:true,body:'manual draft'}}),/不会覆盖/);
 assert.throws(()=>planRelease({version:'0.4.0',sha,tagSha:sha,release:{...release(),assets:[]}}),/不会自动覆盖/);
 for(const v of ['x','0.04.0','0.4.0+build','0.4.0-dev.01','1.2.3;echo bad'])assert.throws(()=>versionInfo(v));
});
test('DMG checksums bind actual bytes to a portable filename',()=>{
 const bytes=Buffer.from('fixture'),hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(verifyChecksum(bytes,`${hash}  package.dmg\n`,'package.dmg'),hash);
 assert.throws(()=>verifyChecksum(bytes,`${hash}  /tmp/package.dmg`,'package.dmg'));
 assert.throws(()=>verifyChecksum(Buffer.from('bad'),`${hash}  package.dmg`,'package.dmg'));
});
test('Pages download and instructions advance only for published stable assets',async()=>{
 const html=await fs.readFile('docs/index.html','utf8');
 const next=renderReleaseLinks(html,release());
 assert.match(next,/releases\/download\/v0.4.0\/Codex-Skin-0.4.0-macOS.dmg/);
 assert.doesNotMatch(next,/v0.3.0/);
 assert.match(next,/选择皮肤预览后点击/);
 assert.doesNotMatch(next,/当前下载的 .* 不包含这些能力/);
 const legacy=release('0.3.0');legacy.assets.pop();assert.match(renderReleaseLinks(html,legacy),/尚未包含在当前下载的 v0.3.0/);
 assert.throws(()=>renderReleaseLinks(html,release('0.4.0-dev.1')),/正式版/);
 assert.throws(()=>renderReleaseLinks(html,{...release(),draft:true}),/正式版/);
 assert.throws(()=>renderReleaseLinks(html,{...release(),assets:[]}),/资源不完整/);
 assert.throws(()=>renderReleaseLinks(html.replace('<!--RELEASE_VERSION-->',''),release()),/缺少发布文案/);
});

test('publishing happens only after a valid DMG and both complete uploads',async()=>{
 const bytes=Buffer.from('DMG fixture'),filename=versionInfo('0.4.0').asset;
 const checksum=createHash('sha256').update(bytes).digest('hex')+'  '+filename+'\n';
 const calls=[];
 const api=async(endpoint,options={})=>{calls.push([endpoint,options]);if(endpoint==='releases')return {id:1};if(!options.method)return {assets:[{name:filename,size:bytes.length},{name:filename+'.sha256',size:Buffer.byteLength(checksum)}]};return {};};
 const args={api,version:'0.4.0',sha,bytes,checksum,upload:async()=>{calls.push(['upload']);}};
 await assert.rejects(deliverRelease({...args,version:'0.4.0-dev.1'}),/禁止预发布/);assert.equal(calls.length,0);
 await assert.rejects(deliverRelease({...args,checksum:'bad'}));assert.equal(calls.length,0);
 await assert.rejects(deliverRelease({...args,upload:async()=>{throw Error('upload failed');}}),/upload failed/);
 assert.ok(!calls.some(([,o])=>o?.method==='PATCH'),'failed upload must leave release unpublished');
 calls.length=0;await deliverRelease(args);
 assert.equal(calls[0][1].body.sha,sha);assert.equal(calls[1][1].body.draft,true);
 assert.equal(calls.at(-1)[1].method,'PATCH');assert.equal(calls.at(-1)[1].body.draft,false);
 assert.equal(calls.at(-1)[1].body.prerelease,false);assert.equal(calls.at(-1)[1].body.make_latest,'true');
 calls.length=0;await deliverRelease({...args,tagSha:sha,release:release()});assert.equal(calls.length,0,'published release is never re-uploaded');
});
test('Pages fingerprint ignores traversal order and changes with content or download version',async()=>{
 const html=await fs.readFile('docs/index.html','utf8');
 const a=['index.html',Buffer.from(renderReleaseLinks(html,release('0.3.0')))];
 const b=['style.css',Buffer.from('body{}')];
 assert.equal(pagesDigest([a,b]),pagesDigest([b,a]));
 assert.notEqual(pagesDigest([a,b]),pagesDigest([a,['style.css',Buffer.from('body{color:red}')]]));
 assert.notEqual(pagesDigest([a,b]),pagesDigest([['index.html',Buffer.from(renderReleaseLinks(html,release('0.4.0')))],b]));
});
