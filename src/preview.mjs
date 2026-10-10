// Native host adapter for the same workspace rendered by the introduction page.
// No library writes, settings panel, remote requests or Codex bridge exist here.
export function installSkinPreview(createAppearance, renderWorkspace, attachWorkspaceInteractions) {
  const demo=document.getElementById('demo'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let token=null,parts=[],expected=0,size=0,mime='',model=createAppearance(),mode='dark';
  let media=null,url=null,paused=false,cancelLoad=null,error=null;
  const valid=t=>{if(t!==token)throw Error('预览已切换');};
  function render(){renderWorkspace(demo,model.get(),model.palette(mode==='dark'),mode,media,mode==='dark');}
  function playback(){
    const stop=paused||reduced.matches||document.hidden||model.get().taskMode==='off';
    demo.classList.toggle('paused',stop);
    if(media?.tagName==='VIDEO'){if(stop)media.pause();else {const current=media;current.play().catch(()=>{if(media===current)error='视频无法播放';});}}
    return true;
  }
  function release(){
    cancelLoad?.();cancelLoad=null;
    if(media){if(media.tagName==='VIDEO'){media.pause();media.removeAttribute('src');media.load();}media.remove();}
    media=null;if(url)URL.revokeObjectURL(url);url=null;
    demo.classList.remove('has-media');demo.classList.add('no-background');
  }
  function status(){return {...model.get(),mediaKind:media?(media.tagName==='VIDEO'?'video':'image'):'none',width:media?.videoWidth||media?.naturalWidth||0,paused:media?.tagName==='VIDEO'?media.paused:true,currentTime:media?.currentTime||0,hidden:document.hidden,reducedMotion:reduced.matches,error};}
  attachWorkspaceInteractions();
  new ResizeObserver(render).observe(demo);
  document.addEventListener('visibilitychange',playback);reduced.addEventListener('change',playback);
  return {
    begin(profile,nextMode,id){
      release();token=id;parts=[];expected=size=0;error=null;paused=false;mode=nextMode;
      model=createAppearance(profile);render();playback();return true;
    },
    media(length,type,id){valid(id);if(!Number.isInteger(length)||length<=0||length>67108864)throw Error('背景文件过大');if(!/^(image|video)\//.test(type))throw Error('背景格式不支持');expected=length;mime=type;size=0;parts=[];return true;},
    append(encoded,id){valid(id);const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(size+bytes.length>expected)throw Error('背景长度错误');parts.push(bytes);size+=bytes.length;return true;},
    async finish(id){
      valid(id);if(size!==expected)throw Error('背景传输不完整');
      const blob=new Blob(parts,{type:mime});parts=[];release();
      const video=mime.startsWith('video/'),node=document.createElement(video?'video':'img');
      media=node;url=URL.createObjectURL(blob);node.className='local-media';node.setAttribute('aria-hidden','true');
      if(video){node.muted=true;node.loop=true;node.playsInline=true;node.preload='auto';}
      try{
        await new Promise((resolve,reject)=>{
          const loaded=video?'loadeddata':'load';
          const cleanup=()=>{clearTimeout(timer);node.removeEventListener(loaded,ok);node.removeEventListener('error',fail);cancelLoad=null;};
          const ok=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('背景无法解码'));};
          const timer=setTimeout(fail,12000);cancelLoad=()=>{cleanup();reject(Error('预览已切换'));};
          node.addEventListener(loaded,ok);node.addEventListener('error',fail);node.src=url;
        });
        valid(id);demo.prepend(node);demo.classList.add('has-media');render();playback();return status();
      }catch(e){if(token===id)release();throw e;}
    },
    pause(){paused=true;return playback();},resume(){paused=false;return playback();},
    status,getPalette(){return model.palette(mode==='dark');},
    clear(){release();token=null;parts=[];return true;}
  };
}
