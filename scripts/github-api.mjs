export function githubClient(){
 const repository=process.env.GITHUB_REPOSITORY||'czm233/codex-mac-skin';
 if(repository!=='czm233/codex-mac-skin')throw Error('发布仅允许目标仓库');
 const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
 if(!token)throw Error('缺少 GH_TOKEN / GITHUB_TOKEN');
 return async function request(endpoint,{method='GET',body,optional=false}={}){
  const response=await fetch(`https://api.github.com/repos/${repository}${endpoint?'/'+endpoint:''}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  if(optional&&response.status===404)return null;
  if(!response.ok)throw Error(`GitHub ${method} ${endpoint}: HTTP ${response.status}`);
  return response.status===204?null:response.json();
 };
}
export async function resolveTag(api,tag){
 let ref=await api('git/ref/tags/'+encodeURIComponent(tag),{optional:true});if(!ref)return null;
 let object=ref.object;
 for(let i=0;object.type==='tag'&&i<5;i++)object=(await api('git/tags/'+object.sha)).object;
 if(object.type!=='commit')throw Error('Tag 未解析为提交');
 return object.sha;
}
