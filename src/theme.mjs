// Original appearance model. Serializable factory: also runs inside the host page.
export function createAppearance(initial = {}) {
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
