(()=>{
function renderWorkspace(demo,s,p,mode,media,systemDark){
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
function attachWorkspaceInteractions(root=document){
 const link=root.getElementById('reference-link'),dialog=root.getElementById('reference-dialog');
 link.addEventListener('click',event=>{event.preventDefault();dialog.showModal();});
 root.getElementById('reference-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>link.focus({preventScroll:true}));
}
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

// Portable data model. Storage adapters must atomically commit the entire returned
// snapshot; callers never mutate a loaded snapshot in place. No host APIs here.
function createSkinLibraryModel(createAppearance) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
  const name = value => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw new Error('皮肤名称须为 1–100 个字符');
    return value.trim();
  };
  const profiles = value => {
    if (!object(value) || !object(value.dark) || !object(value.light)) throw new Error('缺少 Dark / Light 配置');
    return Object.fromEntries(['dark', 'light'].map(mode => [mode, createAppearance(value[mode]).get()]));
  };
  const source = value => {
    if(value==null)return null;
    if(!object(value)||!['local','package'].includes(value.kind)||!id(value.id)||!Number.isSafeInteger(value.revision)||value.revision<1)throw new Error('皮肤来源信息无效');
    return {kind:value.kind,id:value.id,revision:value.revision};
  };
  const content = value => {
    if (!object(value) || !(value.asset === null || (typeof value.asset === 'string' && /^[a-f0-9]{64}$/.test(value.asset)))) throw new Error('背景素材标识无效');
    return {asset: value.asset, profiles: profiles(value.profiles)};
  };
  const empty = () => ({format: 'codex-skin-library', version: 1, revision: 0, skins: [], drafts: [], receipts: [], activeId: null});
  const validate = value => {
    if (!object(value) || value.format !== 'codex-skin-library' || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.skins) || !Array.isArray(value.drafts)) throw new Error('皮肤库格式或版本不受支持');
    const seen = new Set();
    const skins = value.skins.map(skin => {
      if (!object(skin) || !id(skin.id) || seen.has(skin.id) || !Number.isSafeInteger(skin.revision) || skin.revision < 1) throw new Error('皮肤身份或版本无效');
      seen.add(skin.id);
      return {id: skin.id, name: name(skin.name), revision: skin.revision, source:source(skin.source), ...content(skin)};
    });
    const draftIds = new Set();
    const drafts = value.drafts.map(draft => {
      if (!object(draft) || !id(draft.id) || draftIds.has(draft.id) || !seen.has(draft.skinId) || !Number.isSafeInteger(draft.baseRevision) || draft.baseRevision < 1) throw new Error('皮肤草稿无效');
      draftIds.add(draft.id);
      return {id: draft.id, skinId: draft.skinId, baseRevision: draft.baseRevision, ...(draft.sessionId ? {sessionId: draft.sessionId} : {}), ...content(draft)};
    });
    if (value.activeId !== null && !seen.has(value.activeId)) throw new Error('当前皮肤不存在');
    const receipts = (value.receipts ?? []).map(r => {
      if (!object(r) || !id(r.id) || !id(r.skinId) || !Number.isSafeInteger(r.revision) || r.revision < 1) throw new Error('同步回执无效');
      return {id:r.id, skinId:r.skinId, revision:r.revision, name:name(r.name)};
    });
    if (new Set(receipts.map(r=>r.id)).size !== receipts.length) throw new Error('同步回执重复');
    return {format: value.format, version: 1, revision: value.revision, skins, drafts, receipts, activeId: value.activeId};
  };
  const edit = (state, action) => {
    const next = validate(state);
    const find = key => {const skin = next.skins.find(s => s.id === key); if (!skin) throw new Error('皮肤不存在'); return skin;};
    const add = (key, title, data) => {
      if (!id(key) || next.skins.some(s => s.id === key)) throw new Error('皮肤 ID 已存在或无效');
      const skin = {id: key, name: name(title), revision: 1, source:source(data.source), ...content(data)};
      next.skins.push(skin); return skin;
    };
    switch (action.type) {
      case 'receive': {
        if (!id(action.sessionId) || !Array.isArray(action.operations) || !Array.isArray(action.drafts)) throw new Error('页面同步数据无效');
        const resolve = ref => {
          if (ref.parentOp) {
            const receipt = next.receipts.find(r=>r.id===ref.parentOp);
            if (!receipt) throw new Error('缺少上一次保存的同步回执');
            return {id:receipt.skinId, revision:receipt.revision};
          }
          return {id:ref.id, revision:ref.revision};
        };
        for (const op of action.operations) {
          if (!id(op.id)) throw new Error('保存编号无效');
          if (next.receipts.some(r=>r.id===op.id)) continue;
          if (!['save','copy'].includes(op.kind)) throw new Error('保存类型无效');
          let target;
          const ref = op.kind==='save' ? resolve(op.ref) : null;
          const old = ref && next.skins.find(s=>s.id===ref.id);
          if (old && old.revision===ref.revision) {
            Object.assign(old,content(op.content));old.revision++;target=old;
          } else {
            target=add(op.id, op.kind==='save' ? (name(op.name).slice(0,85)+' · 冲突副本') : op.name, op.content);
          }
          next.receipts.push({id:op.id,skinId:target.id,revision:target.revision,name:target.name});
        }
        if(action.current){
          const ref=resolve(action.current.ref);
          if(!next.skins.some(s=>s.id===ref.id)){const recovered=add(ref.id,action.current.name,action.current.content);recovered.revision=ref.revision;}
          next.activeId=ref.id;
        }
        // This page owns only its own draft namespace. Other windows survive.
        next.drafts = next.drafts.filter(d=>d.sessionId!==action.sessionId);
        for (const draft of action.drafts) {
          const ref=resolve(draft.ref);
          if (!id(draft.id)) throw new Error('草稿编号无效');
          let skin=next.skins.find(s=>s.id===ref.id);
          if (!skin) skin=add(draft.id, '恢复的皮肤',draft.content);
          next.drafts.push({id:draft.id,sessionId:action.sessionId,skinId:skin.id,baseRevision:ref.revision||skin.revision,...content(draft.content)});
        }
        break;
      }
      case 'create': add(action.id, action.name, action.content); break;
      case 'duplicate': add(action.id, action.name, find(action.sourceId)); break;
      case 'rename': { const skin = find(action.id); skin.name = name(action.name); skin.revision++; break; }
      case 'delete':
        find(action.id);
        if (next.activeId === action.id) throw new Error('请先切换到其他皮肤，再删除当前皮肤');
        if (next.drafts.some(d => d.skinId === action.id) && !action.discardDrafts) throw new Error('此皮肤有草稿，请先处理草稿');
        next.skins = next.skins.filter(s => s.id !== action.id);
        next.drafts = next.drafts.filter(d => d.skinId !== action.id); break;
      case 'activate': find(action.id); next.activeId = action.id; break;
      case 'draft': {
        find(action.skinId);
        if (!id(action.id) || !Number.isSafeInteger(action.baseRevision) || action.baseRevision < 1) throw new Error('草稿身份或版本无效');
        const prior = next.drafts.find(d => d.id === action.id);
        if (prior && prior.skinId !== action.skinId) throw new Error('不能覆盖另一皮肤的草稿');
        next.drafts = next.drafts.filter(d => d.id !== action.id);
        next.drafts.push({id: action.id, skinId: action.skinId, baseRevision: action.baseRevision, ...content(action.content)}); break;
      }
      case 'discard': next.drafts = next.drafts.filter(d => d.id !== action.id); break;
      case 'save': {
        const draft = next.drafts.find(d => d.id === action.id);
        if (!draft) throw new Error('草稿不存在');
        const skin = find(draft.skinId);
        if (action.copyId) {
          add(action.copyId, action.name, draft);
        } else {
          if (skin.revision !== draft.baseRevision) throw new Error('皮肤已在另一处修改，请另存为以保留两份');
          Object.assign(skin, content(draft)); skin.revision++;
        }
        next.drafts = next.drafts.filter(d => d.id !== action.id); break;
      }
      default: throw new Error('未知皮肤库操作');
    }
    next.revision++;
    return validate(next);
  };
  const references = state => [...new Set([...validate(state).skins, ...validate(state).drafts].map(s => s.asset).filter(Boolean))];
  const importLegacy = value => {
    if (!object(value) || value.format !== 'codex-video-skin' || ![1, 2].includes(value.version)) throw new Error('不是支持的皮肤配置');
    if (value.version === 2) return profiles(value.profiles);
    if (!object(value.settings)) throw new Error('旧配置缺少参数');
    const dark = createAppearance({...value.settings, compatibleTheme: 'both'}).get();
    return profiles({dark, light: {...dark, textMode: 'dark'}});
  };
  return {empty, validate, edit, profiles, content, references, importLegacy, copy};
}

// Serializable offline editing session. The adapter atomically saves state and
// assets in IndexedDB. No App process is required to retain edits or saves.
async function createLibrarySession(adapter) {
  const clone = x => JSON.parse(JSON.stringify(x));
  const uuid = () => crypto.randomUUID();
  const ordered = value => Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  const equal = (a,b) => JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
  let state = await adapter.read(), queue = Promise.resolve(), rollbackState=null;
  if (!state) {
    const content = await adapter.current(), operation = uuid();
    state = {version:1, generation:1, id:uuid(), current:{id:operation,revision:1,name:'我的第一套皮肤',parentOp:operation},
      baseline:clone(content),content,dirty:false,draftId:uuid(),kept:[],
      operations:[{id:operation,kind:'copy',name:'我的第一套皮肤',content:clone(content)}]};
    await adapter.backup();
    await adapter.write(state,0);
  }
  if (state.version!==1 || !Array.isArray(state.operations) || !Array.isArray(state.kept)) throw new Error('页面皮肤库版本不受支持，原数据已保留');
  const run = fn => {
    const task = queue.then(fn);queue=task.catch(error=>adapter.notify(error.message));return task;
  };
  const commit = async next => {if(equal(next,state))return clone(state);next.generation=(state.generation||0)+1;await adapter.write(next,state.generation||0);state=next;adapter.notify();return clone(state);};
  const draft = () => ({id:state.draftId,ref:clone(state.current),content:clone(state.content)});
  const saveTo = (next, title) => {
    const operation=uuid(),kind=title?'copy':'save';
    const op={id:operation,kind,name:title||next.current.name,ref:clone(next.current),content:clone(next.content)};
    next.operations.push(op);next.baseline=clone(next.content);next.dirty=false;
    next.current={id:kind==='copy'?operation:next.current.id,revision:kind==='copy'?1:next.current.revision+1,name:op.name,parentOp:operation};
    next.draftId=uuid();
  };
  const api = {
    status:()=>({name:state.current.name,dirty:state.dirty,pending:state.operations.length,skinId:state.current.id}),
    idle:()=>queue,
    content:()=>clone(state.content),
    changed:content=>run(async()=>{const next=clone(state);next.content=clone(content);next.dirty=!equal(next.content,next.baseline);return commit(next);}),
    save:title=>run(async()=>{
      if(title!==undefined&&(typeof title!=='string'||!title.trim()||title.trim().length>100))throw new Error('名称须为 1–100 个字符');
      const next=clone(state);saveTo(next,title?.trim());return commit(next);
    }),
    snapshot:()=>run(async()=>({sessionId:state.id,current:{ref:clone(state.current),name:state.current.name,content:clone(state.baseline)},operations:clone(state.operations),drafts:[...clone(state.kept),...(state.dirty?[draft()]:[])]})),
    acknowledge:(receipts,knownSkins=[])=>run(async()=>{
      const next=clone(state),byId=new Map(receipts.map(r=>[r.id,r]));
      next.operations=next.operations.filter(op=>!byId.has(op.id));
      const update=ref=>{const receipt=byId.get(ref.parentOp);return receipt?{id:receipt.skinId,revision:receipt.revision,name:receipt.name}:ref;};
      next.current=update(next.current);
      const known=knownSkins.find(s=>s.id===next.current.id);
      if(!next.operations.length&&known&&equal({asset:known.asset,profiles:known.profiles},next.baseline))next.current={id:known.id,revision:known.revision,name:known.name};
      next.kept=next.kept.map(d=>({...d,ref:update(d.ref)}));
      return commit(next);
    }),
    activate:(skin, decision='keep')=>run(async()=>{
      if(!['save','keep','discard'].includes(decision))throw new Error('请选择如何处理当前草稿');
      if(rollbackState)throw new Error('上次应用尚未确认');
      const previous=clone(state), next=clone(state);
      if(next.dirty){
        if(decision==='save')saveTo(next);
        else if(decision==='keep')next.kept.push(draft());
      }
      // Cache media before this call. Renderer must roll back on failed decode.
      const content={asset:skin.asset,profiles:clone(skin.profiles)};
      try {
        await adapter.apply(content);
        next.current={id:skin.id,revision:skin.revision,name:skin.name};
        next.content=content;next.baseline=clone(content);next.dirty=false;next.draftId=uuid();
        if(skin.draft){next.content=clone(skin.draft);next.dirty=true;next.draftId=skin.draftId||uuid();next.kept=next.kept.filter(d=>d.id!==next.draftId);await adapter.apply(next.content);}
        await commit(next);rollbackState=previous;
      } catch(error) {await adapter.apply(previous.content);throw error;}
      return api.status();
    }),
    finalize:()=>run(async()=>{rollbackState=null;return true;}),
    rollback:()=>run(async()=>{if(rollbackState){await adapter.apply(rollbackState.content);await commit(rollbackState);rollbackState=null;}return true;}),
    discardDraft:id=>run(async()=>{const next=clone(state);next.kept=next.kept.filter(d=>d.id!==id);if(next.draftId===id){await adapter.apply(next.baseline);next.content=clone(next.baseline);next.dirty=false;next.draftId=uuid();}return commit(next);}),
    restore:()=>run(()=>adapter.apply(state.content))
  };
  return api;
}





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

})();
