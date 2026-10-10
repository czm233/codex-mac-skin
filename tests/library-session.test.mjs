import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibrarySession} from '../src/library-session.mjs';
import {createSkinLibraryModel} from '../src/library.mjs';
import {createAppearance} from '../src/theme.mjs';
const model=createSkinLibraryModel(createAppearance);
const content={asset:null,profiles:{dark:createAppearance().get(),light:createAppearance({textMode:'dark'}).get()}};
const modified=dim=>({...structuredClone(content),profiles:{...structuredClone(content.profiles),dark:createAppearance({dim}).get()}});
function fixture(){
  let disk=null,visible=structuredClone(content),fail=false,backups=0;
  const adapter={read:async()=>structuredClone(disk),write:async value=>{if(fail)throw Error('磁盘满');disk=structuredClone(value);},current:async()=>structuredClone(content),backup:async()=>{backups++;},notify:()=>{},apply:async value=>{if(value.asset==='bad')throw Error('解码失败');visible=structuredClone(value);}};
  return {adapter,visible:()=>visible,fail:v=>{fail=v;},backups:()=>backups};
}
async function sync(session,state){const snapshot=await session.snapshot();const next=model.edit(state,{type:'receive',...snapshot});await session.acknowledge(next.receipts);return next;}

test('automatic polling does not rewrite unchanged drafts or lose edits made before acknowledgement',async()=>{
  const f=fixture();let writes=0;const write=f.adapter.write;
  f.adapter.write=async(...args)=>{writes++;return write(...args);};
  const page=await createLibrarySession(f.adapter);let state=await sync(page,model.empty());
  const before=writes;
  for(let i=0;i<5;i++){await page.changed(page.content());state=await sync(page,state);}
  assert.equal(writes,before);
  await page.changed(modified(.2));await page.save();
  const captured=await page.snapshot();
  await page.changed(modified(.8));await page.save();
  state=model.edit(state,{type:'receive',...captured});await page.acknowledge(state.receipts);
  assert.equal(page.status().pending,1);
  state=await sync(page,state);
  assert.equal(page.status().pending,0);assert.equal(state.skins[0].profiles.dark.dim,.8);
});

test('offline saves survive reopening, retry idempotently and maintain revision chains',async()=>{
  const f=fixture();let page=await createLibrarySession(f.adapter);
  await page.changed(modified(.2));await page.save();await page.changed(modified(.7));await page.save();
  page=await createLibrarySession(f.adapter);await page.restore();assert.equal(f.visible().profiles.dark.dim,.7);assert.equal(f.backups(),1);
  const snapshot=await page.snapshot();let state=model.edit(model.empty(),{type:'receive',...snapshot});
  assert.equal(state.skins.length,1);assert.equal(state.skins[0].profiles.dark.dim,.7);
  state=model.edit(state,{type:'receive',...snapshot});assert.equal(state.skins.length,1);assert.equal(state.skins[0].revision,3);
  await page.acknowledge(state.receipts);assert.equal(page.status().pending,0);
  await page.changed(modified(.5));await page.save();state=await sync(page,state);assert.equal(state.skins[0].profiles.dark.dim,.5);
});

test('concurrent app edit creates one conflict copy and subsequent offline saves follow it',async()=>{
  const f=fixture(),page=await createLibrarySession(f.adapter);let state=await sync(page,model.empty());
  state=model.edit(state,{type:'rename',id:state.skins[0].id,name:'App 修改'});
  await page.changed(modified(.2));await page.save();await page.changed(modified(.8));await page.save();state=await sync(page,state);
  assert.equal(state.skins.length,2);assert.equal(state.skins[0].name,'App 修改');assert.equal(state.skins[1].profiles.dark.dim,.8);
  assert.equal(page.status().skinId,state.skins[1].id);assert.match(page.status().name,/冲突/);
});

test('switch choices keep, save, discard and resume a draft without changing saved baseline',async()=>{
  const f=fixture(),page=await createLibrarySession(f.adapter);let state=await sync(page,model.empty());
  const first=state.skins[0],second={...structuredClone(first),id:'second',name:'第二套'};state=model.edit(state,{type:'create',id:'second',name:'第二套',content:second});
  await page.changed(modified(.4));await page.activate(second,'keep');await page.finalize();state=await sync(page,state);
  assert.equal(state.drafts.length,1);assert.notEqual(state.skins[0].profiles.dark.dim,.4);
  const draft=state.drafts[0];await page.activate({...first,draftId:draft.id,draft:{asset:draft.asset,profiles:draft.profiles}},'keep');await page.finalize();
  assert.equal(page.status().dirty,true);assert.equal(f.visible().profiles.dark.dim,.4);
  await page.activate(second,'save');await page.finalize();state=await sync(page,state);assert.equal(state.skins[0].profiles.dark.dim,.4);assert.equal(state.drafts.length,0);
  await page.changed(modified(.6));await page.activate(first,'discard');await page.finalize();state=await sync(page,state);assert.equal(state.drafts.length,0);
});

test('failed persistence or application restores previous content and retains recoverable draft',async()=>{
  const f=fixture(),page=await createLibrarySession(f.adapter);let state=await sync(page,model.empty());
  const before=page.content();f.fail(true);await assert.rejects(page.changed(modified(.8)),/磁盘/);assert.deepEqual(page.content(),before);f.fail(false);
  await page.changed(modified(.6));await page.restore();
  await assert.rejects(page.activate({...state.skins[0],asset:'bad'},'discard'),/解码/);assert.equal(f.visible().profiles.dark.dim,.6);assert.equal(page.status().dirty,true);
  await page.activate(state.skins[0],'discard');await page.rollback();assert.equal(page.status().dirty,true);assert.equal(f.visible().profiles.dark.dim,.6);
});


test('native JSON key ordering does not turn unchanged settings into dirty drafts',async()=>{
  const f=fixture(),page=await createLibrarySession(f.adapter);const state=await sync(page,model.empty());
  const reorder=x=>x&&typeof x==='object'?Object.fromEntries(Object.entries(x).reverse().map(([k,v])=>[k,reorder(v)])):x;
  await page.activate(reorder(state.skins[0]),'keep');await page.finalize();await page.changed(content);
  assert.equal(page.status().dirty,false);
});

test('a fresh native library can recover acknowledged current content without duplicate saves',async()=>{
  const f=fixture(),page=await createLibrarySession(f.adapter);let state=await sync(page,model.empty());
  await page.changed(modified(.2));await page.save();state=await sync(page,state);
  const recovered=await sync(page,model.empty());assert.equal(recovered.skins[0].revision,state.skins[0].revision);assert.equal(recovered.skins[0].id,state.skins[0].id);
  await page.changed(modified(.5));await page.save();const next=await sync(page,recovered);assert.equal(next.skins.length,1);assert.equal(next.skins[0].profiles.dark.dim,.5);
});


test('two page instances cannot silently overwrite the same durable draft',async()=>{
 let disk=null;const adapter={read:async()=>structuredClone(disk),current:async()=>structuredClone(content),backup:async()=>{},notify:()=>{},apply:async()=>{},write:async(next,expected)=>{if((disk?.generation||0)!==expected)throw Error('另一窗口已更新');disk=structuredClone(next);}};
 const one=await createLibrarySession(adapter),two=await createLibrarySession(adapter);
 await one.changed(modified(.2));await assert.rejects(two.changed(modified(.8)),/另一窗口/);
 assert.equal(disk.content.profiles.dark.dim,.2);
});
