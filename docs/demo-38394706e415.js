(()=>{
// Original appearance model. Serializable factory: also runs inside the host page.
function createAppearance(initial = {}) {
  const schema = {
    compatibleTheme: {label:'适配主题', value:'dark', choices:{dark:'Dark',light:'Light',both:'Dark / Light（两者皆可）'}, group:'background'},
    dim: {label:'全局遮罩', min:0, max:.9, step:.01, value:.3, unit:'%', group:'surfaces'},
    sidebar: {label:'左侧栏透明度', transparency:true, min:0, max:1, step:.01, value:.12, unit:'%', group:'surfaces'},
    composer: {label:'输入框透明度', transparency:true, min:0, max:1, step:.01, value:.12, unit:'%', group:'surfaces'},
    info: {label:'信息面板透明度', transparency:true, min:0, max:1, step:.01, value:.12, unit:'%', group:'surfaces'},
    settings: {label:'设置页卡片透明度', transparency:true, min:0, max:1, step:.01, value:.45, unit:'%', group:'surfaces'},
    code: {label:'代码块透明度', transparency:true, min:0, max:1, step:.01, value:.65, unit:'%', group:'surfaces'},
    chat: {label:'聊天区透明度', transparency:true, min:0, max:1, step:.01, value:0, unit:'%', group:'surfaces'},
    bubble: {label:'用户消息透明度', transparency:true, min:0, max:1, step:.01, value:.12, unit:'%', group:'surfaces'},
    shadow: {label:'文字阴影', min:0, max:1, step:.01, value:1, unit:'%', group:'surfaces'},
    textMode: {label:'默认外观', value:'light', choices:{auto:'自动 · 跟随系统',light:'深色界面 · 浅色文字',dark:'浅色界面 · 深色文字'}, group:'background'},
    fit: {label:'背景显示', value:'contain', choices:{contain:'完整显示',cover:'填满窗口（裁切）'}, group:'background'},
    focusX: {label:'水平焦点', min:0, max:100, step:1, value:50, unit:'position', group:'background'},
    focusY: {label:'垂直焦点', min:0, max:100, step:1, value:50, unit:'position', group:'background'},
    brightness: {label:'背景亮度', min:.2, max:2, step:.01, value:1, unit:'%', group:'background'},
    contrast: {label:'背景对比度', min:.2, max:2, step:.01, value:1, unit:'%', group:'background'},
    saturation: {label:'背景饱和度', min:0, max:2, step:.01, value:1, unit:'%', group:'background'},
    blur: {label:'背景模糊', min:0, max:20, step:.5, value:0, unit:'px', group:'background'},
    speed: {label:'视频速度', min:.25, max:2, step:.05, value:1, unit:'×', group:'background'},
    safeArea: {label:'内容安全区', value:'none', choices:{none:'无',left:'左侧',right:'右侧'}, group:'reading'},
    safeStrength: {label:'安全区遮罩', min:0, max:1, step:.01, value:.4, unit:'%', group:'reading'},
    taskMode: {label:'任务页背景', value:'full', choices:{atmosphere:'氛围（弱化背景）',full:'完整',off:'关闭背景'}, group:'reading'},
    radius: {label:'面板圆角', min:0, max:32, step:1, value:20, unit:'px', group:'reading'},
    borderWidth: {label:'面板边线', min:0, max:3, step:.5, value:1, unit:'px', group:'reading'}
  };
  const colorLabels = {background:'背景',panel:'面板',secondaryPanel:'次级面板',accent:'强调色',secondaryAccent:'次级强调色',muted:'辅助色',highlight:'高亮',text:'正文',secondaryText:'次要文字',border:'分隔线'};
  const palettes = {
    light:{background:'#080e16',panel:'#030a13',secondaryPanel:'#131c28',accent:'#8edbff',secondaryAccent:'#9eb7e8',muted:'#bbccdb',highlight:'#ffffff',text:'#eef5fc',secondaryText:'#d7e3ee',border:'#d2e8ff2e'},
    dark:{background:'#edf3f8',panel:'#f6faff',secondaryPanel:'#edf3f8',accent:'#005c91',secondaryAccent:'#485c94',muted:'#44586a',highlight:'#07121c',text:'#17232e',secondaryText:'#304252',border:'#142d4138'}
  };
  let state={...Object.fromEntries(Object.entries(schema).map(([k,v])=>[k,v.value])),colors:{}};
  function normalize(patch){
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('设置必须是对象');
    const next={...state,colors:{...state.colors}};
    for(const [key,value] of Object.entries(patch)) {
      if(key==='colors'){
        if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('配色格式错误');
        const colors={};
        for(const [role,color] of Object.entries(value)){
          if(!Object.hasOwn(colorLabels,role)||typeof color!=='string'||!/^#[\da-f]{6}([\da-f]{2})?$/i.test(color))throw new Error('配色需使用 #RRGGBB 或 #RRGGBBAA');
          colors[role]=color.toLowerCase();
        }
        next.colors=colors;continue;
      }
      if(!Object.hasOwn(schema,key))throw new Error('未知设置项：'+key);
      const item=schema[key];
      if(item.choices ? !Object.hasOwn(item.choices,value) : typeof value!=='number'||!Number.isFinite(value)||value<item.min||value>item.max)throw new Error('设置值超出范围：'+key);
      next[key]=value;
    }
    return next;
  }
  const get=()=>({...state,colors:{...state.colors}});
  const set=patch=>{state=normalize(patch);return get();};
  const reset=()=>{state={...Object.fromEntries(Object.entries(schema).map(([k,v])=>[k,v.value])),colors:{}};return get();};
  set(initial);
  return {schema,colorLabels,get,set,reset,palette:darkSystem=>({...palettes[state.textMode==='auto'?(darkSystem?'light':'dark'):state.textMode],...state.colors})};
}


const $ = id => document.getElementById(id);
const demo=$('demo'), panel=$('skin-panel'), model=createAppearance();
const schema={...model.schema};delete schema.compatibleTheme;delete schema.settings;
const clone=v=>JSON.parse(JSON.stringify(v));
const defaults=mode=>createAppearance({textMode:mode==='dark'?'light':'dark',dim:.1,sidebar:.35,composer:.35,info:.45,code:.5,bubble:.35,radius:12}).get();
let mode='dark',profiles={dark:defaults('dark'),light:defaults('light')},past=[],future=[],timer,media=null,mediaUrl=null,paused=false;
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
 field.append(input);$('fields-'+item.group).append(field);
}
for(const [role,labelText] of Object.entries(model.colorLabels)){const row=document.createElement('div');row.className='color-field field-row';const label=document.createElement('label');label.htmlFor='color-'+role;label.textContent=labelText;const input=document.createElement('input');input.type='color';input.id='color-'+role;continuous(input,()=>({colors:{...model.get().colors,[role]:input.value}}));row.append(label,copyButton('colors.'+role,labelText),input);$('fields-colors').append(row);}
const rgba=(hex,alpha)=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return `rgba(${rgb.join(',')},${alpha})`;};
function render(){
 model.reset();model.set(profiles[mode]);const s=model.get(),p=model.palette(mode==='dark');
 demo.classList.toggle('light',mode==='light');demo.dataset.task=s.taskMode;
 for(const [key,value] of Object.entries(p))demo.style.setProperty('--p-'+key,value);
 demo.style.setProperty('--surface', [1,3,5].map(i=>parseInt(p.panel.slice(i,i+2),16)).join(','));demo.style.setProperty('--text',p.text);demo.style.setProperty('--secondary',p.secondaryText);
 for(const key of ['sidebar','composer','info','code','chat','bubble'])demo.style.setProperty('--fill-'+key,rgba(key==='bubble'?p.secondaryPanel:p.panel,s[key]));
 demo.style.setProperty('--shade',rgba(p.background,s.dim));demo.style.setProperty('--radius',s.radius+'px');demo.style.setProperty('--edge',s.borderWidth+'px');demo.style.setProperty('--shadow',`0 1px ${s.shadow*4}px ${rgba(mode==='dark'?'#000000':'#ffffff',s.shadow*.7)}`);
 demo.style.setProperty('--filter',`brightness(${s.brightness}) contrast(${s.contrast}) saturate(${s.saturation}) blur(${s.blur}px)`);
 demo.style.setProperty('--focus-x',s.focusX+'%');demo.style.setProperty('--focus-y',s.focusY+'%');demo.dataset.fit=s.fit;
 demo.style.setProperty('--safe',s.safeArea==='none'?'transparent':`linear-gradient(to ${s.safeArea==='left'?'right':'left'},${rgba(p.background,s.safeStrength)},transparent 70%)`);
 demo.style.setProperty('--duration-sun',16/s.speed+'s');demo.style.setProperty('--duration-water',9/s.speed+'s');if(media?.tagName==='VIDEO')media.playbackRate=s.speed;
 $('scheme').setAttribute('aria-checked',String(mode==='light'));$('copy-all').textContent='全部复制到 '+(other()==='dark'?'Dark':'Light');
 for(const [key,item] of Object.entries(schema)){const value=s[key];$('param-'+key).value=item.transparency?1-value:value;if(!item.choices)$('value-'+key).value=item.unit==='%'?Math.round((item.transparency?1-value:value)*100)+'%':value+(item.unit==='position'?'%':item.unit);}
 for(const role of Object.keys(model.colorLabels))$('color-'+role).value=p[role].slice(0,7);
 for(const button of panel.querySelectorAll('[data-copy]')){button.title=`将${button.dataset.label}从 ${mode} 复制到 ${other()}`;button.setAttribute('aria-label',button.title);}
 $('undo').disabled=!past.length;$('redo').disabled=!future.length;
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
 try{await new Promise((resolve,reject)=>{node.addEventListener(video?'loadeddata':'load',resolve,{once:true});node.addEventListener('error',reject,{once:true});node.src=url;});media?.remove();if(mediaUrl)URL.revokeObjectURL(mediaUrl);media=node;mediaUrl=url;demo.prepend(node);demo.classList.add('has-media');render();playback();notify('已载入本地背景');}catch{URL.revokeObjectURL(url);notify('素材无法读取，请换一个文件');}
});
const toggle=$('skin-toggle'),close=$('skin-close');function setPanel(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));(open?close:toggle).focus();}
toggle.addEventListener('click',()=>setPanel(panel.hidden));close.addEventListener('click',()=>setPanel(false));panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();setPanel(false);}});
render();playback();

})();
