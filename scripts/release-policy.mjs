import {createHash} from 'node:crypto';
export function versionInfo(version){
 const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
 if(!match||match[4]?.split('.').some(x=>/^\d+$/.test(x)&&x.length>1&&x[0]==='0'))throw Error('版本号必须为 SemVer，不含 build metadata');
 return {version,tag:'v'+version,short:match.slice(1,4).join('.'),numbers:match.slice(1,4).map(Number),prerelease:!!match[4],asset:`Codex-Skin-${version}-macOS.dmg`};
}
export function planRelease({version,sha,tagSha,release}){
 const v=versionInfo(version);
 if(release&&!release.draft){
  if(!tagSha)throw Error('已发布 Release 缺少 tag');
  for(const name of [v.asset,v.asset+'.sha256'])if(!release.assets?.some(a=>a.name===name&&a.size>0))throw Error('已发布 Release 缺少安装包或校验文件；不会自动覆盖');
  return {...v,action:'skip'};
 }
 if(tagSha&&tagSha!==sha)throw Error('现有 tag 指向其他提交；请增加版本号');
 if(release&&!release.body?.includes(`<!-- codex-skin-cd:${sha} -->`))throw Error('已有非本流水线的草稿 Release；不会覆盖');
 return {...v,action:release?'resume':'create'};
}
export function verifyChecksum(bytes,checksum,filename){
 const hash=createHash('sha256').update(bytes).digest('hex');
 if(checksum.trim()!==`${hash}  ${filename}`)throw Error('DMG 校验文件不匹配');
 return hash;
}
export function renderReleaseLinks(html,release){
 if(!release||release.draft||release.prerelease)throw Error('官网只引用已发布的正式版');
 const v=versionInfo(release.tag_name.replace(/^v/,''));
 if(v.prerelease)throw Error('官网不能引用预发布版本');
 const asset=release.assets.find(a=>a.name===v.asset&&a.size>0);
 if(!asset)throw Error('正式版下载资源不完整');
 if(asset.browser_download_url!==`https://github.com/czm233/codex-mac-skin/releases/download/${v.tag}/${v.asset}`)throw Error('下载地址不属于本仓库');
 const replace=(key,value)=>{
  const expression=new RegExp(`<!--RELEASE_${key}-->[\\s\\S]*?<!--END_RELEASE_${key}-->`);
  if(!expression.test(html))throw Error('缺少发布文案区域：'+key);
  html=html.replace(expression,()=>`<!--RELEASE_${key}-->${value}<!--END_RELEASE_${key}-->`);
 };
 html=html.replace(/https:\/\/github\.com\/czm233\/codex-mac-skin\/releases\/download\/[^"\s]+\.dmg/g,()=>asset.browser_download_url);
 const library=v.numbers[0]>0||v.numbers[1]>=4;
 replace('VERSION',`${v.tag} · macOS 13+ · Apple Silicon & Intel`);
 replace('CAPTION',library?'个人皮肤库与 App 预览已包含在当前下载版中。':`面板拖动与个人皮肤库尚未包含在当前下载的 ${v.tag} 中。`);
 replace('LIBRARY_TITLE',library?'个人皮肤库':'开发中的个人皮肤库');
 replace('LIBRARY_STATUS',library?'当前版本':'第一期开发版');
 replace('LIBRARY_NOTE',library?'商店尚未开放。':`当前下载的 ${v.tag} 不包含这些能力，商店尚未开放。`);
 replace('START',library?'打开 App，选择皮肤预览后点击“应用”。首次连接可能需要确认重启 Codex。':'打开 App，点击“启动并应用皮肤”。首次连接可能需要确认重启 Codex。');
 replace('SIGNING',`${v.tag} 仅有 ad-hoc 签名，尚未经过 Apple 公证`);
 return html;
}

export async function deliverRelease({api,version,sha,tagSha,release,bytes,checksum,upload}){
 const v=planRelease({version,sha,tagSha,release});
 if(v.action==='skip')return v;
 verifyChecksum(bytes,checksum,v.asset);
 if(!tagSha)await api('git/refs',{method:'POST',body:{ref:'refs/tags/'+v.tag,sha}});
 let draft=release;
 if(!draft)draft=await api('releases',{method:'POST',body:{tag_name:v.tag,target_commitish:sha,name:`Codex Skin ${v.tag}`,draft:true,prerelease:v.prerelease,body:`<!-- codex-skin-cd:${sha} -->\n\nmacOS 13+ · Apple Silicon / Intel\n\n构建提交：${sha}\n\n仅 ad-hoc 签名，尚未经过 Apple 公证。安装包及 SHA-256 校验文件见附件。`}});
 await upload(v);
 const uploaded=await api('releases/'+draft.id);
 for(const [name,size] of [[v.asset,bytes.length],[v.asset+'.sha256',Buffer.byteLength(checksum)]])if(!uploaded.assets.some(a=>a.name===name&&a.size===size))throw Error('资源上传未完成，保留草稿供重试');
 await api('releases/'+draft.id,{method:'PATCH',body:{draft:false,prerelease:v.prerelease,make_latest:v.prerelease?'false':'legacy'}});
 return v;
}
export function pagesDigest(entries){
 const hash=createHash('sha256');
 for(const [name,bytes] of [...entries].sort(([a],[b])=>a<b?-1:a>b?1:0)){hash.update(name+'\0'+bytes.length+'\0');hash.update(bytes);}
 return hash.digest('hex');
}
