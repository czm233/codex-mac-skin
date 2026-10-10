// Original settings UI. All controls live in an isolated Shadow DOM.
export async function attachSettings(api, options) {
  const schema={...api.getSchema()};delete schema.compatibleTheme;delete schema.settings;const labels=api.getColorLabels(),settings=()=>api.getSettings();
  // Remove abandoned hosts left by an interrupted or failed older installation.
  document.querySelectorAll('#cvs-controls').forEach(host=>host.remove());
  const host=document.createElement('div');host.id='cvs-controls';
  host.style.cssText='position:fixed;right:18px;bottom:18px;z-index:20;pointer-events:none;color-scheme:dark';
  const ui=host.attachShadow({mode:'open'});
  ui.innerHTML=`<style>
    :host{font:13px -apple-system,BlinkMacSystemFont,sans-serif;color:#eaf1f7;text-shadow:none;line-height:1.5}
    *{box-sizing:border-box}button,select,input,textarea{font:inherit}button,select{color:inherit;background:#263341;border:1px solid #485564;border-radius:8px;padding:7px 10px;cursor:pointer}button:hover{background:#344657}button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible,textarea:focus-visible{outline:2px solid #9edbdf;outline-offset:2px}button:disabled{opacity:.4;cursor:default}
    #panel,#toggle{pointer-events:auto}#toggle{float:right;background:#192733;box-shadow:0 3px 16px #0005}#panel{position:fixed;right:18px;bottom:58px;width:356px;max-width:calc(100vw - 36px);max-height:calc(100dvh - 94px);overflow:auto;background:#18232e;border:1px solid #52606c;border-radius:14px;margin-bottom:10px;box-shadow:0 12px 50px #0006;scrollbar-width:thin}
    #panel>header{cursor:grab;user-select:none;touch-action:none}#panel>header[data-dragging]{cursor:grabbing}
    [hidden]{display:none!important}header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;background:#18232e;padding:16px 18px;border-bottom:1px solid #ffffff16}h2{margin:0;font-size:16px;letter-spacing:.02em}#close{background:none;border:0;font-size:20px;padding:0 6px}p{margin:5px 0;color:#aebdca;font-size:12px}.group{padding:14px 18px;border-bottom:1px solid #ffffff16}.row{display:flex;align-items:center;justify-content:space-between;gap:12px}.row+.row{margin-top:10px}.field+.field{margin-top:12px}label{display:block}output{font-variant-numeric:tabular-nums;color:#bde5e8}input[type=range]{width:100%;accent-color:#a4d9de;margin:8px 0 0;cursor:pointer}select{max-width:190px}#filename{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:10px;color:#d3dde6}#notice{min-height:36px;margin:0;padding:10px 18px}footer{position:sticky;bottom:0;z-index:2;display:flex;justify-content:space-between;gap:8px;padding:12px 18px;background:#18232e;border-top:1px solid #ffffff16}.eyebrow{font-size:10px;letter-spacing:.14em;color:#9cc9d0;margin:0 0 4px}
    details{border-bottom:1px solid #ffffff16;padding:0 18px}summary{padding:14px 0;cursor:pointer;font-weight:600}details .fields{padding:0 0 16px}summary::marker{color:#9cc9d0}.color-row{display:grid;grid-template-columns:1fr 30px 108px;gap:8px;align-items:center;margin:10px 0}.color-row input[type=color]{width:30px;height:30px;padding:1px;border:1px solid #52606c;background:transparent;border-radius:6px}.color-row input[type=text]{min-width:0;width:108px;background:#101b24;color:#d8e5ee;border:1px solid #52606c;border-radius:5px;padding:5px;font:12px ui-monospace,monospace}textarea{width:100%;min-height:150px;background:#101b24;color:#d8e5ee;border:1px solid #52606c;border-radius:6px;font:11px ui-monospace,monospace;padding:8px;resize:vertical}.actions{display:flex;flex-wrap:wrap;gap:8px}.subtle{font-size:11px;color:#aebdca}#contrast{font-variant-numeric:tabular-nums}
    .sync-item{font-size:11px;padding:2px 5px;margin:0;flex-shrink:0}.field-title,.header-title,.scheme-switch{display:flex;align-items:center;gap:8px}.field-title{gap:6px;min-width:0}.field-title label{white-space:nowrap}.field.row{flex-wrap:wrap}.color-row{grid-template-columns:minmax(0,1fr) 30px 100px}.color-row input[type=text]{width:100px}#help-toggle{border-radius:50%;width:24px;height:24px;padding:0}#help{pointer-events:auto;position:fixed;inset:0;margin:auto;width:460px;max-width:calc(100vw - 40px);max-height:calc(100dvh - 48px);overflow:auto;padding:20px 24px;border:1px solid #52606c;border-radius:14px;background:#18232e;color:inherit;box-shadow:0 18px 70px #0006}#help::backdrop{background:#0008;pointer-events:auto}#help .row{margin-bottom:18px}#help-close{font-size:20px;padding:0 7px}#help p{font-size:13px}#help #notice{padding:12px 0 0}#help p+p{margin-top:9px}#variant{width:38px;height:22px;padding:2px;border-radius:20px;position:relative;background:#435568}#variant::after{content:"";display:block;width:16px;height:16px;border-radius:50%;background:#fff;transform:translateX(0)}#variant[aria-checked="true"]::after{transform:translateX(14px)}#variant[aria-checked="true"]{background:#457fa5}#filename{margin-top:12px}#notice:empty{display:none}
    #copy-tooltip{position:fixed;z-index:31;pointer-events:none;max-width:calc(100vw - 24px);padding:7px 10px;border:1px solid #52606c;border-radius:7px;background:#18232e;color:inherit;box-shadow:0 4px 18px #0004;font-size:12px}
    #feedback{flex:1;min-width:0;margin:0 10px;pointer-events:none;display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:11px;white-space:nowrap;color:inherit}#feedback[hidden]{display:flex!important;visibility:hidden}#feedback-icon{color:#6cdbad;font-weight:700}:host([data-scheme="light"]) #feedback-icon{color:#187a4a}#feedback-text{overflow:hidden;text-overflow:ellipsis}header>.header-title,header>#close{flex-shrink:0}
    :host([data-scheme="light"]){color:#17232e}
    :host([data-scheme="light"]) :is(#panel,header,footer,#help,#copy-tooltip){background:#f6f8fa;border-color:#bdc8d2}
    :host([data-scheme="light"]) :is(button,select,#toggle){background:#e6edf3;color:#17232e;border-color:#b6c3cf}
    :host([data-scheme="light"]) button:hover{background:#d5e2ec}
    :host([data-scheme="light"]) :is(p,.subtle,.eyebrow,output,#filename){color:#40566a}
    :host([data-scheme="light"]) :is(textarea,input[type=text]){background:white;color:#17232e;border-color:#b6c3cf}
    </style>
    <section id="panel" aria-label="皮肤设置" hidden>
      <header><div class="header-title"><h2>皮肤设置</h2><button id="help-toggle" aria-label="查看皮肤设置说明" aria-haspopup="dialog" aria-controls="help">?</button></div><div id="feedback" hidden><span id="feedback-icon" aria-hidden="true">✓</span><span id="feedback-text" role="status" aria-live="polite" aria-atomic="true"></span></div><button id="close" aria-label="关闭设置">×</button></header>
      <dialog id="help" aria-labelledby="help-title"><div class="row"><h2 id="help-title">皮肤设置说明</h2><button id="help-close" aria-label="关闭说明" autofocus>×</button></div><p>切换 Dark / Light 会同步切换 Codex 的 Theme，两套参数独立保存，共用背景文件。</p><p>标题旁的复制按钮将该项复制到另一套；全部同步会覆盖另一套所有参数，均可撤销或重做。</p><p>透明度 0% 为实底，100% 为完全透明；文字不会随之变淡。</p><p>支持本地视频或图片，最大 64 MiB。参数按背景自动保存，导出配置不包含背景文件。</p><p>焦点调整背景位置；安全区增加渐变遮罩；任务页模式仅影响聊天页面。</p><p>颜色支持 6 位或 8 位 HEX，自定义颜色优先。实色对比度不代表视频上的实际对比度。</p><p id="contrast"></p><p id="notice" role="status" aria-live="polite"></p></dialog>
      <div class="group"><div class="row"><div class="scheme-switch"><span>Dark</span><button id="variant" type="button" role="switch" aria-label="Light 方案" aria-checked="false"></button><span>Light</span></div><button id="sync-all">全部同步到 Light</button></div><p id="filename"></p><div class="row"><button id="choose">更换背景</button><button id="play">暂停视频</button></div><input id="file" type="file" accept="video/mp4,video/webm,video/quicktime,image/png,image/jpeg,image/webp,.mov" hidden></div>
      <details id="section-surfaces" open><summary>透明度与文字</summary><div class="fields" id="surfaces"></div></details>
      <details id="section-background"><summary>背景与外观</summary><div class="fields" id="background"></div></details>
      <details id="section-reading"><summary>阅读与面板</summary><div class="fields" id="reading"></div></details>
      <details id="section-colors"><summary>主题配色 · 10 项</summary><div class="fields" id="colors"></div><button id="palette-reset">恢复当前外观配色</button></details>
      <details id="section-config"><summary>配置与分享</summary><div class="fields"><div class="actions"><button id="import">导入配置</button><button id="export">导出配置</button><button id="css-export">导出样式</button></div><input id="config-file" type="file" accept=".json,application/json" hidden><label for="css-preview">生成的 CSS（只读）</label><textarea id="css-preview" readonly spellcheck="false"></textarea></div></details>
      <footer><div class="actions"><button id="undo" aria-label="撤销调整">撤销</button><button id="redo" aria-label="重做调整">重做</button></div><button id="reset">重置参数</button></footer>
    </section><div id="copy-tooltip" role="tooltip" hidden></div><button id="toggle" aria-expanded="false" aria-controls="panel">皮肤设置</button>`;
  document.body.append(host);
  const el=id=>ui.getElementById(id),listeners=new AbortController();
  const on=(node,event,fn)=>node.addEventListener(event,fn,{signal:listeners.signal});
  const system=matchMedia('(prefers-color-scheme: dark)');on(system,'change',()=>render());on(window,'cvs-theme-change',()=>followNative());
  let mediaId=options.id,name=options.name||'当前背景',busy=false,dead=false,db=null,queue=Promise.resolve(),remembered=true;
  let past=[],future=[],profiles=null,editing='dark',switching=false;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const other=()=>editing==='dark'?'light':'dark';
  const snapshot=()=>{profiles[editing]=settings();return clone(profiles);};
  const seed=flat=>{const cleaned={...flat,compatibleTheme:'both'};return {dark:clone(cleaned),light:{...clone(cleaned),textMode:'dark'}};};
  const applyProfile=()=>{api.resetSettings();api.setSettings(profiles[editing]);};
  function followNative(){
    const mode=api.status().actualTheme;
    if(!profiles||!['dark','light'].includes(mode)||mode===editing)return;
    profiles[editing]=settings();editing=mode;applyProfile();render();save();
  }
  let feedbackTimer;
  const hideFeedback=()=>{clearTimeout(feedbackTimer);el('feedback').hidden=true;};
  const showMessage=message=>{hideFeedback();el('feedback-text').textContent=message;el('feedback').hidden=false;feedbackTimer=setTimeout(hideFeedback,3000);};
  const record=()=>{hideFeedback();past.push(snapshot());if(past.length>60)past.shift();future=[];};
  function syncToOther(key){
    record();const target=other();
    if(key==='all')profiles[target]=clone(settings());
    else if(key.startsWith('colors.')){const role=key.slice(7);profiles[target].colors={...profiles[target].colors,[role]:api.getPalette()[role]};}
    else profiles[target][key]=settings()[key];
    render();save();const message=`已${key==='all'?'全部复制':'复制'}到 ${target==='dark'?'Dark':'Light'}`;notice(message+'；可撤销。');
    showMessage(message);
  }
  const notice=text=>{el('notice').textContent=text;};
  const save=()=>{try{localStorage.setItem('cvs-settings:'+mediaId,JSON.stringify({version:2,profiles:snapshot()}));notice(remembered?'已自动保存到本机。':'参数已保存；背景文件未保存，下次需重新选择。');}catch{notice('当前调整已生效，但本机存储不可用，未保存。');}};
  const restoreSettings=()=>{
    api.resetSettings();
    editing=api.status().actualTheme==='light'?'light':'dark';
    try{
      const saved=JSON.parse(localStorage.getItem('cvs-settings:'+mediaId)||'null');
      profiles=saved?.version===2?validateProfiles(saved.profiles):seed(saved||settings());
      applyProfile();
    }catch{profiles=seed(settings());applyProfile();notice('旧配置无法读取，已使用默认参数。');}
    past=[];future=[];
  };
  function validateProfiles(value){
    if(!value||!value.dark||!value.light)throw new Error('缺少 Dark / Light 配置');
    const before=settings();
    try{const result={};for(const mode of ['dark','light']){api.resetSettings();api.setSettings(value[mode]);result[mode]=settings();}return result;}
    finally{api.resetSettings();api.setSettings(before);}
  }
  function change(patch){record();api.setSettings(patch);profiles[editing]=settings();render();save();}

  const uiId=key=>key==='textMode'?'mode':key;
  const scale=item=>item.unit==='%'?100:1;
  // Storage keeps alpha for compatibility; UI expresses transparency (1 - alpha).
  const displayValue=(item,value)=>(item.transparency?1-value:value)*scale(item);
  for(const [key,item] of Object.entries(schema)){
    const id=uiId(key),field=document.createElement('div');field.className='field';
    if(item.choices){
      field.className+=' row';const label=document.createElement('label');label.htmlFor=id;label.textContent=item.label;
      const select=document.createElement('select');select.id=id;
      for(const [value,name] of Object.entries(item.choices)){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}
      field.append(label,select);on(select,'change',()=>change({[key]:select.value}));
    }else{
      const mul=scale(item);field.innerHTML=`<div class="row"><label for="${id}">${item.label}</label><output id="${id}-value" for="${id}"></output></div><input id="${id}" type="range" min="${item.min*mul}" max="${item.max*mul}" step="${item.step*mul}">`;
      on(field.querySelector('input'),'input',event=>change({[key]:item.transparency?1-Number(event.target.value)/mul:Number(event.target.value)/mul}));
    }
    const sync=document.createElement('button');sync.type='button';sync.className='sync-item';sync.dataset.sync=key;sync.setAttribute('aria-label',item.label+'同步到另一方案');on(sync,'click',()=>syncToOther(key));const label=field.querySelector('label'),title=document.createElement('div');title.className='field-title';label.before(title);title.append(label,sync);
    el(item.group).append(field);
  }
  for(const [role,label] of Object.entries(labels)){
    const row=document.createElement('div');row.className='color-row';
    row.innerHTML=`<label for="color-${role}">${label}</label><input id="color-${role}" type="color" aria-label="${label}颜色"><input id="hex-${role}" type="text" aria-label="${label} HEX" maxlength="9" spellcheck="false">`;
    const sync=document.createElement('button');sync.type='button';sync.className='sync-item';sync.dataset.sync='colors.'+role;on(sync,'click',()=>syncToOther('colors.'+role));const labelElement=row.querySelector('label'),title=document.createElement('div');title.className='field-title';labelElement.before(title);title.append(labelElement,sync);
    el('colors').append(row);
    on(el('color-'+role),'input',event=>change({colors:{...settings().colors,[role]:event.target.value}}));
    on(el('hex-'+role),'change',event=>{try{change({colors:{...settings().colors,[role]:event.target.value.trim()}});event.target.removeAttribute('aria-invalid');}catch(error){event.target.setAttribute('aria-invalid','true');notice(error.message);}});
  }
  let tooltipTimer,tooltipButton;
  const hideTooltip=()=>{clearTimeout(tooltipTimer);tooltipButton?.removeAttribute('aria-describedby');tooltipButton=null;el('copy-tooltip').hidden=true;};
  const showTooltip=button=>{
    hideTooltip();tooltipButton=button;
    tooltipTimer=setTimeout(()=>{
      if(!button.isConnected||el('panel').hidden||el('help').open)return;
      const tip=el('copy-tooltip'),r=button.getBoundingClientRect();
      tip.textContent=button.dataset.tooltip;tip.hidden=false;
      const t=tip.getBoundingClientRect();
      tip.style.left=Math.max(12,Math.min(r.left,innerWidth-t.width-12))+'px';
      tip.style.top=Math.max(12,r.top-t.height-8>=12?r.top-t.height-8:Math.min(r.bottom+8,innerHeight-t.height-12))+'px';
      button.setAttribute('aria-describedby','copy-tooltip');
    },150);
  };
  for(const button of ui.querySelectorAll('[data-sync]')){
    on(button,'pointerenter',()=>showTooltip(button));on(button,'focus',()=>showTooltip(button));
    for(const event of ['pointerleave','blur','click'])on(button,event,hideTooltip);
  }
  on(el('panel'),'scroll',hideTooltip);on(window,'resize',hideTooltip);
  on(el('help-toggle'),'click',hideTooltip);
  const contrast=(a,b)=>{const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=lum(a),y=lum(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2);};
  function render(){
    hideTooltip();
    const s=settings(),p=api.getPalette(),status=api.status();
    host.dataset.scheme=editing;host.style.colorScheme=editing;
    el('variant').setAttribute('aria-checked',String(editing==='light'));el('variant').disabled=switching;
    el('sync-all').textContent=`全部同步到 ${other()==='dark'?'Dark':'Light'}`;
    for(const button of ui.querySelectorAll('[data-sync]')){button.innerHTML='<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true" style="display:block;margin:2px 0"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/></svg>';const label=button.closest('.field-title').querySelector('label').textContent;button.dataset.tooltip=`将${label}从 ${editing==='dark'?'Dark':'Light'} 复制到 ${other()==='dark'?'Dark':'Light'} 方案`;button.setAttribute('aria-label',button.dataset.tooltip);}
    el('toggle').textContent='皮肤设置';el('filename').textContent=name;el('filename').title=name;
    for(const [key,item] of Object.entries(schema)){
      const id=uiId(key);el(id).value=item.choices?s[key]:displayValue(item,s[key]);
      if(!item.choices)el(id+'-value').textContent=Number((displayValue(item,s[key])).toFixed(2))+(item.unit==='position'?'%':item.unit);
    }
    for(const role of Object.keys(labels)){el('color-'+role).value=p[role].slice(0,7);el('hex-'+role).value=p[role];}
    el('contrast').textContent='正文 / 面板实色对比度 '+contrast(p.text,p.panel)+':1';
    el('play').disabled=status.mediaKind==='image';el('play').textContent=status.mediaKind==='image'?'图片背景':status.manualPause?'继续播放':'暂停视频';
    el('speed').disabled=status.mediaKind==='image';el('undo').disabled=!past.length;el('redo').disabled=!future.length;
    if(el('section-config').open)el('css-preview').value=api.getCSS();
  }
  const dragHeader=el('panel').querySelector('header');
  dragHeader.title='拖动标题栏移动面板；双击恢复默认位置';
  let panelPosition=null,drag=null;
  try{const saved=JSON.parse(localStorage.getItem('cvs-panel-position'));if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))panelPosition=saved;}catch{}
  const placePanel=()=>{
    if(!panelPosition||el('panel').hidden)return;
    const r=el('panel').getBoundingClientRect(),margin=12;
    panelPosition.x=Math.max(margin,Math.min(panelPosition.x,innerWidth-r.width-margin));
    panelPosition.y=Math.max(margin,Math.min(panelPosition.y,innerHeight-r.height-margin));
    Object.assign(el('panel').style,{left:panelPosition.x+'px',top:panelPosition.y+'px',right:'auto',bottom:'auto'});
  };
  const savePosition=()=>{try{if(panelPosition)localStorage.setItem('cvs-panel-position',JSON.stringify(panelPosition));else localStorage.removeItem('cvs-panel-position');}catch{}};
  on(dragHeader,'pointerdown',event=>{
    if(event.button!==0||event.target.closest('button'))return;
    hideTooltip();const r=el('panel').getBoundingClientRect();
    drag={id:event.pointerId,x:event.clientX-r.left,y:event.clientY-r.top};
    dragHeader.setPointerCapture(event.pointerId);dragHeader.setAttribute('data-dragging','');event.preventDefault();
  });
  on(dragHeader,'pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;panelPosition={x:event.clientX-drag.x,y:event.clientY-drag.y};placePanel();});
  const finishDrag=()=>{drag=null;dragHeader.removeAttribute('data-dragging');savePosition();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])on(dragHeader,event,finishDrag);
  on(dragHeader,'dblclick',event=>{if(event.target.closest('button'))return;panelPosition=null;for(const key of ['left','top','right','bottom'])el('panel').style.removeProperty(key);savePosition();});
  on(window,'resize',placePanel);
  const panelResize=new ResizeObserver(placePanel);panelResize.observe(el('panel'));
  const show=value=>{hideTooltip();el('panel').hidden=!value;el('toggle').setAttribute('aria-expanded',String(value));if(value){render();placePanel();el('close').focus();}else el('toggle').focus();};
  on(el('toggle'),'click',()=>show(el('panel').hidden));on(el('close'),'click',()=>show(false));
  on(host,'keydown',event=>{if(event.key==='Escape'&&!el('copy-tooltip').hidden){hideTooltip();event.stopPropagation();return;}if(event.key==='Escape'&&!el('help').open&&!el('panel').hidden){event.stopPropagation();show(false);}});
  on(el('play'),'click',()=>{api.status().manualPause?api.resume():api.pause();render();if(api.status().reducedMotion)notice('系统启用了“减弱动态效果”，视频保持暂停。');});
  on(el('palette-reset'),'click',()=>change({colors:{}}));
  on(el('reset'),'click',()=>{record();api.resetSettings();api.setSettings({textMode:editing==='dark'?'light':'dark'});profiles[editing]=settings();render();save();});
  on(el('undo'),'click',()=>{hideFeedback();if(!past.length)return;future.push(snapshot());profiles=past.pop();applyProfile();render();save();});
  on(el('redo'),'click',()=>{hideFeedback();if(!future.length)return;past.push(snapshot());profiles=future.pop();applyProfile();render();save();});
  on(el('choose'),'click',()=>el('file').click());
  on(el('section-config'),'toggle',()=>{if(el('section-config').open)el('css-preview').value=api.getCSS();});
  const exportConfig=()=>JSON.stringify({format:'codex-video-skin',version:2,profiles:snapshot()},null,2);
  const importConfig=text=>{
    if(typeof text!=='string'||text.length>65536)throw new Error('配置文件须小于 64 KiB');
    const data=JSON.parse(text);
    if(data?.format!=='codex-video-skin'||![1,2].includes(data.version))throw new Error('不是支持的皮肤参数文件');
    const next=validateProfiles(data.version===2?data.profiles:seed(data.settings));record();profiles=next;applyProfile();render();save();return settings();
  };
  on(el('help-toggle'),'click',()=>el('help').showModal());
  on(el('help-close'),'click',()=>el('help').close());
  on(el('help'),'close',()=>{if(!el('panel').hidden)el('help-toggle').focus();});
  on(el('help'),'click',event=>{if(event.target!==el('help'))return;const r=el('help').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)el('help').close();});
  on(el('sync-all'),'click',()=>syncToOther('all'));
  on(el('variant'),'click',async()=>{
    const target=other();switching=true;render();
    try{await api.switchNativeTheme(target);followNative();const message=`已切换到 ${target==='dark'?'Dark':'Light'}`;notice(message);showMessage(message);}
    catch(error){notice(error.message);if(!el('help').open)el('help').showModal();}
    finally{switching=false;render();}
  });
  const downloads=new Set();
  const download=(text,filename,type)=>{const url=URL.createObjectURL(new Blob([text],{type}));downloads.add(url);const a=document.createElement('a');a.href=url;a.download=filename;ui.append(a);a.click();a.remove();setTimeout(()=>{URL.revokeObjectURL(url);downloads.delete(url);},1000);};
  on(el('export'),'click',()=>download(exportConfig(),'skin-settings.json','application/json'));
  on(el('css-export'),'click',()=>download(api.getCSS(),'skin-preview.css','text/css'));
  on(el('import'),'click',()=>el('config-file').click());
  on(el('config-file'),'change',()=>{const file=el('config-file').files[0];el('config-file').value='';if(file)queue=(async()=>{if(file.size>65536)throw new Error('配置文件须小于 64 KiB');importConfig(await file.text());})().catch(error=>notice(error.message));});
  const transaction=(mode,action)=>new Promise((resolve,reject)=>{const tx=db.transaction('media',mode),request=action(tx.objectStore('media'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage aborted'));});
  const originalDestroy=api.destroy;
  api.destroy=()=>{panelResize.disconnect();hideTooltip();clearTimeout(feedbackTimer);dead=true;listeners.abort();host.remove();db?.close();downloads.forEach(url=>URL.revokeObjectURL(url));originalDestroy();};
  async function load(file,persist=true){
    if(busy)throw new Error('正在载入背景，请稍候。');
    if(!file.size||file.size>64*1024*1024)throw new Error('请选择小于 64 MiB 的背景文件。');
    busy=true;el('choose').disabled=true;notice('正在检查并载入背景…');
    try{
      const bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
      const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
      if(dead)return;
      try{await api.loadBlob(file);}catch{throw new Error('这个文件编码无法播放，请使用 H.264 MP4、WebM 或 PNG / JPEG / WebP。');}
      if(dead)return;
      mediaId=id;name=file.name||'已保存的背景';restoreSettings();render();remembered=!!db;
      if(persist&&db){try{await transaction('readwrite',store=>store.put({blob:file,name,id},'active'));}catch{remembered=false;}}
      if(!dead)save();
    }finally{busy=false;el('choose').disabled=false;}
  }
  on(el('file'),'change',()=>{const file=el('file').files[0];el('file').value='';if(file)queue=load(file).catch(error=>notice(error.message));});
  api.settingsPanel={show:()=>show(true),load,whenIdle:()=>queue,exportConfig,importConfig,render};
  restoreSettings();render();notice('调整即时生效，参数按背景自动保存。');
  try{
    db=await new Promise((resolve,reject)=>{const request=indexedDB.open('codex-video-skin-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('media');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Storage blocked'));});
    if(dead){db.close();return {panel:false};}
    const saved=options.preferSaved?await transaction('readonly',store=>store.get('active')):null;
    if(saved)await load(new File([saved.blob],saved.name,{type:saved.blob.type}),false);
    else if(api.getMediaBlob())await transaction('readwrite',store=>store.put({blob:api.getMediaBlob(),name,id:mediaId},'active'));
    else {notice('选择一个本地视频或图片开始。');show(true);}
  }catch{remembered=false;notice('背景存储或恢复失败，当前预览仍可使用。');}
  return {panel:true,videoRestored:mediaId!==options.id};
}
