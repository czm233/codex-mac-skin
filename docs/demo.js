import { renderWorkspace, attachWorkspaceInteractions } from './workspace.mjs';
import { createLibrarySession } from './library-session.mjs';
import { createSkinLibraryModel } from './library.mjs';
import { createAppearance } from './appearance.mjs';
const $ = id => document.getElementById(id);
const demo=$('demo'), panel=$('skin-panel'), model=createAppearance();
const schema={...model.schema};delete schema.compatibleTheme;delete schema.settings;
const clone=v=>JSON.parse(JSON.stringify(v));
const defaults=mode=>createAppearance({textMode:mode==='dark'?'light':'dark',dim:.1,sidebar:.35,composer:.35,info:.45,code:.5,bubble:.35,radius:12}).get();
let demoSession=null,libraryApplying=false,mediaAsset='0'.repeat(64);
const mediaCache=new Map(),libraryModel=createSkinLibraryModel(createAppearance);
let libraryState=libraryModel.empty(),sessionDisk=null;
let mode='dark',profiles={dark:defaults('dark'),light:defaults('light')},past=[],future=[],timer,media=null,mediaUrl=null,paused=false;
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
const other=()=>mode==='dark'?'light':'dark';
function notify(text){clearTimeout(timer);$('demo-status').textContent=text;timer=setTimeout(()=>{$('demo-status').textContent='';},3000);}
let continuousControl=null;
function record(){continuousControl=null;past.push(clone(profiles));if(past.length>60)past.shift();future=[];}
function edit(patch,control=null){
 const next=model.set(patch);
 if(JSON.stringify(next)===JSON.stringify(profiles[mode]))return;
 if(!control||continuousControl!==control){record();continuousControl=control;}
 profiles[mode]=next;render();
}
function continuous(input,patch){
 input.addEventListener('input',()=>edit(patch(),input));
 for(const event of ['change','blur','pointercancel','pointerdown'])input.addEventListener(event,()=>{continuousControl=null;});
}
function copy(key){record();const target=other();if(key==='all')profiles[target]=clone(profiles[mode]);else if(key.startsWith('colors.')){const role=key.slice(7);profiles[target].colors[role]=model.palette(mode==='dark')[role];}else profiles[target][key]=profiles[mode][key];render();notify(`已${key==='all'?'全部复制':'复制'}到 ${target==='dark'?'Dark':'Light'}`);}
const copyIcon='<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/></svg>';
function copyButton(key,label){const b=document.createElement('button');b.className='copy-param';b.dataset.copy=key;b.dataset.label=label;b.innerHTML=copyIcon;b.addEventListener('click',()=>copy(key));return b;}
const groups={surfaces:'透明度与文字',background:'背景与外观',reading:'阅读与面板',colors:'主题配色'};
for(const [key,title] of Object.entries(groups)){const d=document.createElement('details');d.className='demo-group';d.open=key==='surfaces';const summary=document.createElement('summary');summary.textContent=title;d.append(summary);const fields=document.createElement('div');fields.id='fields-'+key;d.append(fields);$('demo-fields').append(d);}
for(const [key,item] of Object.entries(schema)){
 const field=document.createElement('div');field.className='demo-field';
 const row=document.createElement('div');row.className='field-row';const label=document.createElement('label');label.htmlFor='param-'+key;label.textContent=item.label;row.append(label,copyButton(key,item.label));field.append(row);
 const input=document.createElement(item.choices?'select':'input');input.id='param-'+key;
 if(item.choices){for(const [value,text] of Object.entries(item.choices)){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}input.addEventListener('change',()=>edit({[key]:input.value}));}
 else{input.type='range';input.min=item.min;input.max=item.max;input.step=item.step;const output=document.createElement('output');output.id='value-'+key;output.htmlFor=input.id;row.append(output);continuous(input,()=>({[key]:item.transparency?1-Number(input.value):Number(input.value)}));}
 field.append(input);const hints={safeStrength:'先选择左侧或右侧安全区，才能调整遮罩。',speed:'默认风景调整动画速度；视频调整播放速度；图片不适用。',focusX:'画面有裁切或留白时，水平焦点才会产生位移。',focusY:'画面有裁切或留白时，垂直焦点才会产生位移。'};if(hints[key]){const hint=document.createElement('small');hint.className='param-hint';hint.textContent=hints[key];field.append(hint);} $('fields-'+item.group).append(field);
}
for(const [role,labelText] of Object.entries(model.colorLabels)){const row=document.createElement('div');row.className='color-field field-row';const label=document.createElement('label');label.htmlFor='color-'+role;label.textContent=labelText;const input=document.createElement('input');input.type='color';input.id='color-'+role;continuous(input,()=>({colors:{...model.get().colors,[role]:input.value}}));row.append(label,copyButton('colors.'+role,labelText),input);$('fields-colors').append(row);}
function render(){
 model.reset();model.set(profiles[mode]);const s=model.get(),p=model.palette(mode==='dark');
 renderWorkspace(demo,s,p,mode,media,mode==='dark');
 $('scheme').setAttribute('aria-checked',String(mode==='light'));$('copy-all').textContent='全部复制到 '+(other()==='dark'?'Dark':'Light');
 for(const [key,item] of Object.entries(schema)){const value=s[key];$('param-'+key).value=item.transparency?1-value:value;if(!item.choices)$('value-'+key).value=item.unit==='%'?Math.round((item.transparency?1-value:value)*100)+'%':value+(item.unit==='position'?'%':item.unit);}
 for(const role of Object.keys(model.colorLabels))$('color-'+role).value=p[role].slice(0,7);
 for(const button of panel.querySelectorAll('[data-copy]')){button.title=`将${button.dataset.label}从 ${mode} 复制到 ${other()}`;button.setAttribute('aria-label',button.title);}
 $('param-safeStrength').disabled=s.safeArea==='none';
 $('param-speed').disabled=media?.tagName==='IMG';
 $('undo').disabled=!past.length;$('redo').disabled=!future.length;
 if(demoSession&&!libraryApplying)demoSession.changed({asset:mediaAsset,profiles:clone(profiles)}).catch(error=>notify(error.message));
}
$('scheme').addEventListener('click',()=>{continuousControl=null;mode=other();render();notify('已切换到 '+(mode==='dark'?'Dark':'Light'));});
$('copy-all').addEventListener('click',()=>copy('all'));
$('undo').addEventListener('click',()=>{continuousControl=null;if(!past.length)return;future.push(clone(profiles));profiles=past.pop();render();notify('已撤销');});
$('redo').addEventListener('click',()=>{continuousControl=null;if(!future.length)return;past.push(clone(profiles));profiles=future.pop();render();notify('已重做');});
$('reset-demo').addEventListener('click',()=>{record();profiles[mode]=defaults(mode);render();notify('已重置当前方案');});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function playback(){const stop=paused||reduced.matches;demo.classList.toggle('paused',stop);if(media?.tagName==='VIDEO'){if(stop)media.pause();else media.play().catch(()=>notify('点击播放继续'));}$('motion').disabled=reduced.matches||media?.tagName==='IMG';$('motion').textContent=reduced.matches?'已减弱动态':media?.tagName==='IMG'?'图片背景':stop?'播放动态':'暂停动态';}
$('motion').addEventListener('click',()=>{paused=!paused;playback();});reduced.addEventListener('change',playback);
$('media-file').addEventListener('change',async event=>{
 const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>64*1024*1024){notify('请选择小于 64 MiB 的素材');return;}
 const video=file.type.startsWith('video/');if(!video&&!file.type.startsWith('image/')){notify('请选择图片或视频');return;}
 const url=URL.createObjectURL(file),node=document.createElement(video?'video':'img');node.className='local-media';node.setAttribute('aria-hidden','true');if(video){node.muted=true;node.loop=true;node.playsInline=true;}
 try{await new Promise((resolve,reject)=>{node.addEventListener(video?'loadeddata':'load',resolve,{once:true});node.addEventListener('error',reject,{once:true});node.src=url;});media?.remove();mediaAsset=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');mediaCache.set(mediaAsset,{node,url});media=node;mediaUrl=url;demo.prepend(node);demo.classList.add('has-media');render();playback();notify('已载入本地背景');}catch{URL.revokeObjectURL(url);notify('素材无法读取，请换一个文件');}
});
const toggle=$('skin-toggle'),close=$('skin-close');function setPanel(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)placePanel();(open?close:toggle).focus();}
toggle.addEventListener('click',()=>setPanel(panel.hidden));close.addEventListener('click',()=>setPanel(false));panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();setPanel(false);}});
systemTheme.addEventListener('change',render);
render();playback();

const resizePreview=new ResizeObserver(render);resizePreview.observe(demo);

// Position belongs to the preview, not to either appearance profile.
const dragHeader=$('panel-drag'),positionKey='cvs-demo-panel-position';
let panelPosition=null,drag=null;
try{const saved=JSON.parse(localStorage.getItem(positionKey));if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))panelPosition=saved;}catch{}
function savePanel(){try{if(panelPosition)localStorage.setItem(positionKey,JSON.stringify(panelPosition));else localStorage.removeItem(positionKey);}catch{}}
function placePanel(){
 if(panel.hidden||!panelPosition)return;
 const margin=12;
 panelPosition.x=Math.max(margin,Math.min(panelPosition.x,demo.clientWidth-panel.offsetWidth-margin));
 panelPosition.y=Math.max(margin,Math.min(panelPosition.y,demo.clientHeight-panel.offsetHeight-margin));
 Object.assign(panel.style,{left:panelPosition.x+'px',top:panelPosition.y+'px',right:'auto',bottom:'auto'});
}
dragHeader.title='拖动标题栏移动面板；双击恢复默认位置';
dragHeader.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.target.closest('button'))return;
 const box=panel.getBoundingClientRect(),parent=demo.getBoundingClientRect();
 panelPosition={x:box.left-parent.left-demo.clientLeft,y:box.top-parent.top-demo.clientTop};
 drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...panelPosition}};
 dragHeader.setPointerCapture(event.pointerId);panel.dataset.dragging='true';event.preventDefault();
});
dragHeader.addEventListener('pointermove',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 panelPosition={x:drag.start.x+event.clientX-drag.x,y:drag.start.y+event.clientY-drag.y};placePanel();
});
function stopDrag(){if(!drag)return;drag=null;delete panel.dataset.dragging;savePanel();}
for(const name of ['pointerup','pointercancel','lostpointercapture'])dragHeader.addEventListener(name,stopDrag);
dragHeader.addEventListener('dblclick',event=>{
 if(event.target.closest('button'))return;
 stopDrag();panelPosition=null;Object.assign(panel.style,{left:'',top:'',right:'',bottom:''});savePanel();
});
const resizePanel=new ResizeObserver(()=>placePanel());resizePanel.observe(demo);resizePanel.observe(panel);

attachWorkspaceInteractions();

// A memory-only demonstration of the same saved-skin/draft model as the App.
// No account, filesystem bridge or download is simulated as a successful action.
function renderLibrary(){
 const selected=$('demo-library').value;$('demo-library').replaceChildren();
 for(const skin of libraryState.skins){const option=document.createElement('option');option.value=skin.id;option.textContent=skin.name;$('demo-library').append(option);
  for(const draft of libraryState.drafts.filter(d=>d.skinId===skin.id)){const option=document.createElement('option');option.value='draft:'+draft.id;option.textContent=skin.name+' · 草稿';$('demo-library').append(option);}
 }
 if(libraryState.skins.some(s=>s.id===selected)||libraryState.drafts.some(d=>'draft:'+d.id===selected))$('demo-library').value=selected;
 else if(demoSession)$('demo-library').value=demoSession.status().skinId;
 const status=demoSession?.status();$('demo-save-state').textContent=status?(status.name+' · '+(status.dirty?'未保存草稿':'已保存到本次演示')):'正在准备';
 $('demo-save').disabled=$('demo-copy').disabled=!demoSession;
}
async function syncDemoLibrary(){
 libraryState=libraryModel.edit(libraryState,{type:'receive',...await demoSession.snapshot()});
 await demoSession.acknowledge(libraryState.receipts);renderLibrary();
}
globalThis.__demoLibraryReady=(async()=>{
 demoSession=await createLibrarySession({
  read:async()=>sessionDisk,write:async value=>{sessionDisk=clone(value);},backup:async()=>{},current:async()=>({asset:mediaAsset,profiles:clone(profiles)}),notify:renderLibrary,
  apply:async content=>{
   libraryApplying=true;
   try{profiles=clone(content.profiles);mediaAsset=content.asset;media?.remove();const cached=mediaCache.get(mediaAsset);media=cached?.node||null;mediaUrl=cached?.url||null;if(media)demo.prepend(media);demo.classList.toggle('has-media',!!media);past=[];future=[];render();playback();}finally{libraryApplying=false;}
  }
 });await syncDemoLibrary();
})().catch(error=>notify(error.message));
$('demo-save').addEventListener('click',async()=>{try{await demoSession.idle();await demoSession.save();await syncDemoLibrary();notify('已保存到本次演示');}catch(error){notify(error.message);}});
$('demo-copy').addEventListener('click',async()=>{try{await demoSession.idle();await demoSession.save($('demo-copy-name').value);await syncDemoLibrary();$('demo-library').value=demoSession.status().skinId;notify('已另存为独立皮肤');}catch(error){notify(error.message);}});
$('demo-apply').addEventListener('click',async()=>{
 try{await demoSession.idle();const selected=$('demo-library').value,draft=libraryState.drafts.find(d=>'draft:'+d.id===selected),saved=libraryState.skins.find(s=>s.id===(draft?.skinId||selected)),skin=draft&&saved?{...saved,revision:draft.baseRevision,draftId:draft.id,draft:{asset:draft.asset,profiles:draft.profiles}}:saved;if(!skin)throw Error('请先选择皮肤');await demoSession.activate(skin,$('demo-draft-choice').value);await demoSession.finalize();await syncDemoLibrary();notify('演示皮肤已切换');}catch(error){notify(error.message);}
});
