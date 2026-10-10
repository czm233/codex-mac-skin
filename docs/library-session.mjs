// Serializable offline editing session. The adapter atomically saves state and
// assets in IndexedDB. No App process is required to retain edits or saves.
export async function createLibrarySession(adapter) {
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
