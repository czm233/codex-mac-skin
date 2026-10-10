import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
test('site initializes controls and opens settings without module loading',async()=>{
 const ids=new Map();
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.events={};this.attrs={};this.clientWidth=1200;this.clientHeight=900;this.style={values:{},setProperty(k,v){this.values[k]=v;}};this.classList={toggle(){},add(){}};this.hidden=false;}
  set id(v){this._id=v;ids.set(v,this);}get id(){return this._id;}
  append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){this.events[k]=fn;}focus(){}
  querySelectorAll(){return [...ids.values()].flatMap(n=>n.children).filter(n=>n.dataset.copy);}
 }
 const html=await fs.readFile('docs/index.html','utf8');
 for(const match of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)){const e=new Element();e.id=match[1];e.hidden=/\bhidden\b/.test(match[0]);}
 const script=html.match(/<script src="([^"]+)" defer/)[1];
 vm.runInNewContext(await fs.readFile('docs/'+script,'utf8'),{document:{getElementById:id=>ids.get(id),createElement:tag=>new Element(tag)},matchMedia:()=>({matches:false,addEventListener(){}}),ResizeObserver:class{observe(){}},setTimeout:()=>1,clearTimeout(){},console});
 assert.equal(ids.get('skin-panel').hidden,true);
 ids.get('skin-toggle').events.click();assert.equal(ids.get('skin-panel').hidden,false);
 ids.get('scheme').events.click();assert.equal(ids.get('scheme').attrs['aria-checked'],'true');
 ids.get('copy-all').events.click();assert.match(ids.get('demo-status').textContent,/复制到 Dark/);
 ids.get('undo').events.click();assert.equal(ids.get('demo-status').textContent,'已撤销');
 const slider=ids.get('param-focusX');
 assert.equal(Number(slider.value),50);
 for(const value of [55,70,85,100]){slider.value=String(value);slider.events.input();}
 slider.events.change();
 ids.get('undo').events.click();assert.equal(Number(slider.value),50,'one undo restores entire drag');
 ids.get('redo').events.click();assert.equal(Number(slider.value),100,'one redo restores drag endpoint');
 slider.value='80';slider.events.input();slider.events.change();
 ids.get('undo').events.click();assert.equal(Number(slider.value),100,'next drag is separate');
 ids.get('undo').events.click();assert.equal(Number(slider.value),50);
 const effects={dim:'--shade',sidebar:'--fill-sidebar',composer:'--fill-composer',info:'--fill-info',code:'--fill-code',chat:'--fill-chat',bubble:'--fill-bubble',shadow:'--shadow',brightness:'--filter',contrast:'--filter',saturation:'--filter',blur:'--filter',focusX:'--scene-left',focusY:'--scene-top',speed:'--duration-sun',safeStrength:'--safe',radius:'--radius',borderWidth:'--edge'};
 const set=(key,value)=>{const e=ids.get('param-'+key);e.value=value;(e.events.input||e.events.change)();e.events.change?.();};
 for(const [key,property] of Object.entries(effects)){
  if(key==='safeStrength')set('safeArea','left');
  if(key==='focusX')set('fit','cover');
  if(key==='focusY')set('fit','contain');
  const input=ids.get('param-'+key);set(key,Number(input.min));const before=ids.get('demo').style.values[property];set(key,Number(input.max));assert.notEqual(ids.get('demo').style.values[property],before,key+' changes preview output');
 }
 set('taskMode','off');assert.equal(ids.get('demo').dataset.task,'off');
 set('safeArea','none');assert.equal(ids.get('param-safeStrength').disabled,true);
 set('textMode','dark');const lightText=ids.get('demo').style.values['--p-text'];set('textMode','light');assert.notEqual(ids.get('demo').style.values['--p-text'],lightText);
 for(const role of ['background','panel','secondaryPanel','accent','secondaryAccent','muted','highlight','text','secondaryText','border']){const input=ids.get('color-'+role);input.value='#123456';input.events.input();input.events.change();assert.equal(ids.get('demo').style.values['--p-'+role],'#123456');}
 ids.get('skin-close').events.click();assert.equal(ids.get('skin-panel').hidden,true);
});
