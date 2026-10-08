// Original, dependency-free settings UI. Shadow DOM contains all control styling.
export async function attachSettings(api, options) {
  const host=document.createElement('div');host.id='cvs-controls';
  host.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483646;pointer-events:auto;color-scheme:dark';
  const ui=host.attachShadow({mode:'open'});
  ui.innerHTML=`<style>
    :host{font:13px -apple-system,BlinkMacSystemFont,sans-serif;color:#eaf1f7;text-shadow:none;line-height:1.5}
    *{box-sizing:border-box}button,select,input{font:inherit}button,select{color:inherit;background:#263341;border:1px solid #485564;border-radius:8px;padding:7px 11px;cursor:pointer}button:hover{background:#344657}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #9edbdf;outline-offset:3px}button:disabled{opacity:.5;cursor:wait}
    #toggle{float:right;background:#192733;box-shadow:0 3px 16px #0005}#panel{width:326px;max-width:calc(100vw - 36px);max-height:calc(100dvh - 94px);overflow:auto;background:#18232e;border:1px solid #52606c;border-radius:14px;padding:18px;margin-bottom:10px;box-shadow:0 12px 50px #0006}
    [hidden]{display:none!important}header{display:flex;align-items:center;justify-content:space-between}h2{margin:0;font-size:16px;letter-spacing:.02em}#close{background:none;border:0;font-size:20px;padding:0 6px}p{margin:5px 0;color:#aebdca;font-size:12px}.group{padding:14px 0;border-bottom:1px solid #ffffff16}.row{display:flex;align-items:center;justify-content:space-between;gap:12px}.row+ .row{margin-top:10px}label{display:block}output{font-variant-numeric:tabular-nums;color:#bde5e8}input[type=range]{width:100%;accent-color:#a4d9de;margin:10px 0 0;cursor:pointer}select{max-width:170px}#filename{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:10px;color:#d3dde6}#notice{min-height:34px;margin-top:12px}footer{display:flex;justify-content:space-between;margin-top:12px}.eyebrow{font-size:10px;letter-spacing:.14em;color:#9cc9d0;margin:0 0 4px}
    </style>
    <section id="panel" aria-label="视频皮肤设置" hidden>
    <header><div><p class="eyebrow">VIDEO SKIN / 01</p><h2>让背景适合你</h2></div><button id="close" aria-label="关闭设置">×</button></header>
    <div class="group"><p id="filename"></p><div class="row"><button id="choose">更换视频</button><button id="play">暂停视频</button></div><input id="file" type="file" accept="video/mp4,video/webm,video/quicktime,.mov" hidden><p>本地视频 · 最大 64 MiB · 不上传</p></div>
    <div class="group"><div class="row"><label for="mode">文字颜色</label><select id="mode"><option value="light">浅色文字 · 配暗背景</option><option value="dark">深色文字 · 配亮背景</option></select></div><p>遮罩和面板底色会随文字模式切换。</p></div>
    <div class="group" id="sliders"></div>
    <div class="group"><div class="row"><label for="fit">视频显示</label><select id="fit"><option value="contain">完整显示</option><option value="cover">填满窗口（裁切）</option></select></div></div>
    <p id="notice" role="status" aria-live="polite"></p><footer><button id="reset">重置当前视频参数</button><button id="done">完成</button></footer>
    </section><button id="toggle" aria-expanded="false" aria-controls="panel">◉ 视频皮肤</button>`;
  document.body.append(host);
  const el=id=>ui.getElementById(id);
  const listeners=new AbortController();const on=(node,event,fn)=>node.addEventListener(event,fn,{signal:listeners.signal});
  let mediaId=options.id, name=options.name||'当前背景', busy=false, dead=false, db=null, queue=Promise.resolve();
  let remembered=true;
  const defaults={dim:.3,sidebar:.12,composer:.12,shadow:1,textMode:'light',fit:'contain'};
  const settings=()=>Object.fromEntries(Object.keys(defaults).map(k=>[k,api.status()[k]]));
  const notice=text=>{el('notice').textContent=text;};
  const applySettings=value=>{
    const v={...defaults,...value};
    api.setDim(Math.min(.9,Math.max(0,Number(v.dim)||0)));
    for(const key of ['sidebar','composer','shadow'])api.setPanel(key,Math.min(1,Math.max(0,Number(v[key])||0)));
    api.setTextMode(v.textMode==='dark'?'dark':'light');api.setFit(v.fit==='cover'?'cover':'contain');
  };
  const restoreSettings=()=>{try{applySettings(JSON.parse(localStorage.getItem('cvs-settings:'+mediaId)||'null')||defaults);}catch{applySettings(defaults);remembered=false;}};
  const save=()=>{try{localStorage.setItem('cvs-settings:'+mediaId,JSON.stringify(settings()));notice(remembered?'已保存到本机，下次使用这段视频时恢复。':'参数已保存；视频未保存，下次需重新选择。');}catch{notice('当前调整已生效，但本机存储不可用，未保存。');}};
  for(const [key,label,max] of [['dim','全局遮罩',90],['sidebar','左侧栏底色',100],['composer','输入框底色',100],['shadow','文字阴影',100]]) {
    const row=document.createElement('div');row.className='row';row.style.display='block';
    row.innerHTML=`<div class="row"><label for="${key}">${label}</label><output id="${key}-value"></output></div><input id="${key}" type="range" min="0" max="${max}" step="1">`;
    el('sliders').append(row);
    on(el(key),'input',()=>{const value=Number(el(key).value)/100;if(key==='dim')api.setDim(value);else api.setPanel(key,value);render();save();});
  }
  function render(){const s=api.status();el('filename').textContent=name;el('filename').title=name;el('mode').value=s.textMode;el('fit').value=s.fit;for(const key of ['dim','sidebar','composer','shadow']){el(key).value=Math.round(s[key]*100);el(key+'-value').textContent=Math.round(s[key]*100)+'%';}el('play').textContent=s.manualPause?'继续播放':'暂停视频';}
  const show=value=>{el('panel').hidden=!value;el('toggle').setAttribute('aria-expanded',String(value));if(value){render();el('close').focus();}else el('toggle').focus();};
  on(el('toggle'),'click',()=>show(el('panel').hidden));for(const id of ['close','done'])on(el(id),'click',()=>show(false));
  on(host,'keydown',event=>{if(event.key==='Escape'&&!el('panel').hidden){event.stopPropagation();show(false);}});
  on(el('mode'),'change',()=>{api.setTextMode(el('mode').value);render();save();});
  on(el('fit'),'change',()=>{api.setFit(el('fit').value);render();save();});
  on(el('play'),'click',()=>{api.status().manualPause?api.resume():api.pause();render();if(api.status().reducedMotion)notice('系统启用了“减弱动态效果”，视频保持暂停。');});
  on(el('reset'),'click',()=>{applySettings(defaults);render();save();});
  on(el('choose'),'click',()=>el('file').click());
  const transaction=(mode,action)=>new Promise((resolve,reject)=>{const tx=db.transaction('media',mode);const request=action(tx.objectStore('media'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage aborted'));});
  try {db=await new Promise((resolve,reject)=>{const request=indexedDB.open('codex-video-skin-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('media');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Storage blocked'));});}catch{remembered=false;}
  async function load(file,persist=true){
    if(busy)throw new Error('正在载入视频，请稍候。');
    if(!file.size||file.size>64*1024*1024)throw new Error('请选择小于 64 MiB 的视频；大文件请先转为 1080p H.264 MP4。');
    busy=true;el('choose').disabled=true;notice('正在检查并载入视频…');
    const probe=document.createElement('video'),probeURL=URL.createObjectURL(file);probe.muted=true;probe.preload='auto';
    try {
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('视频解码超时，请使用 H.264 MP4。')),12000);const finish=error=>{clearTimeout(timer);probe.onloadeddata=probe.onerror=null;error?reject(error):resolve();};probe.onloadeddata=()=>finish();probe.onerror=()=>finish(new Error('这个视频编码无法播放，请使用 H.264 MP4 或 WebM。'));probe.src=probeURL;probe.load();});
      const bytes=new Uint8Array(await file.arrayBuffer());
      const digest=await crypto.subtle.digest('SHA-256',bytes);const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
      if(dead)return;
      api.begin(bytes.length);
      for(let offset=0;offset<bytes.length;offset+=32768)api.append(btoa(String.fromCharCode(...bytes.subarray(offset,offset+32768))));
      await api.commit();mediaId=id;name=file.name||'已保存的视频';restoreSettings();render();
      remembered=!!db;
      if(persist&&db) {try{await transaction('readwrite',store=>store.put({blob:file,name,id},'active'));}catch{remembered=false;}}
      if(!dead)save();
    } finally {probe.removeAttribute('src');probe.load();URL.revokeObjectURL(probeURL);busy=false;el('choose').disabled=false;}
  }
  on(el('file'),'change',()=>{const file=el('file').files[0];el('file').value='';if(file)queue=load(file).catch(error=>notice(error.message));});
  const originalDestroy=api.destroy;
  api.destroy=()=>{dead=true;listeners.abort();host.remove();db?.close();originalDestroy();};
  api.settingsPanel={show:()=>show(true),load,whenIdle:()=>queue};
  restoreSettings();render();notice(remembered?'调整即时生效，参数按视频自动保存。':'调整即时生效；本机视频存储不可用。');
  if(db){try{
    const saved=options.preferSaved?await transaction('readonly',store=>store.get('active')):null;
    if(saved&&!dead)await load(new File([saved.blob],saved.name,{type:saved.blob.type}),false);
    else {const blob=api.getMediaBlob();await transaction('readwrite',store=>store.put({blob,name,id:mediaId},'active'));}
  }catch{remembered=false;notice('视频存储或恢复失败；当前背景仍可使用，下次可能需要重新选择。');}}
  return {panel:true,videoRestored:mediaId!==options.id};
}
