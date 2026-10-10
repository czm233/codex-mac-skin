import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createSkinLibraryModel} from '../src/library.mjs';
import {createAppearance} from '../src/theme.mjs';
const model=createSkinLibraryModel(createAppearance);
await fs.mkdir('work',{recursive:true});
const directory=await fs.mkdtemp(path.resolve('work/ui-acceptance-'));
try {
  const content={asset:null,profiles:{dark:createAppearance({dim:.2,colors:{accent:'#00bbff'}}).get(),light:createAppearance({textMode:'dark',dim:.6,colors:{accent:'#cc5500'}}).get()}};
  let state=model.edit(model.empty(),{type:'create',id:'first',name:'日常',content});
  state=model.edit(state,{type:'create',id:'long',name:'用于验证窄窗口中超长皮肤名称不会挤出使用状态与操作按钮'.repeat(3),content});
  state=model.edit(state,{type:'activate',id:'first'});
  state=model.edit(state,{type:'draft',id:'draft',skinId:'long',baseRevision:1,content});
  const assets=[];
  const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=','base64');
  const videoPath=path.join(directory,'preview.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x163040:s=320x180:r=15:d=1','-c:v','libx264','-pix_fmt','yuv420p',videoPath]);
  for(const [name,mime,bytes] of [['图片','image/png',picture],['视频','video/mp4',await fs.readFile(videoPath)]]){
    const hash=createHash('sha256').update(bytes).digest('hex');assets.push({hash,mime,name,base64:bytes.toString('base64')});
    state=model.edit(state,{type:'create',id:mime.split('/')[0],name,content:{...content,asset:hash}});
  }
  state=model.edit(state,{type:'create',id:'broken',name:'缺失素材',content:{...content,asset:'f'.repeat(64)}});
  for(const [name,value] of [['populated',state],['empty',model.empty()]]){
    const root=path.join(directory,name);await fs.mkdir(root);
    await fs.writeFile(path.join(root,'library.json'),JSON.stringify(value));
    await fs.mkdir(path.join(root,'assets'));
    for(const asset of assets)await fs.writeFile(path.join(root,'assets',asset.hash+'.json'),JSON.stringify(asset));
    for(const action of ['layout','preview']) {
    const report=JSON.parse(execFileSync(path.resolve('dist/Codex Skin.app/Contents/MacOS/CodexSkin'),['--smoke',action,'--acceptance-library',root],{encoding:'utf8',timeout:60000}));
    assert.equal(report.success,true);assert.equal(report.action,action);assert.equal(report.buttonsEnabled,true);
    console.log(`${name}: ${action} passed`);
    }
  }
}finally{await fs.rm(directory,{recursive:true,force:true});}
