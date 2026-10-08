// Self-contained renderer: evaluated inside the verified Codex window.
// This implementation is original; the referenced projects informed the design.
export function installVideoSkin(config) {
  const KEY = '__codexVideoSkinV1';
  const root = document.documentElement;
  const app = document.getElementById('root');
  if (!app || !document.querySelector('main, [role="main"]')) throw new Error('Unsupported app layout; no changes made');
  if (root.classList.contains('codex-dream-skin')) throw new Error('Another Dream Skin is active. Pause it before applying video skin.');
  const previous = window[KEY];
  if (previous?.version === 1) previous.destroy();
  const cleanup = new AbortController();
  const video = document.createElement('video');
  video.id = 'cvs-video'; video.muted = true; video.defaultMuted = true;
  video.loop = true; video.autoplay = false; video.playsInline = true;
  video.preload = 'auto'; video.setAttribute('aria-hidden', 'true');
  video.setAttribute('muted',''); video.setAttribute('playsinline','');
  const veil = document.createElement('div'); veil.id = 'cvs-veil'; veil.setAttribute('aria-hidden','true');
  const style = document.createElement('style'); style.id = 'cvs-style';
  let dim = Number.isFinite(config.dim) ? Math.max(0, Math.min(0.9, config.dim)) : 0.30;
  let glass = Number.isFinite(config.glass) ? Math.max(0, Math.min(0.45, config.glass)) : 0.12;
  let fit = config.fit === 'cover' ? 'cover' : 'contain';
  let textMode = 'light', sidebar = glass, composer = glass, shadow = 1;
  let manualPause = false, active = false, destroyed = false, url = null, lastError = null;
  let mediaBlob=null;
  let chunks = [], size = 0, expected = 0, uploading = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const appearance = 'cinema';
  // Host token names were inspected in this installed client. Only neutral
  // colors are adapted; this is not a copied third-party theme or stylesheet.
  const neutral = {
    'text': '#eef5fc', 'text-primary': '#eef5fc', 'text-secondary': '#d7e3ee',
    'text-tertiary': '#bbccdb', 'text-quaternary': '#aebfce',
    'codex-description': '#bbccdb', 'text-secondary-solid': '#d7e3ee',
    'text-foreground': '#eef5fc', 'text-foreground-secondary': '#d7e3ee',
    'text-user-message': '#eef5fc', 'icon-primary': '#eef5fc',
    'icon-secondary': '#d7e3ee', 'icon-tertiary': '#bbccdb',
    'foreground': '#eef5fc', 'foreground-secondary': '#d7e3ee',
    'border': 'rgba(210,232,255,.18)', 'border-default': 'rgba(210,232,255,.18)',
    'text-primary-ghost': '#eef5fc', 'text-primary-ghost-hover': '#ffffff',
    'text-secondary-ghost': '#d7e3ee', 'text-secondary-ghost-hover': '#ffffff'
  };
  const updateStyles = () => {
    const tokens = Object.entries(neutral).flatMap(([name,value]) =>
      ['--color-', '--app-color-', '--color-token-'].map(prefix => `${prefix}${name}:${value} !important;`)
    ).join('\n');
    style.textContent = `
      #cvs-video, #cvs-veil { position:fixed; inset:0; width:100%; height:100%; pointer-events:none; }
      #cvs-video { object-fit:${fit}; z-index:0; background:#080e16; }
      #cvs-veil { z-index:1; background:rgba(0,5,12,${dim}); }
      html.cvs-active, html.cvs-active #root {
        ${tokens}
        --color-surface:rgba(9,17,28,${glass}) !important;
        --color-surface-secondary:rgba(9,17,28,${glass}) !important;
        --color-surface-tertiary:rgba(9,17,28,${glass}) !important;
        --color-surface-elevated:rgb(19,28,40) !important;
        --color-surface-elevated-secondary:rgb(19,28,40) !important;
        --color-background-user-message:rgba(22,42,62,${glass}) !important;
        --user-message-background-color:rgba(22,42,62,${glass}) !important;
        --chat-background-color:transparent !important;
        --color-background-composer-action-bar:transparent !important;
        --link-primary-text-color:#8edbff !important;
        --color-text-link:#8edbff !important;
        color:#eef5fc !important; color-scheme:dark;
      }
      html.cvs-active body { background:transparent !important; color:#eef5fc !important; }
      html.cvs-active #root { position:relative; z-index:2; background:transparent !important; }
      html.cvs-active #root > div,
      html.cvs-active main,
      html.cvs-active main > header,
      html.cvs-active [data-thread-user-message-navigation-content],
      html.cvs-active [data-thread-scroll-footer],
      html.cvs-active [class~="bg-token-main-surface-primary"],
      html.cvs-active [class~="bg-token-main-surface-secondary"],
      html.cvs-active [class~="bg-token-bg-primary"],
      html.cvs-active [class~="bg-token-bg-secondary"] {
        background:transparent !important; box-shadow:none !important;
      }
      html.cvs-active aside.app-shell-left-panel {
        background:rgba(3,10,19,${sidebar}) !important;
      }
      html.cvs-active [data-composer-surface-variant] {
        background:rgba(3,10,19,${composer}) !important;
        backdrop-filter:none !important;
        box-shadow:inset 0 0 0 1px rgba(208,230,250,.2) !important;
      }
      html.cvs-active [data-composer-body] {
        background:transparent !important;
      }
      html.cvs-active [data-user-message-bubble] {
        background:rgba(11,28,44,${glass}) !important;
        color:#eef5fc !important;
      }
      html.cvs-active aside.app-shell-left-panel,
      html.cvs-active main > header,
      html.cvs-active [data-thread-user-message-navigation-content],
      html.cvs-active [data-thread-scroll-footer],
      html.cvs-active [data-composer-body] {
        color:#eef5fc;
        text-shadow:0 1px 2px rgba(0,0,0,${.95*shadow}),0 0 5px rgba(0,0,0,${.8*shadow});
      }
      html.cvs-active [data-markdown-text-style],
      html.cvs-active [data-markdown-text-tone],
      html.cvs-active [contenteditable="true"] { color:#eef5fc !important; caret-color:#eef5fc !important; }
      html.cvs-active [data-markdown-text-style] a { color:#8edbff !important; }
      /* Popovers are temporary controls, not full-window video blockers. */
      html.cvs-active [role="dialog"], html.cvs-active [role="menu"],
      html.cvs-active [role="listbox"] {
        background:#131c28 !important; color:#eef5fc !important; text-shadow:none;
      }
    `;
    if (textMode === 'dark') {
      const replacements = {'#eef5fc':'#17232e','#d7e3ee':'#304252','#bbccdb':'#44586a','#aebfce':'#526575','#ffffff':'#07121c','#8edbff':'#005c91','#131c28':'#edf3f8','rgb(19,28,40)':'rgb(237,243,248)','rgba(0,5,12,':'rgba(255,255,255,','rgba(3,10,19,':'rgba(246,250,255,','rgba(9,17,28,':'rgba(246,250,255,','rgba(11,28,44,':'rgba(235,243,251,','rgba(22,42,62,':'rgba(235,243,251,','rgba(0,0,0,':'rgba(255,255,255,','rgba(210,232,255,.18)':'rgba(20,45,65,.22)','rgba(208,230,250,.2)':'rgba(20,45,65,.22)','color-scheme:dark':'color-scheme:light'};
      for (const [from,to] of Object.entries(replacements)) style.textContent=style.textContent.split(from).join(to);
    }
  };
  const syncPlayback = () => {
    if (destroyed || !url) return;
    if (document.hidden || manualPause || reduced.matches) video.pause();
    else video.play().catch(() => { lastError = 'playback-blocked'; });
  };
  const status = () => ({version:1, active, paused:video.paused, manualPause,
    hidden:document.hidden, reducedMotion:reduced.matches, readyState:video.readyState,
    currentTime:video.currentTime, duration:Number.isFinite(video.duration)?video.duration:0,
    width:video.videoWidth, height:video.videoHeight, dim, glass, fit, textMode, sidebar, composer, shadow, error:lastError,
    bytes:size, appearance, bufferedChunks:chunks.length, decodedFrames:video.getVideoPlaybackQuality?.().totalVideoFrames || 0});
  const destroy = () => {
    if (destroyed) return;
    destroyed = true; active = false; uploading = false; cleanup.abort();
    reduced.removeEventListener('change',syncPlayback); video.pause();
    video.removeAttribute('src'); video.load();
    if (url) URL.revokeObjectURL(url);
    chunks = []; mediaBlob=null; video.remove(); veil.remove(); style.remove(); root.classList.remove('cvs-active');
    if (window[KEY] === api) delete window[KEY];
  };
  video.addEventListener('error', () => {
    lastError = 'video-decode-error'; root.classList.remove('cvs-active');
    video.hidden = veil.hidden = true; active = false;
  }, {signal:cleanup.signal});
  document.addEventListener('visibilitychange', syncPlayback, {signal:cleanup.signal});
  window.addEventListener('pagehide',destroy,{once:true,signal:cleanup.signal});
  reduced.addEventListener('change',syncPlayback);
  const api = {version:1, status, destroy,
    getMediaBlob:()=>mediaBlob,
    pause() {manualPause=true; syncPlayback(); return status();},
    resume() {manualPause=false; syncPlayback(); return status();},
    setDim(value) { if (!Number.isFinite(value)||value<0||value>0.9) throw new Error('Dim must be 0–0.9'); dim=value; updateStyles(); return status(); },
    setGlass(value) { if (!Number.isFinite(value)||value<0||value>0.45) throw new Error('Glass must be 0–0.45'); glass=value; sidebar=composer=value; updateStyles(); return status(); },
    setFit(value) { if (!['contain','cover'].includes(value)) throw new Error('Fit must be contain or cover'); fit=value; updateStyles(); return status(); },
    setTextMode(value) {if(!['light','dark'].includes(value)) throw new Error('Invalid text mode');textMode=value;updateStyles();return status();},
    setPanel(name,value) {if(!['sidebar','composer','shadow'].includes(name)||!Number.isFinite(value)||value<0||value>1) throw new Error('Invalid panel setting');if(name==='sidebar')sidebar=value;else if(name==='composer')composer=value;else shadow=value;updateStyles();return status();},
    begin(bytes) {
      if (!Number.isInteger(bytes)||bytes<=0||bytes>64*1024*1024) throw new Error('Video exceeds 64 MiB');
      chunks=[]; size=0; expected=bytes; uploading=true; return true;
    },
    append(base64) {
      if (!uploading) throw new Error('No upload in progress');
      const text=atob(base64); const part=Uint8Array.from(text,c=>c.charCodeAt(0));
      if (size+part.length>expected) throw new Error('Unexpected upload length');
      chunks.push(part); size+=part.length; return size;
    },
    async commit() {
      if (!uploading || size!==expected) throw new Error('Incomplete video');
      uploading=false;
      mediaBlob=new Blob(chunks,{type:'video/mp4'});
      const next=URL.createObjectURL(mediaBlob); chunks=[];
      video.pause(); if(url) URL.revokeObjectURL(url); url=next;
      video.src=url;
      await new Promise((resolve,reject) => {
        const timer=setTimeout(()=>finish(new Error('Video decoding timed out')),12000);
        const finish=err=> {clearTimeout(timer); video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);err?reject(err):resolve();};
        const loaded=()=>finish(); const failed=()=>finish(new Error('Unsupported video codec'));
        video.addEventListener('loadeddata',loaded,{once:true}); video.addEventListener('error',failed,{once:true});video.load();
      });
      video.hidden=veil.hidden=false; root.classList.add('cvs-active');active=true;lastError=null;
      syncPlayback(); return status();
    }
  };
  updateStyles(); document.head.append(style);
  document.body.prepend(veil); document.body.prepend(video);
  window[KEY]=api;
  return {version:1, installed:true};
}
