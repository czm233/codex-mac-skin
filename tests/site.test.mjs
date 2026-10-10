import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
test('site initializes controls and opens settings without module loading',async()=>{
 const ids=new Map();
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.events={};this.attrs={};this.clientWidth=1200;this.clientHeight=900;this.style={values:{},setProperty(k,v){this.values[k]=v;}};this.classList={toggle(){},add(){}};this.hidden=false;}
  set id(v){this._id=v;ids.set(v,this);}get id(){return this._id;}
  replaceChildren(...nodes){this.children=[...nodes];}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attrs[k]=v;}
  getBoundingClientRect(){return {left:0,top:0};} get clientLeft(){return 0;} get clientTop(){return 0;} get offsetWidth(){return 350;} get offsetHeight(){return 600;} closest(){return null;} setPointerCapture(){}
  showModal(){this.open=true;} close(){this.open=false;this.events.close?.();}
  addEventListener(k,fn){this.events[k]=fn;}focus(){}
  querySelectorAll(){return [...ids.values()].flatMap(n=>n.children).filter(n=>n.dataset.copy);}
 }
 const html=await fs.readFile('docs/index.html','utf8');
 for(const match of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)){const e=new Element();e.id=match[1];e.hidden=/\bhidden\b/.test(match[0]);}
 const script=html.match(/<script src="([^"]+)" defer/)[1];
 const sandbox={crypto:webcrypto,document:{getElementById:id=>ids.get(id),createElement:tag=>new Element(tag)},matchMedia:()=>({matches:false,addEventListener(){}}),ResizeObserver:class{observe(){}},setTimeout:()=>1,clearTimeout(){},console};
 vm.runInNewContext(await fs.readFile('docs/'+script,'utf8'),sandbox);await sandbox.__demoLibraryReady;
 assert.equal(ids.get('skin-panel').hidden,true);
 let prevented=false;ids.get('reference-link').events.click({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(ids.get('reference-dialog').open,true);ids.get('reference-close').events.click();assert.equal(ids.get('reference-dialog').open,false);
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
 set('textMode','auto');const automaticLight=ids.get('demo').style.values['--p-text'];
 ids.get('scheme').events.click();assert.notEqual(ids.get('demo').style.values['--p-text'],automaticLight,'auto palette follows the preview scheme, not the host OS');
 ids.get('scheme').events.click();assert.equal(ids.get('demo').style.values['--p-text'],automaticLight);
 set('taskMode','off');assert.equal(ids.get('demo').dataset.task,'off');
 set('safeArea','none');assert.equal(ids.get('param-safeStrength').disabled,true);
 set('textMode','dark');const lightText=ids.get('demo').style.values['--p-text'];set('textMode','light');assert.notEqual(ids.get('demo').style.values['--p-text'],lightText);
 for(const role of ['background','panel','secondaryPanel','accent','secondaryAccent','muted','highlight','text','secondaryText','border']){const input=ids.get('color-'+role);input.value='#123456';input.events.input();input.events.change();assert.equal(ids.get('demo').style.values['--p-'+role],'#123456');}
 const header=ids.get('panel-drag'),panel=ids.get('skin-panel');
 const pointer={button:0,target:header,pointerId:1,clientX:0,clientY:0,preventDefault(){}};
 header.events.pointerdown(pointer);header.events.pointermove({...pointer,clientX:150,clientY:100});header.events.pointerup();
 assert.equal(panel.style.left,'150px');assert.equal(panel.style.top,'100px');
 ids.get('skin-close').events.click();ids.get('skin-toggle').events.click();assert.equal(panel.style.left,'150px');
 header.events.pointerdown(pointer);header.events.pointermove({...pointer,clientX:5000,clientY:5000});header.events.pointerup();
 assert.equal(panel.style.left,'838px');assert.equal(panel.style.top,'288px');
 header.events.dblclick(pointer);assert.equal(panel.style.left,'');assert.equal(panel.style.top,'');
 header.events.pointerdown({...pointer,target:{closest:()=>true}});header.events.pointermove({...pointer,clientX:150});assert.equal(panel.style.left,'');
 ids.get('skin-close').events.click();assert.equal(panel.hidden,true);
 // Shared personal-library model: save a copy, edit, switch while keeping a draft.
 ids.get('demo-copy-name').value='网页测试皮肤';await ids.get('demo-copy').events.click();
 assert.match(ids.get('demo-save-state').textContent,/网页测试皮肤/);
 set('dim',.4);await ids.get('demo-save').events.click();
 assert.match(ids.get('demo-save-state').textContent,/已保存/);
 set('dim',.7);ids.get('demo-draft-choice').value='keep';
 ids.get('demo-library').value=ids.get('demo-library').children[0].value;
 await ids.get('demo-apply').events.click();
 const draftOption=ids.get('demo-library').children.find(o=>o.value.startsWith('draft:'));
 assert.ok(draftOption,'kept draft is visible for resuming');
 ids.get('demo-library').value=draftOption.value;await ids.get('demo-apply').events.click();
 assert.equal(Number(ids.get('param-dim').value),.7);
 assert.match(ids.get('demo-save-state').textContent,/未保存草稿/);

});
