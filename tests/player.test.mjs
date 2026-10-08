import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {connect} from '../src/cdp.mjs';
import {ROOT,KEY,apply,readVideo} from '../src/cli.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('real Chromium: H.264 decode, playback, pause, loop, switch and clean restore', {timeout:60000}, async()=>{
  try {execFileSync('/usr/sbin/lsof',['-nP','-iTCP:10271','-sTCP:LISTEN'],{stdio:'ignore'});throw new Error('Test port 10271 is occupied');}
  catch(e) {if(e.status!==1) throw e;}
  const fixture=path.join(ROOT,'work/player-test.html');
  await fs.mkdir(path.dirname(fixture),{recursive:true});
  await fs.writeFile(fixture,'<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#18202d;color:#fff}#root{height:100vh;background:#18202d}main{padding:48px}button,textarea{font:20px system-ui}textarea{display:block;margin:20px 0;width:60%;height:120px}</style></head><body><div id="root"><main><h1>Codex video background — playback verification</h1><button id="test-button" onclick="this.dataset.clicked=\'yes\'">Interaction check</button><textarea aria-label="Test input"></textarea></main></div></body></html>');
  const profile=await fs.mkdtemp(path.join(ROOT,'work/chrome-'));
  const proc=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
    '--headless=new','--no-first-run','--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1','--remote-debugging-port=10271',
    `--user-data-dir=${profile}`,'--window-size=1280,800',pathToFileURL(fixture).href],{stdio:'ignore'});
  let c;
  try {
    let target;
    for(let i=0;i<40;i++) {
      try {const list=await (await fetch('http://127.0.0.1:10271/json/list')).json();target=list.find(t=>t.url===pathToFileURL(fixture).href);if(target)break;}catch{}
      await sleep(250);
    }
    assert.ok(target,'fixture target ready');c=await connect(target.webSocketDebuggerUrl);
    const bytes=await readVideo(path.join(ROOT,'media/background.mp4'));
    const original=await c.evaluate('getComputedStyle(document.getElementById("root")).backgroundColor');
    await apply(c,bytes);
    await sleep(700);
    const first=await c.evaluate(`${KEY}.status()`);
    await sleep(700);
    const second=await c.evaluate(`${KEY}.status()`);
    assert.ok(first.width===1920 && first.height===1080);assert.ok(second.currentTime>first.currentTime);assert.ok(second.decodedFrames>first.decodedFrames);assert.equal(second.bufferedChunks,0);
    await c.evaluate(`${KEY}.pause()`);const paused=await c.evaluate(`${KEY}.status().currentTime`);await sleep(350);
    assert.equal(await c.evaluate(`${KEY}.status().currentTime`),paused);
    await c.evaluate(`${KEY}.resume()`);await sleep(400);assert.ok(await c.evaluate(`${KEY}.status().currentTime`)>paused);
    await c.evaluate('document.getElementById("cvs-video").currentTime=document.getElementById("cvs-video").duration-0.15');await sleep(600);
    assert.ok(await c.evaluate(`${KEY}.status().currentTime`)<2,'loops past end');
    await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(100);
    assert.equal((await c.evaluate(`${KEY}.status()`)).paused,true);
    await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await sleep(150);
    // Synthetic visibility event verifies the handler; real macOS minimize is tested separately.
    await c.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');
    assert.equal((await c.evaluate(`${KEY}.status()`)).paused,true);
    await c.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');
    await apply(c,bytes,0.25);await sleep(200);
    assert.equal(await c.evaluate('document.querySelectorAll("#cvs-video").length'),1);
    const point=await c.evaluate('(()=>{const r=document.getElementById("test-button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    assert.equal(await c.evaluate('document.getElementById("test-button").dataset.clicked'),'yes');
    await c.evaluate('document.querySelector("textarea").focus()');await c.call('Input.insertText',{text:'Video does not block input'});
    assert.equal(await c.evaluate('document.querySelector("textarea").value'),'Video does not block input');
    const capture=await c.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(ROOT,'work/player-test.png'),Buffer.from(capture.data,'base64'));
    // Regression: background transparency must not dim the text or hide video.
    await c.evaluate(`(() => {
      document.body.style.color='inherit';
      const sidebar=document.createElement('aside');sidebar.className='app-shell-left-panel';
      const reading=document.createElement('section');reading.setAttribute('data-thread-user-message-navigation-content','');
      const paragraph=document.createElement('p');paragraph.setAttribute('data-markdown-text-style','assistant-message');paragraph.textContent='Readable video overlay';reading.append(paragraph);
      document.getElementById('root').append(sidebar,reading);
    })()`);
    for(const foreground of ['rgb(26,28,31)','rgb(235,238,244)']) {
      await c.evaluate(`document.documentElement.style.color=${JSON.stringify(foreground)}`);
      for(const density of [0,0.12,0.24]) {
        await c.evaluate(`${KEY}.setGlass(${density})`);
        const colors=await c.evaluate(`['aside.app-shell-left-panel','[data-thread-user-message-navigation-content]'].map(s=>{const st=getComputedStyle(document.querySelector(s));return {foreground:st.color,background:st.backgroundColor,opacity:st.opacity,shadow:st.textShadow}})`);
        for(const color of colors) {
          assert.equal(color.foreground,'rgb(238, 245, 252)');assert.equal(color.opacity,'1');
          assert.notEqual(color.shadow,'none');
        }
        assert.equal(colors[1].background,'rgba(0, 0, 0, 0)','chat has no opaque backing');
        assert.equal(Number(colors[0].background.match(/[\d.]+/g)[3]),density);
      }
    }
    await c.evaluate(`${KEY}.setDim(0)`);
    assert.equal(await c.evaluate('getComputedStyle(document.querySelector("[data-markdown-text-style]")).color'),'rgb(238, 245, 252)');
    await c.evaluate(`${KEY}.setFit('contain')`);
    assert.equal(await c.evaluate('getComputedStyle(document.getElementById("cvs-video")).objectFit'),'contain');
    await c.evaluate(`${KEY}.setGlass(0.12);${KEY}.setDim(0.3)`);
    const transparentShot=await c.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(ROOT,'work/transparent-player-test.png'),Buffer.from(transparentShot.data,'base64'));
    // Exercise the actual settings panel and persistence in this isolated browser.
    await apply(c,bytes,.3,{panel:true,name:'测试背景.mp4'});
    const panel='document.getElementById("cvs-controls").shadowRoot';
    const click=async id=>{
      await c.evaluate(`${panel}.getElementById(${JSON.stringify(id)}).scrollIntoView({block:"nearest"})`);
      const point=await c.evaluate(`(()=>{const r=${panel}.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
      await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    };
    await click('toggle');assert.equal(await c.evaluate(`${panel}.getElementById('panel').hidden`),false);
    await c.evaluate(`${panel}.getElementById('mode').value='dark';${panel}.getElementById('mode').dispatchEvent(new Event('change'))`);
    assert.equal(await c.evaluate('getComputedStyle(document.querySelector("[data-markdown-text-style]")).color'),'rgb(23, 35, 46)');
    await c.evaluate(`${panel}.getElementById('composer').value=37;${panel}.getElementById('composer').dispatchEvent(new Event('input'))`);
    assert.equal((await c.evaluate(`${KEY}.status()`)).composer,.37);
    assert.equal((await c.evaluate(`${KEY}.status()`)).sidebar,.12);
    await apply(c,bytes,.3,{panel:true,name:'测试背景.mp4'});
    assert.equal((await c.evaluate(`${KEY}.status()`)).textMode,'dark');
    assert.equal((await c.evaluate(`${KEY}.status()`)).composer,.37);
    assert.equal(await c.evaluate('document.querySelectorAll("#cvs-controls").length'),1);
    await assert.rejects(()=>c.evaluate(`${KEY}.settingsPanel.load(new File(['bad'],'broken.mp4',{type:'video/mp4'}))`),/编码无法播放/);
    assert.equal((await c.evaluate(`${KEY}.status()`)).active,true,'bad selection retains current video');
    await c.call('DOM.enable');
    const documentNode=await c.call('DOM.getDocument',{depth:-1,pierce:true});
    const findFile=node=>node.nodeName==='INPUT'&&node.attributes?.includes('file')?node:[...(node.children||[]),...(node.shadowRoots||[])].map(findFile).find(Boolean);
    const fileNode=findFile(documentNode.root);assert.ok(fileNode);
    await c.call('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[path.join(ROOT,'media/background.mp4')]});
    await c.evaluate(`${KEY}.settingsPanel.whenIdle()`);
    await apply(c,bytes,.3,{panel:true,name:'fallback.mp4',preferSaved:true});
    assert.equal(await c.evaluate(`${panel}.getElementById('filename').textContent`),'background.mp4','saved video restored');
    await click('toggle');
    const panelShot=await c.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(ROOT,'work/settings-panel-test.png'),Buffer.from(panelShot.data,'base64'));
    await click('reset');assert.equal((await c.evaluate(`${KEY}.status()`)).textMode,'light');assert.equal((await c.evaluate(`${KEY}.status()`)).composer,.12);
    await click('done');assert.equal(await c.evaluate(`${panel}.getElementById('panel').hidden`),true);
    await c.evaluate(`${KEY}.destroy()`);
    assert.equal(await c.evaluate('document.querySelectorAll("#cvs-video,#cvs-veil,#cvs-style").length'),0);
    assert.equal(await c.evaluate('getComputedStyle(document.getElementById("root")).backgroundColor'),original);
    assert.equal(await c.evaluate(`typeof ${KEY}`),'undefined');
    await assert.rejects(()=>apply(c,Buffer.from('not-a-video')),/Unsupported video codec/);
    assert.equal(await c.evaluate('document.querySelectorAll("#cvs-video,#cvs-veil,#cvs-style").length'),0);
    await fs.writeFile(path.join(ROOT,'work/browser-verification.json'),JSON.stringify({passed:true,first,second,checks:['decode','time and decoded frames advance','pause/resume','loop','reduced motion','synthetic visibility','replace without duplicate','real mouse and input','restore','decode error cleanup','transparent chat','panel alpha does not fade text','uncropped contain mode','settings real clicks','dark text','independent opacity','per-video settings persistence','invalid selection retains video','file picker upload','saved video restore','panel reset and close']},null,2));
  } finally {
    if(c)c.close();proc.kill('SIGTERM');await new Promise(r=>{if(proc.exitCode!==null)r();else proc.once('exit',r);});
    await fs.rm(profile,{recursive:true,force:true});
  }
});

test('media input rejects symlinks and invalid MP4 headers', async()=>{
  const invalid=path.join(ROOT,'work/invalid.mp4'), link=path.join(ROOT,'work/link.mp4');
  await fs.mkdir(path.join(ROOT,'work'),{recursive:true});await fs.writeFile(invalid,'invalid');
  await fs.rm(link,{force:true});await fs.symlink(invalid,link);
  await assert.rejects(()=>readVideo(invalid),/MP4 container/);
  await assert.rejects(()=>readVideo(link),/regular MP4/);
  await fs.rm(link);await fs.rm(invalid);
});
