// Original compatibility registry. Serialized alongside the renderer in both entry points.
export function createCompatibility() {
  const prefixes=['--color-','--app-color-','--color-token-'];
  const regions={
    shell:'main,main>header,aside.app-shell-left-panel,.thread-scroll-container,[data-thread-user-message-navigation-content],[data-thread-scroll-footer],[data-composer-surface-variant],[data-composer-body],[data-user-message-bubble]',
    cards:'[data-summary-panel-variant],[data-markdown-copy="code-block"],.rounded-2xl:has(>[class~="@container/settings-row"]),[style*="--color-background-panel"]',
    controls:'aside.app-shell-left-panel button[data-color="secondary"][data-variant="transparent"],.bg-page-search,.bg-primary-soft,.bg-primary-soft-alpha,.bg-secondary-soft-alpha,.bg-surface,.bg-surface-secondary,.bg-surface-tertiary,.bg-surface-elevated,.bg-surface-elevated-secondary,textarea#personal-agents-editor',
    portals:'[role="dialog"],[role="menu"],[role="listbox"]'
  };
  const known=Object.values(regions).join(',');
  function resolve(p,s,rgba){
    const tokenValues={
      text:p.text,'text-primary':p.text,'text-secondary':p.secondaryText,'text-tertiary':p.muted,'text-quaternary':p.muted,
      'codex-description':p.muted,'text-secondary-solid':p.secondaryText,'text-foreground':p.text,'text-foreground-secondary':p.secondaryText,
      'text-user-message':p.text,'text-composer-primary':p.text,'icon-primary':p.text,'icon-secondary':p.secondaryText,'icon-tertiary':p.muted,
      foreground:p.text,'foreground-secondary':p.secondaryText,border:p.border,'border-default':p.border,'text-primary-ghost':p.text,
      'text-primary-ghost-hover':p.highlight,'text-secondary-ghost':p.secondaryText,'text-secondary-ghost-hover':p.highlight,
      'text-link':p.accent,'text-disabled':p.muted,'text-inverse':p.background,
      surface:rgba(p.panel,.12),'surface-secondary':rgba(p.secondaryPanel,.12),'surface-tertiary':rgba(p.secondaryPanel,.12),
      'surface-elevated':p.secondaryPanel,'surface-elevated-secondary':p.secondaryPanel,
      'background-panel':rgba(p.secondaryPanel,s.settings),
      'background-page-search':rgba(p.secondaryPanel,.85),
      'background-primary-soft':rgba(p.secondaryPanel,.85),'background-primary-soft-hover':rgba(p.secondaryPanel,.95),'background-primary-soft-active':p.secondaryPanel,
      'background-primary-soft-alpha':rgba(p.secondaryPanel,.72),'background-secondary-soft-alpha':rgba(p.secondaryPanel,.45),
      'background-primary-ghost-hover':rgba(p.secondaryPanel,.9),'background-primary-ghost-active':rgba(p.secondaryPanel,.95),
      'background-user-message':rgba(p.secondaryPanel,s.bubble),'background-composer-action-bar':'transparent',
      'background-primary-solid':p.accent,'background-primary-solid-hover':p.secondaryAccent,'background-primary-solid-active':p.secondaryAccent,
      'text-primary-solid':p.background,'background-primary-ghost-focus':rgba(p.highlight,.16),'border-primary-outline':p.border,
      'border-primary-outline-hover':p.secondaryAccent,'border-focus':p.accent,'icon-disabled':p.muted
    };
    // Families are explicit so text/background/state coverage can be audited together.
    const families={neutral:{},surface:{},action:{},border:{}};
    for(const [name,value] of Object.entries(tokenValues)){
      const family=name.startsWith('border')?'border':/primary-solid|primary-ghost|secondary-ghost|primary-outline/.test(name)?'action':/^(background|surface)/.test(name)?'surface':'neutral';
      families[family][name]=value;
    }
    return {families,tokens:tokenValues,css:Object.entries(tokenValues).flatMap(([k,v])=>prefixes.map(prefix=>`${prefix}${k}:${v}!important;`)).join('\n')};
  }
  // Computed CSS colors may use legacy rgba or modern rgb/oklab/color syntax.
  function surfaceAlpha(color){
    if(color==='transparent')return 0;
    const slash=color.match(/\/\s*([\d.]+)(%)?\s*\)$/);
    if(slash)return Number(slash[1])/(slash[2]?100:1);
    const legacy=color.match(/^rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
    return legacy?Number(legacy[1]):1;
  }
  function guard(app,skinStyle,tokenNames){
    const fallback=document.createElement('style');fallback.id='cvs-native-fallback';document.head.append(fallback);
    const records=new Map();let sequence=0,dead=false;
    const candidates='input,textarea,select,button,table,thead,tbody,tr,td,th,[style*="background"],[class*="bg-"],[class*="Surface"],[class*="surface"],[class*="panel"],[class*="Panel"]';
    const names=tokenNames.flatMap(key=>prefixes.map(prefix=>prefix+key));
    const isKnown=e=>e.matches(known)||e===app||
      !!e.querySelector('#settings-search,[class~="@container/settings-row"]')||
      e.matches('[class~="bg-token-main-surface-primary"],[class~="bg-token-main-surface-secondary"],[class~="bg-token-bg-primary"],[class~="bg-token-bg-secondary"]')||(e===app.firstElementChild&&e.contains(app.querySelector('main')))||
      !!e.closest('aside.app-shell-left-panel .sidebar-item,[data-markdown-copy="code-block"],[data-composer-surface-variant]')||
      names.filter(name=>/-(background|surface)/.test(name)).some(name=>((e.getAttribute('style')||'')+' '+(e.getAttribute('class')||'')).includes('var('+name+')')||((e.getAttribute('style')||'')+' '+(e.getAttribute('class')||'')).includes('var('+name+','));
    function scan(roots){
      if(dead)return;
      const nodes=new Set();
      for(const root of roots){if(!(root instanceof Element)||!app.contains(root))continue;if(root.matches(candidates)||records.has(root))nodes.add(root);for(const e of root.querySelectorAll(candidates+', [data-cvs-native-surface]'))nodes.add(e);}
      if(!nodes.size)return;
      // Resolve native styles synchronously before the next paint. No page content is read.
      const wasDisabled=skinStyle.disabled;skinStyle.disabled=true;fallback.disabled=true;
      const snapshots=[];
      try{
        for(const e of nodes){
          if(isKnown(e))continue;
          const native=getComputedStyle(e),bg=native.backgroundColor;
          if(surfaceAlpha(bg)<.9)continue;
          const values=names.map(name=>[name,native.getPropertyValue(name).trim()||'initial']);
          snapshots.push({e,color:native.color,scheme:native.colorScheme,values});
        }
      }finally{skinStyle.disabled=wasDisabled;fallback.disabled=false;}
      const eligible=new Set(snapshots.map(snapshot=>snapshot.e));
      for(const [e] of records)if(nodes.has(e)&&!eligible.has(e)){e.removeAttribute('data-cvs-native-surface');records.delete(e);}
      for(const snapshot of snapshots){const old=records.get(snapshot.e);snapshot.id=old?.id??String(++sequence);records.set(snapshot.e,snapshot);snapshot.e.setAttribute('data-cvs-native-surface',snapshot.id);}
      for(const [e] of records)if(!app.contains(e)||isKnown(e)){e.removeAttribute('data-cvs-native-surface');records.delete(e);}
      fallback.textContent=[...records.values()].map(({id,color,scheme,values})=>`html.cvs-active #root [data-cvs-native-surface="${id}"]{color:${color}!important;color-scheme:${scheme};${values.map(([k,v])=>`${k}:${v}!important`).join(';')}}`).join('\n');
    }
    const observer=new MutationObserver(mutations=>{
      const roots=[];for(const m of mutations){
        if(m.type==='childList')roots.push(...m.addedNodes);
        else if(m.attributeName!=='style'||records.has(m.target)||/background|--(?:app-)?color-/.test((m.oldValue||'')+';'+(m.target.getAttribute('style')||'')))roots.push(m.target);
      }
      if(roots.length)scan(roots);
      else for(const [node] of records)if(!app.contains(node)){node.removeAttribute('data-cvs-native-surface');records.delete(node);}
    });
    scan([app]);observer.observe(app,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style','data-state','aria-selected','aria-expanded','disabled','aria-disabled']});
    return {refresh:()=>scan([app]),count:()=>records.size,destroy(){dead=true;observer.disconnect();for(const node of records.keys())node.removeAttribute('data-cvs-native-surface');records.clear();fallback.remove();}};
  }
  return {resolve,regions,guard,surfaceAlpha};
}
