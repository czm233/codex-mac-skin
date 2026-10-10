// Original renderer. No copied third-party theme rules or implementation.
export function installVideoSkin(config, createAppearance, createCompatibility) {
  const KEY='__codexVideoSkinV1',root=document.documentElement,app=document.getElementById('root');
  if(!app||!document.querySelector('main,[role="main"]'))throw new Error('Unsupported app layout; no changes made');
  if(root.classList.contains('codex-dream-skin'))throw new Error('Another Dream Skin is active. Pause it first.');
  const model=createAppearance(config),compatibility=createCompatibility();
  window[KEY]?.destroy();
  const cleanup=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)'),system=matchMedia('(prefers-color-scheme: dark)');
  const video=document.createElement('video');video.id='cvs-video';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.setAttribute('muted','');
  const picture=document.createElement('img');picture.id='cvs-image';picture.alt='';
  const base=document.createElement('div');base.id='cvs-base';
  const veil=document.createElement('div');veil.id='cvs-veil';
  const style=document.createElement('style');style.id='cvs-style';
  for(const e of [video,picture,base,veil])e.setAttribute('aria-hidden','true');
  video.hidden=picture.hidden=true;
  let active=false,destroyed=false,manualPause=false,url=null,mediaBlob=null,kind='video',lastError=null,loading=false;
  let chunks=[],size=0,expected=0,uploading=false,task=false,settingsScene=false;
  const rgba=(hex,alpha=1)=>{const h=hex.slice(1);return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha*(h.length===8?parseInt(h.slice(6),16)/255:1)})`;};
  const themeCompatibility=()=>{
    const attr=root.getAttribute('data-theme');
    const actual=attr==='dark'||attr==='light'?attr:root.classList.contains('dark')?'dark':root.classList.contains('light')?'light':attr==='system'?(system.matches?'dark':'light'):'unknown';
    return {actualTheme:actual,compatibleTheme:'both',themeBlocked:false};
  };
  const syncPlayback=()=>{
    if(destroyed||!url)return;
    const s=model.get();video.playbackRate=s.speed;
    if(themeCompatibility().themeBlocked||settingsScene||kind!=='video'||document.hidden||manualPause||reduced.matches||(task&&s.taskMode==='off'))video.pause();
    else video.play().catch(()=>{lastError='playback-blocked';});
  };
  const updateStyles=()=>{
    const s=model.get(),p=model.palette(system.matches),darkText=s.textMode==='dark'||(s.textMode==='auto'&&!system.matches);
    const shadow=darkText?'255,255,255':'0,0,0',mask=darkText?'#ffffff':'#00050c';
    const {css:tokens}=compatibility.resolve(p,s,rgba);
    const opacity=settingsScene?0:task&&s.taskMode==='off'?0:task&&s.taskMode==='atmosphere'?.35:1;
    const safe=s.safeArea==='none'?'none':`linear-gradient(to ${s.safeArea==='left'?'right':'left'},${rgba(p.panel,s.safeStrength)} 0%,transparent 72%)`;
    style.textContent=`
      #cvs-base,#cvs-video,#cvs-image,#cvs-veil{position:fixed;inset:0;width:100%;height:100%;pointer-events:none}
      #cvs-base{z-index:-3;background:${p.background}}
      #cvs-video,#cvs-image{object-fit:${s.fit};object-position:${s.focusX}% ${s.focusY}%;z-index:-2;opacity:${opacity};filter:brightness(${s.brightness}) contrast(${s.contrast}) saturate(${s.saturation}) blur(${s.blur}px)}
      #cvs-video[hidden],#cvs-image[hidden]{display:none!important}
      #cvs-veil{z-index:-1;background-color:${rgba(mask,s.dim)};background-image:${safe}}
      html.cvs-active{isolation:isolate}
      html.cvs-active,html.cvs-active #root{${tokens}color:${p.text}!important;color-scheme:${darkText?'light':'dark'};--chat-background-color:transparent!important;--user-message-background-color:${rgba(p.secondaryPanel,s.bubble)}!important;--link-primary-text-color:${p.accent}!important;}
      html.cvs-active body{background:transparent!important}
      html.cvs-active #root{background:transparent!important}
      html.cvs-active #root>div:where(:not([data-cvs-native-surface])),html.cvs-active main,html.cvs-active main>header,
      html.cvs-active [data-thread-user-message-navigation-content],html.cvs-active [data-thread-scroll-footer],
      html.cvs-active [class~="bg-token-main-surface-primary"],html.cvs-active [class~="bg-token-main-surface-secondary"],
      html.cvs-active [class~="bg-token-bg-primary"],html.cvs-active [class~="bg-token-bg-secondary"]{background:transparent!important;box-shadow:none!important}
      html.cvs-active .thread-scroll-container{background:${rgba(p.panel,s.chat)}!important}
      html.cvs-active aside.app-shell-left-panel [class~="group/folder-row"]:not([aria-disabled="true"]){color:${p.text}!important;opacity:1!important}
      html.cvs-active aside.app-shell-left-panel [class~="group/folder-row"]:not([aria-disabled="true"]) .text-default{color:inherit!important}
      /* Auxiliary sidebar actions keep a stable foreground; hover feedback uses the surface. */
      html.cvs-active aside.app-shell-left-panel button[data-color="secondary"][data-variant="transparent"]:not(:disabled):not([aria-disabled="true"]){color:${p.secondaryText}!important;transition-property:opacity!important}
      html.cvs-active aside.app-shell-left-panel{background:${rgba(p.panel,s.sidebar)}!important}
      html.cvs-active aside.app-shell-left-panel::after{background:transparent!important}
      html.cvs-active [data-composer-surface-variant]{background:${rgba(p.panel,s.composer)}!important;backdrop-filter:none!important;border-radius:${s.radius}px!important;box-shadow:inset 0 0 0 ${s.borderWidth}px ${p.border}!important}
      html.cvs-active [data-composer-body]{background:transparent!important}
      html.cvs-active [data-user-message-bubble]{background:${rgba(p.secondaryPanel,s.bubble)}!important;color:${p.text}!important}
      html.cvs-active aside.app-shell-left-panel,html.cvs-active main>header,
      html.cvs-active [data-thread-user-message-navigation-content],html.cvs-active [data-thread-scroll-footer],html.cvs-active [data-composer-body],html.cvs-active #root [data-summary-panel-variant]{color:${p.text};text-shadow:0 1px 2px rgba(${shadow},${.95*s.shadow}),0 0 5px rgba(${shadow},${.8*s.shadow})}
      html.cvs-active [data-markdown-text-style],html.cvs-active [data-markdown-text-tone],html.cvs-active [data-composer-body] [contenteditable="true"]{color:${p.text}!important;caret-color:${p.text}!important}
      html.cvs-active [data-markdown-text-style] a{color:${p.accent}!important}
      html.cvs-active #root ::selection{background:${rgba(p.highlight,.3)};color:${p.text}}
      html.cvs-active #root :focus-visible{outline-color:${p.accent}}
      html.cvs-active [role="dialog"],html.cvs-active [role="menu"],html.cvs-active [role="listbox"]{background:${p.secondaryPanel}!important;color:${p.text}!important;text-shadow:none}
      /* Native settings groups use an inline panel token, separate from surface.
         Target that semantic surface and direct settings-row containers only. */
      html.cvs-active #root :is(div,section)[style*="--color-background-panel"],
      html.cvs-active #root .rounded-2xl:has(>[class~="@container/settings-row"]){background:${rgba(p.secondaryPanel,s.settings)}!important;color:${p.text};backdrop-filter:none!important;}
      /* Dropdown triggers have their own solid fill; keep them readable in either palette.
         Scope to settings groups, preserving switches, semantic actions and portal layers. */
      html.cvs-active #root :is([style*="--color-background-panel"],.rounded-2xl:has(>[class~="@container/settings-row"])) :is(button[aria-haspopup="menu"],button[aria-haspopup="listbox"],[role="combobox"],select){background:${p.secondaryPanel}!important;color:${p.text}!important;border-color:${p.border}!important;}
      /* One continuous code surface; no opaque sticky-header gradient. */
      html.cvs-active #root [data-markdown-copy="code-block"]{background:${rgba(p.secondaryPanel,s.code)}!important;color:${p.text}!important;--color-text:${p.text}!important;--color-text-primary:${p.text}!important;--color-text-secondary:${p.secondaryText}!important;--color-icon-primary:${p.text}!important;border:1px solid ${rgba(p.border,s.code)}!important;border-radius:${s.radius}px;box-shadow:0 6px 18px rgba(0,0,0,${.22*s.code})!important;text-shadow:none;}
      html.cvs-active #root [data-markdown-copy="code-block"]>div,
      html.cvs-active #root [data-markdown-copy="code-block"] pre{background:transparent!important;background-image:none!important;}
      html.cvs-active #root [data-markdown-copy="code-block"]>[data-markdown-copy="exclude"]{color:${p.text}!important;border-bottom:1px solid ${rgba(p.border,s.code)};}
      html.cvs-active #root [data-markdown-copy="code-block"] code{color:${p.text};text-shadow:none;}
      html.cvs-active #root textarea#personal-agents-editor{background:${rgba(p.secondaryPanel,s.settings)}!important;color:${p.text}!important;caret-color:${p.text}!important;border-color:${p.border}!important;color-scheme:${darkText?'light':'dark'};text-shadow:none;}
      html.cvs-active #root textarea#personal-agents-editor::placeholder{color:${p.muted}!important;opacity:1;}
      html.cvs-active #root .bg-page-search input{color:${p.text}!important;caret-color:${p.text}!important;}
      html.cvs-active #root .bg-page-search input::placeholder{color:${p.muted}!important;opacity:1;}
      html.cvs-active #root :is(input,textarea).bg-primary-soft,
      html.cvs-active #root .bg-primary-soft :is(input,textarea){caret-color:${p.text};}
      html.cvs-active #root :is(input,textarea).bg-primary-soft::placeholder,
      html.cvs-active #root .bg-primary-soft :is(input,textarea)::placeholder{color:${p.muted}!important;opacity:1;}
      /* Paint the summary once. Its sticky titles must not add an opaque layer. */
      html.cvs-active #root [data-summary-panel-variant]{--color-surface-elevated:transparent!important;--color-surface-elevated-secondary:transparent!important;background:${rgba(p.secondaryPanel,s.info)}!important;backdrop-filter:none!important;border-radius:${s.radius}px!important;box-shadow:inset 0 0 0 ${s.borderWidth}px ${rgba(p.border,s.info)}!important;}
      html.cvs-active #root [data-summary-panel-variant] header,html.cvs-active #root [data-summary-panel-variant] header::before,html.cvs-active #root [data-summary-panel-variant] header::after{background:transparent!important;box-shadow:none!important}
    `;
    root.classList.toggle('cvs-active',active&&!settingsScene&&!themeCompatibility().themeBlocked);
    for(const layer of [base,video,picture,veil])layer.style.display=settingsScene||themeCompatibility().themeBlocked?'none':'';
    syncPlayback();
  };
  const onSystemChange=()=>{updateStyles();nativeGuard.refresh();window.dispatchEvent(new Event('cvs-theme-change'));};
  const status=()=>({version:1,active,paused:kind==='image'||video.paused,manualPause,hidden:document.hidden,reducedMotion:reduced.matches,readyState:kind==='image'?(picture.complete?4:0):video.readyState,currentTime:kind==='image'?0:video.currentTime,duration:kind==='video'&&Number.isFinite(video.duration)?video.duration:0,width:kind==='image'?picture.naturalWidth:video.videoWidth,height:kind==='image'?picture.naturalHeight:video.videoHeight,...model.get(),glass:.12,error:lastError,bytes:size,appearance:'custom',mediaKind:kind,bufferedChunks:chunks.length,settingsScene,...themeCompatibility(),nativeFallbacks:nativeGuard.count(),decodedFrames:kind==='video'?video.getVideoPlaybackQuality?.().totalVideoFrames||0:0});
  const destroy=()=>{
    if(destroyed)return;destroyed=true;active=false;cleanup.abort();observer.disconnect();themeObserver.disconnect();nativeGuard.destroy();layoutObserver.disconnect();cancelAnimationFrame(layoutFrame);for(const scroll of [...layoutRecords.keys()])restoreLayout(scroll);
    reduced.removeEventListener('change',syncPlayback);system.removeEventListener('change',onSystemChange);
    video.pause();video.removeAttribute('src');video.load();picture.removeAttribute('src');if(url)URL.revokeObjectURL(url);
    for(const e of [video,picture,base,veil,style])e.remove();root.classList.remove('cvs-active');chunks=[];mediaBlob=null;
    if(window[KEY]===api)delete window[KEY];
  };
  async function loadBlob(blob){
    if(loading)throw new Error('正在加载背景');
    if(!blob||!blob.size||blob.size>64*1024*1024)throw new Error('背景文件须在 64 MiB 以内');
    const nextKind=blob.type.startsWith('image/')?'image':'video';
    if(nextKind==='image'&&!['image/png','image/jpeg','image/webp'].includes(blob.type))throw new Error('图片仅支持 PNG、JPEG、WebP');
    const probe=nextKind==='image'?new Image():document.createElement('video'),next=URL.createObjectURL(blob);
    const previous={url,mediaBlob,kind,size,active,lastError};
    loading=true;
    try{
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>finish(new Error('背景解码超时')),12000);
        const finish=err=>{clearTimeout(timer);probe.onload=probe.onloadeddata=probe.onerror=null;err?reject(err):resolve();};
        probe.onerror=()=>finish(new Error('Unsupported video codec / 不支持的背景编码'));
        if(nextKind==='image')probe.onload=()=>probe.naturalWidth>16384||probe.naturalHeight>16384?finish(new Error('图片单边不能超过 16384 像素')):finish();
        else {probe.muted=true;probe.onloadeddata=()=>finish();}
        probe.src=next;if(nextKind==='video')probe.load();
      });
      if(destroyed)throw new Error('换肤已关闭');
      video.pause();const old=url;url=next;mediaBlob=blob;kind=nextKind;size=blob.size;
      if(kind==='image'){picture.src=next;await picture.decode();video.removeAttribute('src');video.load();}
      else {
        video.src=next;
        await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('Video decoding timed out')),12000);const finish=err=>{clearTimeout(timer);video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);err?reject(err):resolve();};const loaded=()=>finish();const failed=()=>finish(new Error('Unsupported video codec'));video.addEventListener('loadeddata',loaded,{once:true});video.addEventListener('error',failed,{once:true});video.load();});
      }
      if(old)URL.revokeObjectURL(old);video.hidden=kind!=='video';picture.hidden=kind!=='image';active=true;lastError=null;updateStyles();return status();
    }catch(error){
      if(url===next){url=previous.url;mediaBlob=previous.mediaBlob;kind=previous.kind;size=previous.size;active=previous.active;lastError=previous.lastError;
        video.pause();video.removeAttribute('src');picture.removeAttribute('src');
        if(url){if(kind==='image')picture.src=url;else video.src=url;}video.load();
        video.hidden=!active||kind!=='video';picture.hidden=!active||kind!=='image';updateStyles();}
      URL.revokeObjectURL(next);throw error;
    }
    finally{loading=false;probe.removeAttribute('src');if(nextKind==='video')probe.load();}
  }
  // Reserve real viewport space for the absolute footer. Its containing block
  // remains outside the scroller, so overflow clips messages but not the composer.
  // React owns the DOM: never reparent its nodes or replace native scroll handlers.
  const layoutRecords=new Map(),layoutWatched=new Set();let layoutFrame=0;
  function restoreLayout(scroll){
    const record=layoutRecords.get(scroll);if(!record)return;
    for(const [node,props] of record.saved)for(const [key,[value,priority]] of props){
      if(value)node.style.setProperty(key,value,priority);else node.style.removeProperty(key);
    }
    layoutRecords.delete(scroll);
  }
  function writeLayout(record,node,key,value){
    if(!record.saved.has(node))record.saved.set(node,new Map());
    const props=record.saved.get(node);
    if(!props.has(key))props.set(key,[node.style.getPropertyValue(key),node.style.getPropertyPriority(key)]);
    if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value,'important');
  }
  function updateLayout(){
    layoutFrame=0;if(destroyed)return;
    const current=new Set(),observed=new Set([app]);
    for(const scroll of app.querySelectorAll('.thread-scroll-container')){
      const transcript=scroll.querySelector('[data-thread-user-message-navigation-content]');
      const footer=scroll.querySelector('[data-thread-scroll-footer]');
      const composer=footer?.querySelector('[data-composer-surface-variant]');
      const parent=scroll.parentElement;
      // Unsupported future layouts stay untouched instead of hiding their input.
      if(!transcript||!composer||footer.offsetParent!==parent||getComputedStyle(scroll).position!=='static')continue;
      observed.add(parent);observed.add(footer);observed.add(composer);
      const height=Math.ceil(footer.getBoundingClientRect().height);
      if(!height||!composer.getBoundingClientRect().width)continue;
      current.add(scroll);
      let record=layoutRecords.get(scroll);
      if(!record){record={saved:new Map(),height:-1};layoutRecords.set(scroll,record);}
      const spacer=[...transcript.parentElement.children].find(e=>e!==transcript&&typeof e.className==='string'&&e.className.includes('--thread-scroll-padding-bottom')&&getComputedStyle(e).position==='sticky');
      const changed=record.height!==height||(spacer&&!record.saved.has(spacer));
      if(!changed)continue;
      const reverse=getComputedStyle(scroll).flexDirection==='column-reverse';
      const atEnd=reverse?Math.abs(scroll.scrollTop)<2:Math.abs(scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop)<2;
      const top=transcript.getBoundingClientRect().top;
      writeLayout(record,scroll,'height',`max(0px, calc(100% - ${height}px))`);
      writeLayout(record,scroll,'min-height','0px');
      writeLayout(record,scroll,'scroll-padding-bottom','16px');
      if(spacer){writeLayout(record,spacer,'height','0px');writeLayout(record,spacer,'min-height','0px');}
      record.height=height;
      if(atEnd)scroll.scrollTop=reverse?0:scroll.scrollHeight;
      else scroll.scrollTop+=transcript.getBoundingClientRect().top-top;
    }
    for(const scroll of [...layoutRecords.keys()])if(!current.has(scroll))restoreLayout(scroll);
    for(const node of layoutWatched)if(!observed.has(node)){layoutObserver.unobserve(node);layoutWatched.delete(node);}
    for(const node of observed)if(!layoutWatched.has(node)){layoutObserver.observe(node);layoutWatched.add(node);}
  }
  const layoutObserver=new ResizeObserver(updateLayout);
  const scheduleLayout=()=>{if(!destroyed&&!layoutFrame)layoutFrame=requestAnimationFrame(updateLayout);};
  window.addEventListener('resize',updateLayout,{passive:true,signal:cleanup.signal});
  const refreshRoute=()=>{scheduleLayout();const next=!!document.querySelector('[data-thread-user-message-navigation-content]');const nextSettings=!!document.querySelector('#settings-search,[data-settings-panel-slug]');if(next!==task||nextSettings!==settingsScene){task=next;settingsScene=nextSettings;updateStyles();}};
  const observer=new MutationObserver(refreshRoute);observer.observe(app,{childList:true,subtree:true});
  let lastTheme=themeCompatibility().actualTheme;
  const themeObserver=new MutationObserver(()=>{const next=themeCompatibility().actualTheme;if(next===lastTheme)return;lastTheme=next;updateStyles();nativeGuard.refresh();window.dispatchEvent(new Event('cvs-theme-change'));});
  themeObserver.observe(root,{attributes:true,attributeFilter:['data-theme','class']});
  const change=patch=>{model.set(patch);updateStyles();return status();};
  async function switchNativeTheme(mode){
    if(!['dark','light'].includes(mode))throw new Error('请选择 Dark 或 Light');
    const resource=[...document.querySelectorAll('link[rel="modulepreload"]')].map(e=>e.href).concat(performance.getEntriesByType('resource').map(e=>e.name)).find(url=>/\/app-initial-[^/]+\.js(?:$|\?)/.test(url));
    if(!resource)throw new Error('当前 Codex 的主题切换接口不可用，请在原生 Appearance 中切换');
    const module=await import(resource),service=module.Tnt?.settings;
    if(typeof service?.write!=='function'||typeof service?.read!=='function')throw new Error('当前 Codex 版本不支持直接切换，请在原生 Appearance 中切换');
    await service.write('appearanceTheme',mode);
    for(let i=0;i<40;i++){
      if(themeCompatibility().actualTheme===mode)return mode;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error('已请求切换，但未确认界面生效；请检查原生 Theme');
  }
  const api={version:1,switchNativeTheme,status,destroy,getMediaBlob:()=>mediaBlob,getSettings:model.get,getSchema:()=>model.schema,getColorLabels:()=>model.colorLabels,getPalette:()=>model.palette(system.matches),getCSS:()=>style.textContent,
    clearMedia(){video.pause();video.removeAttribute('src');video.load();picture.removeAttribute('src');if(url)URL.revokeObjectURL(url);url=null;mediaBlob=null;kind='none';size=0;active=true;video.hidden=picture.hidden=true;updateStyles();return status();},
    setSettings:change,resetSettings(){model.reset();updateStyles();return status();},loadBlob,
    pause(){manualPause=true;syncPlayback();return status();},resume(){manualPause=false;syncPlayback();return status();},
    setDim:value=>change({dim:value}),setGlass:value=>{if(!Number.isFinite(value)||value<0||value>.45)throw new Error('Glass must be 0–0.45');return change({sidebar:value,composer:value,bubble:value});},
    setFit:value=>change({fit:value}),setTextMode:value=>change({textMode:value}),setPanel:(name,value)=>{if(!['sidebar','composer','shadow','info','chat','bubble'].includes(name))throw new Error('Invalid panel setting');return change({[name]:value});},
    begin(bytes){if(!Number.isInteger(bytes)||bytes<=0||bytes>64*1024*1024)throw new Error('Video exceeds 64 MiB');chunks=[];size=0;expected=bytes;uploading=true;return true;},
    append(base64){if(!uploading)throw new Error('No upload in progress');const part=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));if(size+part.length>expected)throw new Error('Unexpected upload length');chunks.push(part);size+=part.length;return size;},
    async commit(){if(!uploading||size!==expected)throw new Error('Incomplete video');uploading=false;const blob=new Blob(chunks,{type:'video/mp4'});chunks=[];return loadBlob(blob);}
  };
  document.addEventListener('visibilitychange',syncPlayback,{signal:cleanup.signal});
  window.addEventListener('pagehide',()=>api.destroy(),{once:true,signal:cleanup.signal});
  reduced.addEventListener('change',syncPlayback);system.addEventListener('change',onSystemChange);
  const nativeGuard=compatibility.guard(app,style,Object.keys(compatibility.resolve(model.palette(system.matches),model.get(),rgba).tokens));
  window[KEY]=api;document.head.append(style);document.body.prepend(base,video,picture,veil);updateStyles();refreshRoute();
  return {version:1,installed:true};
}
