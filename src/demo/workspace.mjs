export function renderWorkspace(demo,s,p,mode,media,systemDark){
 const rgba=(hex,alpha)=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return `rgba(${rgb.join(',')},${alpha})`;};
 demo.classList.toggle('light',mode==='light');demo.dataset.task=s.taskMode;
 for(const [key,value] of Object.entries(p))demo.style.setProperty('--p-'+key,value);
 demo.style.setProperty('--surface', [1,3,5].map(i=>parseInt(p.panel.slice(i,i+2),16)).join(','));demo.style.setProperty('--text',p.text);demo.style.setProperty('--secondary',p.secondaryText);
 for(const key of ['sidebar','composer','info','code','chat','bubble'])demo.style.setProperty('--fill-'+key,rgba(key==='bubble'?p.secondaryPanel:p.panel,s[key]));
 demo.style.setProperty('--shade',rgba(p.background,s.dim));demo.style.setProperty('--radius',s.radius+'px');demo.style.setProperty('--edge',s.borderWidth+'px');demo.style.setProperty('--shadow',`0 1px ${s.shadow*4}px ${rgba(s.textMode==='dark'||(s.textMode==='auto'&&!systemDark)?'#ffffff':'#000000',s.shadow*.7)}`);
 demo.style.setProperty('--filter',`brightness(${s.brightness}) contrast(${s.contrast}) saturate(${s.saturation}) blur(${s.blur}px)`);
 demo.style.setProperty('--focus-x',s.focusX+'%');demo.style.setProperty('--focus-y',s.focusY+'%');demo.dataset.fit=s.fit;
 const width=demo.clientWidth,height=demo.clientHeight;
 const scale=s.fit==='contain'?Math.min(width/16,height/9):Math.max(width/16,height/9);
 demo.style.setProperty('--scene-width',16*scale+'px');demo.style.setProperty('--scene-height',9*scale+'px');
 demo.style.setProperty('--scene-left',(width-16*scale)*s.focusX/100+'px');demo.style.setProperty('--scene-top',(height-9*scale)*s.focusY/100+'px');
 demo.style.setProperty('--safe',s.safeArea==='none'?'transparent':`linear-gradient(to ${s.safeArea==='left'?'right':'left'},${rgba(p.background,s.safeStrength)},transparent 70%)`);
 demo.style.setProperty('--duration-sun',16/s.speed+'s');demo.style.setProperty('--duration-water',9/s.speed+'s');if(media?.tagName==='VIDEO')media.playbackRate=s.speed;
}

export function attachWorkspaceInteractions(root=document){
 const link=root.getElementById('reference-link'),dialog=root.getElementById('reference-dialog');
 link.addEventListener('click',event=>{event.preventDefault();dialog.showModal();});
 root.getElementById('reference-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>link.focus({preventScroll:true}));
}
