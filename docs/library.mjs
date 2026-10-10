// Portable data model. Storage adapters must atomically commit the entire returned
// snapshot; callers never mutate a loaded snapshot in place. No host APIs here.
export function createSkinLibraryModel(createAppearance) {
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
