import {createSkinLibraryModel} from '../src/library.mjs';
import {createAppearance} from '../src/theme.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {connect} from '../src/cdp.mjs';
import {ROOT,KEY,apply,readVideo,restoreSaved} from '../src/cli.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('real Chromium: H.264 decode, playback, pause, loop, switch and clean restore', {timeout:60000}, async()=>{
  try {execFileSync('/usr/sbin/lsof',['-nP','-iTCP:10271','-sTCP:LISTEN'],{stdio:'ignore'});throw new Error('Test port 10271 is occupied');}
  catch(e) {if(e.status!==1) throw e;}
  const fixture=path.join(ROOT,'work/player-test.html');
  await fs.mkdir(path.dirname(fixture),{recursive:true});
  await fs.writeFile(fixture,'<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><style>body{margin:0;background:#18202d;color:#fff}#root{height:100vh;background:#18202d}main{padding:48px}button,textarea{font:20px system-ui}textarea{display:block;margin:20px 0;width:60%;height:120px}</style></head><body><div id="root"><main><h1>Codex video background — playback verification</h1><button id="test-button" onclick="this.dataset.clicked=\'yes\'">Interaction check</button><textarea aria-label="Test input"></textarea></main></div></body></html>');
  const testVideo=path.join(ROOT,'work/background.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x163040:s=1920x1080:r=30:d=4','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',testVideo]);
  const profile=await fs.mkdtemp(path.join(ROOT,'work/chrome-'));
  const proc=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
    '--headless=new','--allow-file-access-from-files','--no-first-run','--no-default-browser-check',
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
    // Pin the initial accessibility preference; hosted macOS can enable reduced motion.
    // The reduce/no-preference transition is exercised explicitly below.
    await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    const bytes=await readVideo(testVideo);
    const original=await c.evaluate('getComputedStyle(document.getElementById("root")).backgroundColor');
    await apply(c,bytes);
    const waitForPlayback=async predicate=>{
      let status;
      for(let i=0;i<40;i++){
        status=await c.evaluate(`${KEY}.status()`);
        if(predicate(status))return status;
        await sleep(100);
      }
      assert.fail(`Playback did not progress: ${JSON.stringify(status)}`);
    };
    const first=await waitForPlayback(s=>s.width===1920&&s.height===1080&&s.decodedFrames>0);
    const second=await waitForPlayback(s=>s.currentTime>first.currentTime&&s.decodedFrames>first.decodedFrames);
    assert.equal(second.bufferedChunks,0);
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
    // Host sidebar decoration inherits its background and extends into chat.
    await c.evaluate(`(()=>{const s=document.createElement('style');s.id='sidebar-decoration-fixture';s.textContent='aside.app-shell-left-panel{position:relative;width:280px}aside.app-shell-left-panel::after{content:"";position:absolute;right:-20px;top:0;bottom:0;width:20px;background:inherit}';document.head.append(s);})()`);
    for(const mode of ['light','dark']) {
    await c.evaluate(`${KEY}.setTextMode('${mode}')`);
    for(const width of [240,327,410]) {
      for(const alpha of [0,.41,1]) {
        await c.evaluate(`document.querySelector('aside.app-shell-left-panel').style.width='${width}px';${KEY}.setPanel('sidebar',${alpha})`);
        const edge=await c.evaluate(`(()=>{const a=document.querySelector('aside.app-shell-left-panel');return {width:a.getBoundingClientRect().width,bg:getComputedStyle(a,'::after').backgroundColor,overflow:getComputedStyle(a).overflow};})()`);
        assert.equal(Number(edge.bg.match(/[\d.]+/g)[3]),0,'sidebar extension must not inherit tint');
        assert.equal(edge.width,width);assert.equal(edge.overflow,'visible','resize affordance remains unclipped');
      }
    }
    }
    await c.evaluate(`${KEY}.setTextMode('light')`);
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
    // Codex mounts browser views outside #root. A transparent raised root must
    // not intercept a later portal. Use a real iframe and pointer hit testing.
    await c.evaluate(`new Promise(resolve=>{
      const portal=document.createElement('div');portal.id='browser-portal-fixture';
      portal.style.cssText='position:fixed;inset:0;pointer-events:none';
      const frame=document.createElement('iframe');frame.id='browser-frame-fixture';
      frame.style.cssText='position:absolute;right:0;top:80px;width:42%;height:300px;border:0;pointer-events:auto';
      frame.srcdoc='<html><body><button id="inside" onclick="this.dataset.clicked=String(Number(this.dataset.clicked||0)+1)">Browser action</button><input id="entry" aria-label="Browser input"></body></html>';
      frame.onload=resolve;portal.append(frame);document.body.append(portal);
    })`);
    for(const mode of ['light','dark']) {
      await c.evaluate(`${KEY}.setTextMode('${mode}');${KEY}.setDim(.5)`);
      const point=await c.evaluate(`(()=>{const f=document.getElementById('browser-frame-fixture');const r=f.getBoundingClientRect(),b=f.contentDocument.getElementById('inside').getBoundingClientRect();const x=r.x+b.x+b.width/2,y=r.y+b.y+b.height/2;return {x,y,hit:document.elementFromPoint(x,y)?.id};})()`);
      assert.equal(point.hit,'browser-frame-fixture','native browser portal remains above the main app');
      await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y});
      await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y});
    }
    assert.equal(await c.evaluate(`document.getElementById('browser-frame-fixture').contentDocument.getElementById('inside').dataset.clicked`),'2');
    const inputPoint=await c.evaluate(`(()=>{const f=document.getElementById('browser-frame-fixture'),r=f.getBoundingClientRect(),b=f.contentDocument.getElementById('entry').getBoundingClientRect();return {x:r.x+b.x+10,y:r.y+b.y+10};})()`);
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...inputPoint});
    await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...inputPoint});
    await c.call('Input.insertText',{text:'portal input works'});
    assert.equal(await c.evaluate(`document.getElementById('browser-frame-fixture').contentDocument.getElementById('entry').value`),'portal input works');
    await c.evaluate(`document.getElementById('browser-portal-fixture').remove();${KEY}.setTextMode('light');${KEY}.setDim(.3)`);
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
    // Transparent space below the expanded panel must not eat underlying clicks.
    const gap=await c.evaluate(`(()=>{const h=document.getElementById('cvs-controls'),u=h.shadowRoot,r=u.getElementById('panel').getBoundingClientRect(),t=u.getElementById('toggle').getBoundingClientRect();return {x:r.left+5,y:t.top+t.height/2};})()`);
    assert.notEqual(await c.evaluate(`document.elementFromPoint(${gap.x},${gap.y})?.id`),'cvs-controls','empty settings area passes through');
    // Independent body portals remain clickable while settings are open.
    for(const role of ['menu','listbox','dialog']) {
      await c.evaluate(`(()=>{const p=document.createElement('div');p.id='overlay-test';p.setAttribute('role','${role}');p.style.cssText='position:fixed;right:18px;bottom:18px;z-index:50;padding:20px';const b=document.createElement('button');b.id='overlay-action';b.textContent='Overlay action';b.onclick=()=>b.dataset.clicked='yes';p.append(b);document.body.append(p);})()`);
      const q=await c.evaluate(`(()=>{const r=document.getElementById('overlay-action').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});
      await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});
      assert.equal(await c.evaluate(`document.getElementById('overlay-action').dataset.clicked`),'yes',role+' portal click');
      await c.evaluate(`document.getElementById('overlay-test').remove()`);
    }
    // Native modal top layer must stay above the skin controls, including overlap.
    await c.evaluate(`(()=>{const d=document.createElement('dialog');d.id='modal-test';d.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0';document.body.append(d);d.showModal();})()`);
    assert.equal(await c.evaluate(`document.elementFromPoint(${gap.x},${gap.y})?.id`),'modal-test');
    await c.evaluate(`document.getElementById('modal-test').close();document.getElementById('modal-test').remove()`);

    await c.evaluate(`${panel}.getElementById('mode').value='dark';${panel}.getElementById('mode').dispatchEvent(new Event('change'))`);
    assert.equal(await c.evaluate('getComputedStyle(document.querySelector("[data-markdown-text-style]")).color'),'rgb(23, 35, 46)');
    await c.evaluate(`${panel}.getElementById('composer').value=37;${panel}.getElementById('composer').dispatchEvent(new Event('input'))`);
    assert.equal((await c.evaluate(`${KEY}.status()`)).composer,.63);
    assert.equal((await c.evaluate(`${KEY}.status()`)).sidebar,.12);
    await apply(c,bytes,.3,{panel:true,name:'测试背景.mp4'});
    assert.equal((await c.evaluate(`${KEY}.status()`)).textMode,'dark');
    assert.equal((await c.evaluate(`${KEY}.status()`)).composer,.63);
    assert.equal(await c.evaluate('document.querySelectorAll("#cvs-controls").length'),1);
    await assert.rejects(()=>c.evaluate(`${KEY}.settingsPanel.load(new File(['bad'],'broken.mp4',{type:'video/mp4'}))`),/编码无法播放/);
    assert.equal((await c.evaluate(`${KEY}.status()`)).active,true,'bad selection retains current video');
    await c.call('DOM.enable');
    const documentNode=await c.call('DOM.getDocument',{depth:-1,pierce:true});
    const findFile=node=>node.nodeName==='INPUT'&&node.attributes?.includes('file')?node:[...(node.children||[]),...(node.shadowRoots||[])].map(findFile).find(Boolean);
    const fileNode=findFile(documentNode.root);assert.ok(fileNode);
    await c.call('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[testVideo]});
    await c.evaluate(`${KEY}.settingsPanel.whenIdle()`);
    await apply(c,bytes,.3,{panel:true,name:'fallback.mp4',preferSaved:true});
    assert.equal(await c.evaluate(`${panel}.getElementById('filename').textContent`),'background.mp4','saved video restored');
    await click('toggle');
    const dragStart=await c.evaluate(`(()=>{const r=${panel}.getElementById('panel').getBoundingClientRect();return {x:r.x,y:r.y}})()`);
    await c.evaluate(`${panel}.getElementById('panel').scrollTop=0`);
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',x:dragStart.x+45,y:dragStart.y+25,button:'left',clickCount:1});
    await c.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x-155,y:dragStart.y+65,button:'left',buttons:1});
    await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragStart.x-155,y:dragStart.y+65,button:'left',clickCount:1});
    assert.ok(await c.evaluate(`${panel}.getElementById('panel').getBoundingClientRect().left < ${dragStart.x}-100`),'settings panel can be dragged');
    await click('close');await click('toggle');
    assert.ok(await c.evaluate(`${panel}.getElementById('panel').getBoundingClientRect().left < ${dragStart.x}-100`),'reopening keeps position');
    await c.evaluate(`${panel}.getElementById('panel').querySelector('header').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);
    const panelShot=await c.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(ROOT,'work/settings-panel-test.png'),Buffer.from(panelShot.data,'base64'));
    await c.evaluate(`${panel}.querySelector('[data-sync="dim"]').scrollIntoView({block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const copyRect=await c.evaluate(`(()=>{const r=${panel}.querySelector('[data-sync="dim"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await c.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10});
    await c.call('Input.dispatchMouseEvent',{type:'mouseMoved',...copyRect});
    for(let i=0;i<10&&await c.evaluate(`${panel}.getElementById('copy-tooltip').hidden`);i++)await sleep(100);
    assert.equal(await c.evaluate(`${panel}.getElementById('copy-tooltip').hidden`),false,'copy tooltip appears promptly');
    assert.match(await c.evaluate(`${panel}.getElementById('copy-tooltip').textContent`),/复制到 Light 方案/);
    assert.equal(await c.evaluate(`${panel}.querySelector('[data-sync="dim"]').hasAttribute('title')`),false,'no delayed native tooltip');
    await c.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10});
    assert.equal(await c.evaluate(`${panel}.getElementById('copy-tooltip').hidden`),true);
    await click('help-toggle');
    assert.equal(await c.evaluate(`${panel}.getElementById('help').matches(':modal')`),true,'help opens as a modal');
    await fs.writeFile(path.join(ROOT,'work/help-modal.png'),Buffer.from((await c.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await c.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await c.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    assert.equal(await c.evaluate(`${panel}.getElementById('help').open`),false);
    assert.equal(await c.evaluate(`${panel}.getElementById('panel').hidden`),false,'closing help keeps settings open');
    assert.equal(await c.evaluate(`${panel}.activeElement.id`),'help-toggle','focus returns to help button');
    await click('help-toggle');await click('help-close');
    assert.equal(await c.evaluate(`${panel}.getElementById('help').open`),false);
    await click('reset');assert.equal((await c.evaluate(`${KEY}.status()`)).textMode,'light');assert.equal((await c.evaluate(`${KEY}.status()`)).composer,.12);
    await click('close');assert.equal(await c.evaluate(`${panel}.getElementById('panel').hidden`),true);
    // Transparency is inverse alpha in the UI, without migrating stored configurations.
    for(const key of ['sidebar','composer','info','code','chat','bubble']){
      for(const value of [0,100]){
        await c.evaluate(`${panel}.getElementById('${key}').value=${value};${panel}.getElementById('${key}').dispatchEvent(new Event('input'))`);
        assert.equal((await c.evaluate(`${KEY}.getSettings()`))[key],1-value/100);
        assert.equal(await c.evaluate(`${panel}.getElementById('${key}-value').textContent`),value+'%');
      }
    }
    // Composer and transcript share a scroller. Transparency must reveal only video.
    await c.evaluate(`(()=>{const host=document.createElement('div');host.id='clip-fixture';host.style.cssText='position:fixed;left:0;top:0;width:500px;height:400px;z-index:15';host.innerHTML='<div class="thread-scroll-container" style="height:100%;overflow:auto"><div data-thread-user-message-navigation-content id="clip-transcript" style="height:1200px;background:#863b63;clip-path:inset(0px)">Chat content</div><div data-thread-scroll-footer style="position:absolute;bottom:0;left:0;width:100%"><div data-composer-surface-variant id="clip-composer" style="height:80px"><textarea id="clip-input" style="width:200px;height:30px;margin:0"></textarea></div></div></div>';document.getElementById('root').append(host);window.clipTestTranscript=document.getElementById('clip-transcript');window.clipTestScroll=host.firstElementChild;${KEY}.setSettings({composer:0});})()`);
    for(const [height,scrollTop] of [[80,0],[160,250],[110,650]]){
      await c.evaluate(`document.getElementById('clip-composer').style.height='${height}px';document.querySelector('#clip-fixture .thread-scroll-container').scrollTop=${scrollTop}`);
      await sleep(100);
      const geometry=await c.evaluate(`(()=>{const t=document.getElementById('clip-transcript'),c=document.getElementById('clip-composer'),r=window.clipTestScroll.getBoundingClientRect(),cr=c.getBoundingClientRect();return {bottom:r.bottom,top:cr.top,above:document.elementsFromPoint(300,cr.top-5).some(e=>e===t||t.contains(e)),below:document.elementsFromPoint(300,cr.top+5).some(e=>e===t||t.contains(e)),composerClip:getComputedStyle(c).clipPath,bg:getComputedStyle(c).backgroundColor};})()`);
      assert.equal(geometry.bottom,geometry.top,'real scroll viewport ends above the input');
      assert.equal(geometry.above,true);assert.equal(geometry.below,false);
      assert.equal(geometry.composerClip,'none');assert.equal(Number(geometry.bg.match(/[\d.]+/g)[3]),0);
    }
    // Deliberately do not yield an animation frame: scrolling cannot outrun CSS overflow.
    assert.equal(await c.evaluate(`(()=>{const s=window.clipTestScroll,t=window.clipTestTranscript;for(let i=0;i<80;i++){s.scrollTop=(i%2)*850;const y=document.getElementById('clip-composer').getBoundingClientRect().top+5;if(document.elementsFromPoint(300,y).some(e=>e===t||t.contains(e)))return false;}return true;})()`),true);
    await c.evaluate(`window.clipTestScroll.scrollTop=200;document.getElementById('clip-composer').style.height='140px'`);
    await sleep(100);
    assert.equal(await c.evaluate(`window.clipTestScroll.scrollTop`),200,'resizing composer preserves reading position');
    await c.evaluate(`window.clipTestScroll.scrollTop=window.clipTestScroll.scrollHeight;document.getElementById('clip-composer').style.height='110px'`);await sleep(100);
    assert.equal(await c.evaluate(`Math.abs(window.clipTestScroll.scrollHeight-window.clipTestScroll.clientHeight-window.clipTestScroll.scrollTop)<2`),true,'last message remains reachable after resizing');
    await c.evaluate(`window.clipTestScroll.style.display='flex';window.clipTestScroll.style.flexDirection='column-reverse';window.clipTestTranscript.style.flexShrink='0';window.clipTestScroll.scrollTop=-300`);
    const reverseTop=await c.evaluate(`window.clipTestTranscript.getBoundingClientRect().top`);
    await c.evaluate(`document.getElementById('clip-composer').style.height='160px'`);await sleep(100);
    assert.equal(await c.evaluate(`window.clipTestTranscript.getBoundingClientRect().top`),reverseTop,'native reverse-flow history stays in place');
    await c.evaluate(`window.clipTestScroll.scrollTop=0;document.getElementById('clip-composer').style.height='110px'`);await sleep(100);
    assert.equal(await c.evaluate(`window.clipTestScroll.scrollTop`),0,'native reverse-flow latest stays anchored');
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:50,y:300});
    await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:50,y:300});
    await c.call('Input.insertText',{text:'Composer remains editable'});
    assert.equal(await c.evaluate(`document.getElementById('clip-input').value`),'Composer remains editable');
    const clipShot=await c.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(ROOT,'work/composer-clip-test.png'),Buffer.from(clipShot.data,'base64'));
    await c.evaluate(`document.getElementById('clip-fixture').remove()`);await sleep(100);
    assert.equal(await c.evaluate(`window.clipTestTranscript.style.clipPath`),'inset(0px)','transcript clipping is untouched');
    assert.equal(await c.evaluate(`window.clipTestScroll.style.height`),'100%','original viewport restored on cleanup');
    await c.evaluate(`delete window.clipTestTranscript;delete window.clipTestScroll`);
    // Match the native settings card's inline token and settings-row structure.
    await c.evaluate(`(()=>{const card=document.createElement('div');card.id='settings-fixture';card.className='rounded-2xl';card.style.cssText='background-color:var(--color-background-panel,var(--color-background-primary-soft-alpha));position:fixed;top:20px;left:20px;width:360px;padding:16px;--color-background-panel:white';card.innerHTML='<div class="@container/settings-row"><span style="color:var(--color-text-primary)">Settings label</span><button id="settings-dropdown" aria-haspopup="menu" style="background:white;color:var(--color-text-primary)">Select</button><button id="settings-switch" role="switch" aria-checked="false">Toggle</button></div>';document.getElementById('root').append(card);card.querySelector('#settings-switch').onclick=e=>e.target.setAttribute('aria-checked','true');card.querySelector('#settings-dropdown').onclick=e=>e.target.dataset.open='true';})()`);
    for(const textMode of ['light','dark'])for(const alpha of [0,.45,1]){
      await c.evaluate(`${KEY}.setSettings({textMode:'${textMode}',settings:${alpha}})`);
      const card=await c.evaluate(`(()=>{const e=document.getElementById('settings-fixture'),s=getComputedStyle(e);return {bg:s.backgroundColor,opacity:s.opacity,text:getComputedStyle(e.querySelector('span')).color};})()`);
      assert.equal(Number(card.bg.match(/[\d.]+/g)[3]??1),alpha,'settings opacity follows its own control');
      assert.equal(card.opacity,'1','settings text remains opaque');
      const dropdown=await c.evaluate(`(()=>{const s=getComputedStyle(document.getElementById('settings-dropdown'));return {bg:s.backgroundColor,text:s.color};})()`);
      assert.equal(dropdown.bg,textMode==='light'?'rgb(19, 28, 40)':'rgb(237, 243, 248)');
      assert.equal(dropdown.text,textMode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');
      assert.equal(card.text,textMode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');
    }
    const settingsPoint=await c.evaluate(`(()=>{const r=document.getElementById('settings-switch').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...settingsPoint});
    await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...settingsPoint});
    assert.equal(await c.evaluate(`document.getElementById('settings-switch').getAttribute('aria-checked')`),'true','settings controls still receive clicks');
    const dropdownPoint=await c.evaluate(`(()=>{const r=document.getElementById('settings-dropdown').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...dropdownPoint});
    await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...dropdownPoint});
    assert.equal(await c.evaluate(`document.getElementById('settings-dropdown').dataset.open`),'true');
    await c.evaluate(`document.getElementById('settings-fixture').remove();${KEY}.resetSettings()`);
    await c.evaluate(`(()=>{const b=document.createElement('div');b.id='code-fixture';b.setAttribute('data-markdown-copy','code-block');b.style.cssText='position:fixed;left:10px;top:10px;width:400px';b.innerHTML='<div data-markdown-copy="exclude" style="background:white;background-image:linear-gradient(white,white)">Bash <button id="code-copy">Copy</button></div><div style="overflow:auto"><pre><code>node <span style="color:rgb(42, 170, 100)">example.mjs</span></code></pre></div>';document.getElementById('root').append(b);b.querySelector('button').onclick=e=>e.target.dataset.clicked='yes';})()`);
    for(const mode of ['light','dark'])for(const alpha of [0,.65,1]){
      await c.evaluate(`${KEY}.setSettings({textMode:'${mode}',code:${alpha}})`);
      const v=await c.evaluate(`(()=>{const b=document.getElementById('code-fixture'),h=b.firstElementChild;return {bg:getComputedStyle(b).backgroundColor,opacity:getComputedStyle(b).opacity,header:getComputedStyle(h).backgroundColor,gradient:getComputedStyle(h).backgroundImage,text:getComputedStyle(b.querySelector('code')).color,syntax:getComputedStyle(b.querySelector('span')).color};})()`);
      assert.equal(Number(v.bg.match(/[\d.]+/g)[3]??1),alpha);assert.equal(v.opacity,'1');assert.equal(v.header,'rgba(0, 0, 0, 0)');assert.equal(v.gradient,'none');assert.equal(v.text,mode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');assert.equal(v.syntax,'rgb(42, 170, 100)');
    }
    const codePoint=await c.evaluate(`(()=>{const r=document.getElementById('code-copy').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...codePoint});await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...codePoint});
    assert.equal(await c.evaluate(`document.getElementById('code-copy').dataset.clicked`),'yes');
    await c.evaluate(`document.getElementById('code-fixture').remove();${KEY}.resetSettings()`);
    // Native side-panel tool tiles use semantic soft-alpha tokens, not surface tokens.
    await c.evaluate(`(()=>{const tile=document.createElement('div');tile.id='tool-tile';tile.style.cssText='position:fixed;top:10px;left:10px;width:300px;background:var(--color-background-primary-soft-alpha);color:var(--color-text-primary)';tile.innerHTML='<button id="tool-action" style="background:transparent;color:inherit">Open tool</button>';document.querySelector('main').append(tile);tile.querySelector('button').onclick=e=>e.target.dataset.clicked='yes';})()`);
    for(const textMode of ['light','dark']){
      await c.evaluate(`${KEY}.setSettings({textMode:'${textMode}'})`);
      const tile=await c.evaluate(`(()=>{const s=getComputedStyle(document.getElementById('tool-tile'));return {bg:s.backgroundColor,color:s.color};})()`);
      assert.equal(tile.bg,textMode==='light'?'rgba(19, 28, 40, 0.72)':'rgba(237, 243, 248, 0.72)');
      assert.equal(tile.color,textMode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');
    }
    const toolPoint=await c.evaluate(`(()=>{const r=document.getElementById('tool-action').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...toolPoint});await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...toolPoint});
    assert.equal(await c.evaluate(`document.getElementById('tool-action').dataset.clicked`),'yes');
    await c.evaluate(`document.getElementById('tool-tile').remove();${KEY}.resetSettings()`);
    await c.evaluate(`(()=>{const e=document.createElement('textarea');e.id='personal-agents-editor';e.value='Test-only instructions';e.placeholder='Instructions';e.style.cssText='position:fixed;top:10px;left:10px;width:300px;height:80px;background:white';document.querySelector('main').append(e);})()`);
    for(const textMode of ['light','dark']){
      await c.evaluate(`${KEY}.setSettings({textMode:'${textMode}',settings:.65})`);
      const v=await c.evaluate(`(()=>{const e=document.getElementById('personal-agents-editor'),s=getComputedStyle(e);return {bg:s.backgroundColor,text:s.color,caret:s.caretColor,value:e.value,placeholder:getComputedStyle(e,'::placeholder').color};})()`);
      assert.equal(v.bg,textMode==='light'?'rgba(19, 28, 40, 0.65)':'rgba(237, 243, 248, 0.65)');
      assert.equal(v.text,textMode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');assert.equal(v.caret,v.text);assert.equal(v.value,'Test-only instructions');
    }
    await c.evaluate(`document.getElementById('personal-agents-editor').focus();document.getElementById('personal-agents-editor').select()`);
    await c.call('Input.insertText',{text:'Editable test'});
    assert.equal(await c.evaluate(`document.getElementById('personal-agents-editor').value`),'Editable test');
    await c.evaluate(`document.getElementById('personal-agents-editor').remove();${KEY}.resetSettings()`);
    await c.evaluate(`(()=>{const b=document.createElement('div');b.id='search-fixture';b.className='bg-page-search';b.style.cssText='background:var(--color-background-page-search);position:fixed;left:10px;top:10px';b.innerHTML='<input id="search-test" placeholder="Search shortcuts" style="background:transparent">';document.querySelector('main').append(b);})()`);
    for(const textMode of ['light','dark']){
      await c.evaluate(`${KEY}.setSettings({textMode:'${textMode}'})`);
      const search=await c.evaluate(`(()=>{const b=document.getElementById('search-fixture'),e=b.firstElementChild,s=getComputedStyle(e);return {bg:getComputedStyle(b).backgroundColor,text:s.color,caret:s.caretColor,placeholder:getComputedStyle(e,'::placeholder').color};})()`);
      assert.equal(search.bg,textMode==='light'?'rgba(19, 28, 40, 0.85)':'rgba(237, 243, 248, 0.85)');
      assert.equal(search.text,textMode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');assert.equal(search.caret,search.text);
      assert.equal(search.placeholder,textMode==='light'?'rgb(187, 204, 219)':'rgb(68, 88, 106)');
    }
    await c.evaluate(`document.getElementById('search-test').focus()`);await c.call('Input.insertText',{text:'shortcut'});
    assert.equal(await c.evaluate(`document.getElementById('search-test').value`),'shortcut');
    await c.evaluate(`document.getElementById('search-fixture').remove();${KEY}.resetSettings()`);
    await c.evaluate(`(()=>{const table=document.createElement('table');table.id='permissions-fixture';table.innerHTML='<thead><tr><th style="background:var(--color-surface-elevated-secondary)">Site</th></tr></thead><tbody><tr><td style="background:var(--color-background-panel,var(--color-background-primary-soft-alpha));color:var(--color-text-primary)">Default</td></tr></tbody>';document.querySelector('main').append(table);})()`);
    for(const textMode of ['light','dark'])for(const alpha of [0,.6,1]){
      await c.evaluate(`${KEY}.setSettings({textMode:'${textMode}',settings:${alpha}})`);
      const v=await c.evaluate(`(()=>{const s=getComputedStyle(document.querySelector('#permissions-fixture td'));return {bg:s.backgroundColor,text:s.color};})()`);
      assert.equal(Number(v.bg.match(/[\d.]+/g)[3]??1),alpha);assert.equal(v.text,textMode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');
      if(alpha>0)assert.ok(v.bg.includes(textMode==='light'?'19, 28, 40':'237, 243, 248'));
    }
    await c.evaluate(`document.getElementById('permissions-fixture').remove();${KEY}.resetSettings()`);
    await c.evaluate(`(()=>{const host=document.createElement('section');host.id='git-fields';host.innerHTML='<input class="bg-primary-soft" value="test-prefix/" placeholder="Prefix"><textarea class="bg-primary-soft" placeholder="Instructions">Test instructions</textarea>';for(const e of host.children)e.style.cssText='background:var(--color-background-primary-soft);color:var(--color-text-primary)';document.querySelector('main').append(host);})()`);
    for(const textMode of ['light','dark']){
      await c.evaluate(`${KEY}.setSettings({textMode:'${textMode}'})`);
      const values=await c.evaluate(`Array.from(document.querySelector('#git-fields').children).map(e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,color:s.color,caret:s.caretColor,placeholder:getComputedStyle(e,'::placeholder').color,value:e.value};})`);
      for(const v of values){assert.equal(v.bg,textMode==='light'?'rgba(19, 28, 40, 0.85)':'rgba(237, 243, 248, 0.85)');assert.equal(v.color,textMode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');assert.equal(v.caret,v.color);assert.equal(v.placeholder,textMode==='light'?'rgb(187, 204, 219)':'rgb(68, 88, 106)');}
      assert.equal(values[0].value,'test-prefix/');assert.equal(values[1].value,'Test instructions');
    }
    await c.evaluate(`document.querySelector('#git-fields textarea').focus();document.querySelector('#git-fields textarea').select()`);await c.call('Input.insertText',{text:'Test editing'});assert.equal(await c.evaluate(`document.querySelector('#git-fields textarea').value`),'Test editing');
    await c.evaluate(`document.getElementById('git-fields').remove();${KEY}.resetSettings()`);
    // Folder labels retain the same palette across hover, selected and faded native states.
    await c.evaluate(`(()=>{const a=document.createElement('aside');a.id='folder-regression';a.className='app-shell-left-panel';a.innerHTML='<div id="folder-row-fixture" class="sidebar-item group/folder-row bg-fixture"><span class="text-default">Folder</span></div>';document.getElementById('root').append(a);const css=document.createElement('style');css.id='folder-regression-css';css.textContent='.bg-fixture{color:black}.bg-fixture:hover,.bg-fixture.selected{background:rgba(26,28,31,.055)}.bg-fixture.faded{color:gray;opacity:.7}.bg-fixture .text-default{color:blue}';document.head.append(css)})()`);
    await c.call('DOM.enable');await c.call('CSS.enable');
    const tree=await c.call('DOM.getDocument');
    const folderNode=await c.call('DOM.querySelector',{nodeId:tree.root.nodeId,selector:'#folder-row-fixture'});
    for(const mode of ['light','dark'])for(const state of ['hover','selected','faded','normal']){
      await c.evaluate(`${KEY}.setSettings({textMode:'${mode}'});document.getElementById('folder-row-fixture').className='sidebar-item group/folder-row bg-fixture ${state}'`);
      await c.call('CSS.forcePseudoState',{nodeId:folderNode.nodeId,forcedPseudoClasses:state==='hover'?['hover']:[]});await sleep(40);
      const v=await c.evaluate(`(()=>{const e=document.getElementById('folder-row-fixture');return {color:getComputedStyle(e.firstElementChild).color,opacity:getComputedStyle(e).opacity,guard:e.hasAttribute('data-cvs-native-surface')}})()`);
      assert.equal(v.color,mode==='light'?'rgb(238, 245, 252)':'rgb(23, 35, 46)');assert.equal(v.opacity,'1');assert.equal(v.guard,false);
    }
    await c.evaluate(`document.getElementById('folder-regression').remove();document.getElementById('folder-regression-css').remove();${KEY}.resetSettings()`);
    // Show-more style auxiliary actions must stay stable during hover and DOM churn.
    await c.evaluate(`(()=>{const css=document.createElement('style');css.id='transition-regression-css';css.textContent='#root{--color-text-secondary:rgb(55,55,55)}#transition-regression{background:transparent;border:0;color:var(--color-text-secondary);transition:color .15s,opacity .15s}#transition-regression:hover{color:white}';document.head.append(css);const a=document.createElement('aside');a.id='transition-aside';a.className='app-shell-left-panel';a.innerHTML='<button id="transition-regression" data-color="secondary" data-variant="transparent">Show more</button>';document.getElementById('root').append(a)})()`);await sleep(200);
    const transitionTree=await c.call('DOM.getDocument');const transitionNode=await c.call('DOM.querySelector',{nodeId:transitionTree.root.nodeId,selector:'#transition-regression'});
    for(const mode of ['light','dark']){
      await c.evaluate(`${KEY}.setSettings({textMode:'${mode}'})`);
      for(let frame=0;frame<8;frame++){
        await c.call('CSS.forcePseudoState',{nodeId:transitionNode.nodeId,forcedPseudoClasses:frame%2?['hover']:[]});
        await c.evaluate(`document.getElementById('transition-regression').classList.toggle('sample-trigger')`);await sleep(25);
        assert.equal(await c.evaluate(`getComputedStyle(document.getElementById('transition-regression')).color`),mode==='light'?'rgb(215, 227, 238)':'rgb(48, 66, 82)','auxiliary action foreground must stay stable');
      }
    }
    await c.evaluate(`document.getElementById('transition-aside').remove();document.getElementById('transition-regression-css').remove();${KEY}.resetSettings()`);
    // Settings must match native styles exactly, independently of the active skin palette.
    await c.evaluate(`(()=>{const e=document.createElement('main');e.id='settings-scene-fixture';e.style.cssText='background:white;color:rgb(22,22,22)';e.innerHTML='<input id="settings-search"><div class="rounded-2xl" style="background:rgb(240,240,240)"><span>Native setting</span></div>';document.getElementById('root').append(e)})()`);await sleep(80);
    for(const mode of ['light','dark']){
      await c.evaluate(`${KEY}.setSettings({textMode:'${mode}',settings:0})`);
      const v=await c.evaluate(`(()=>{const e=document.getElementById('settings-scene-fixture');return {bg:getComputedStyle(e).backgroundColor,card:getComputedStyle(e.querySelector('.rounded-2xl')).backgroundColor,text:getComputedStyle(e.querySelector('span')).color,enabled:document.documentElement.classList.contains('cvs-active'),video:getComputedStyle(document.getElementById('cvs-video')).display,paused:document.getElementById('cvs-video').paused}})()`);
      assert.equal(v.bg,'rgb(255, 255, 255)');assert.equal(v.card,'rgb(240, 240, 240)');assert.equal(v.text,'rgb(22, 22, 22)');assert.equal(v.enabled,false);assert.equal(v.video,'none');assert.equal(v.paused,true);
    }
    await c.evaluate(`document.getElementById('settings-search').remove();const nav=document.createElement('button');nav.setAttribute('data-settings-panel-slug','connections');document.getElementById('settings-scene-fixture').append(nav)`);await sleep(80);
    assert.equal(await c.evaluate(`document.documentElement.classList.contains('cvs-active')`),false,'settings navigation also identifies pages without search');
    await c.evaluate(`document.getElementById('settings-scene-fixture').remove();${KEY}.resetSettings()`);await sleep(80);
    assert.equal(await c.evaluate(`document.documentElement.classList.contains('cvs-active')`),true,'chat skin resumes on leaving settings');
    assert.notEqual(await c.evaluate(`getComputedStyle(document.getElementById('cvs-video')).display`),'none');
    await c.evaluate(`${KEY}.settingsPanel.show()`);
    const nativeFixture=path.join(ROOT,'work/app-initial-theme-fixture.js');
    await fs.writeFile(nativeFixture,`export const Tnt={settings:{read:async()=>({configured:document.documentElement.dataset.theme}),write:async(key,value)=>{if(key!=='appearanceTheme')throw Error('Unexpected setting');document.documentElement.dataset.theme=value;}}};`);
    await c.evaluate(`(()=>{const link=document.createElement('link');link.rel='modulepreload';link.href=${JSON.stringify(pathToFileURL(nativeFixture).href)};document.head.append(link)})()`);
    // Two independent profiles: per-item copy, full copy, cross-profile undo, and v2 export.
    await c.evaluate(`${KEY}.settingsPanel.importConfig(JSON.stringify({format:'codex-video-skin',version:1,settings:{composer:.2,textMode:'light',colors:{}}}))`);
    await c.evaluate(`${panel}.querySelector('[data-sync="composer"]').click()`);
    let pair=JSON.parse(await c.evaluate(`${KEY}.settingsPanel.exportConfig()`));
    assert.equal(pair.version,2);assert.equal(pair.profiles.light.composer,.2);
    await c.evaluate(`${panel}.getElementById('variant').click()`);await sleep(150);
    assert.equal(await c.evaluate(`document.documentElement.dataset.theme`),'light');
    assert.equal(await c.evaluate(`${panel}.getElementById('variant').getAttribute('aria-checked')`),'true');
    assert.equal(await c.evaluate(`${panel}.getElementById('feedback-text').textContent`),'已切换到 Light');
    assert.equal(await c.evaluate(`(()=>{const t=${panel}.getElementById('feedback'),r=t.getBoundingClientRect(),h=t.closest('header').getBoundingClientRect();return !t.hidden&&r.top>=h.top&&r.bottom<=h.bottom&&r.right<=h.right})()`),true,'switch success message belongs to settings header');
    await fs.writeFile(path.join(ROOT,'work/dual-light-panel.png'),Buffer.from((await c.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.equal(await c.evaluate(`${KEY}.status().composer`),.2);
    await c.evaluate(`${panel}.getElementById('composer').value=60;${panel}.getElementById('composer').dispatchEvent(new Event('input'))`);
    pair=JSON.parse(await c.evaluate(`${KEY}.settingsPanel.exportConfig()`));assert.equal(pair.profiles.dark.composer,.2);assert.equal(pair.profiles.light.composer,.4);
    const syncButtonTop=await c.evaluate(`${panel}.getElementById('sync-all').getBoundingClientRect().top`);
    await click('sync-all');pair=JSON.parse(await c.evaluate(`${KEY}.settingsPanel.exportConfig()`));assert.deepEqual(pair.profiles.dark,pair.profiles.light);
    assert.equal(await c.evaluate(`${panel}.getElementById('feedback').hidden`),false);
    assert.equal(await c.evaluate(`${panel}.getElementById('sync-all').getBoundingClientRect().top`),syncButtonTop,'message does not shift controls');
    assert.equal(await c.evaluate(`getComputedStyle(${panel}.getElementById('feedback')).pointerEvents`),'none','message does not block clicks');
    await fs.writeFile(path.join(ROOT,'work/sync-message.png'),Buffer.from((await c.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.equal(await c.evaluate(`${panel}.getElementById('feedback-text').textContent`),'已全部复制到 Dark');
    await c.evaluate(`document.documentElement.dataset.theme='dark'`);await sleep(80);await click('undo');
    assert.equal(await c.evaluate(`${panel}.getElementById('feedback').hidden`),true);
    pair=JSON.parse(await c.evaluate(`${KEY}.settingsPanel.exportConfig()`));assert.equal(pair.profiles.dark.composer,.2);assert.equal(pair.profiles.light.composer,.4);
    await click('redo');pair=JSON.parse(await c.evaluate(`${KEY}.settingsPanel.exportConfig()`));assert.deepEqual(pair.profiles.dark,pair.profiles.light);
    await assert.rejects(()=>c.evaluate(`${KEY}.settingsPanel.importConfig(JSON.stringify({format:'codex-video-skin',version:2,profiles:{dark:{composer:8},light:{}}}))`));
    assert.deepEqual(JSON.parse(await c.evaluate(`${KEY}.settingsPanel.exportConfig()`)),pair,'invalid import is atomic');
    await c.evaluate(`${KEY}.resetSettings()`);
    // A future opaque component must retain a complete native palette.
    await c.evaluate(`(()=>{const native=document.createElement('style');native.id='native-colors-fixture';native.textContent='#root{--color-text-primary:rgb(22,22,22);--color-text-secondary:rgb(55,55,55)} .unknown-surface{background:white;color:var(--color-text-primary)}';document.head.append(native);const box=document.createElement('div');box.id='unknown-fixture';box.className='unknown-surface';box.innerHTML='<span style="color:var(--color-text-secondary)">Native secondary</span><div contenteditable="true">Native editor</div><button disabled style="opacity:.4">Disabled</button>';document.getElementById('root').append(box);})()`);
    await sleep(80);
    for(const textMode of ['light','dark','auto']){
      await c.evaluate(`${KEY}.setSettings({textMode:'${textMode}'})`);
      const v=await c.evaluate(`(()=>{const b=document.getElementById('unknown-fixture');return {bg:getComputedStyle(b).backgroundColor,text:getComputedStyle(b).color,secondary:getComputedStyle(b.querySelector('span')).color,editor:getComputedStyle(b.querySelector('[contenteditable]')).color,disabled:b.querySelector('button').disabled,opacity:getComputedStyle(b.querySelector('button')).opacity,guard:b.hasAttribute('data-cvs-native-surface')};})()`);
      assert.equal(v.bg,'rgb(255, 255, 255)');assert.equal(v.text,'rgb(22, 22, 22)');assert.equal(v.secondary,'rgb(55, 55, 55)');assert.equal(v.editor,'rgb(22, 22, 22)');assert.equal(v.disabled,true);assert.equal(v.opacity,'0.4');assert.equal(v.guard,true);
    }
    // An opaque surface that becomes transparent must lose its native fallback.
    await c.evaluate(`document.getElementById('unknown-fixture').className=''`);await sleep(80);
    assert.equal(await c.evaluate(`document.getElementById('unknown-fixture').hasAttribute('data-cvs-native-surface')`),false);
    // Inline fill changes and state attributes must also release stale foregrounds.
    await c.evaluate(`document.getElementById('unknown-fixture').style.background='white'`);await sleep(80);
    assert.equal(await c.evaluate(`document.getElementById('unknown-fixture').hasAttribute('data-cvs-native-surface')`),true);
    await c.evaluate(`document.getElementById('unknown-fixture').style.background='transparent'`);await sleep(80);
    assert.equal(await c.evaluate(`document.getElementById('unknown-fixture').hasAttribute('data-cvs-native-surface')`),false);
    await c.evaluate(`document.getElementById('native-colors-fixture').textContent+=' #unknown-fixture[data-state="open"]{background:white}';document.getElementById('unknown-fixture').removeAttribute('style');document.getElementById('unknown-fixture').className='panel-fixture';document.getElementById('unknown-fixture').setAttribute('data-state','open')`);await sleep(80);
    assert.equal(await c.evaluate(`document.getElementById('unknown-fixture').hasAttribute('data-cvs-native-surface')`),true);
    await c.evaluate(`document.getElementById('unknown-fixture').setAttribute('data-state','closed')`);await sleep(80);
    assert.equal(await c.evaluate(`document.getElementById('unknown-fixture').hasAttribute('data-cvs-native-surface')`),false);
    await c.evaluate(`window.nativeFallbackFixture=document.getElementById('unknown-fixture');window.nativeFallbackFixture.remove();document.getElementById('native-colors-fixture').remove()`);await sleep(80);
    assert.equal(await c.evaluate(`window.nativeFallbackFixture.hasAttribute('data-cvs-native-surface')`),false);
    await c.evaluate(`delete window.nativeFallbackFixture;${KEY}.resetSettings()`);
    // New theme controls, including the real summary panel's nested backdrop.
    await c.evaluate(`(()=>{const section=document.createElement('div');section.id='summary-fixture';section.setAttribute('data-summary-panel-variant','summary');section.innerHTML='<header>Outputs<button id="summary-action">Action</button></header><section>Sources</section>';section.style.cssText='position:fixed;top:10px;right:10px;width:280px';document.getElementById('root').append(section);const css=document.createElement('style');css.textContent='[data-summary-panel-variant]{background:var(--color-surface-elevated-secondary)}[data-summary-panel-variant] header{background:var(--color-surface-elevated-secondary)}[data-summary-panel-variant] header::before{content:"";position:absolute;inset:0;background:var(--color-surface-elevated-secondary);pointer-events:none}';document.head.append(css);section.querySelector('button').onclick=e=>e.target.dataset.clicked='yes';})()`);
    for(const mode of ['light','dark'])for(const alpha of [0,.5,1]){
      await c.evaluate(`${KEY}.setSettings({textMode:'${mode}',info:${alpha}})`);
      const layers=await c.evaluate(`(()=>{const e=document.getElementById('summary-fixture'),h=e.querySelector('header');return [getComputedStyle(e).backgroundColor,getComputedStyle(h).backgroundColor,getComputedStyle(h,'::before').backgroundColor];})()`);
      assert.equal(Number(layers[0].match(/[\d.]+/g)[3]??1),alpha);
      assert.equal(layers[1],'rgba(0, 0, 0, 0)');assert.equal(layers[2],'rgba(0, 0, 0, 0)');
    }
    const infoPoint=await c.evaluate(`(()=>{const r=document.getElementById('summary-action').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...infoPoint});
    await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...infoPoint});
    assert.equal(await c.evaluate(`document.getElementById('summary-action').dataset.clicked`),'yes');
    await c.evaluate(`${KEY}.setSettings({focusX:73,focusY:21,brightness:1.2,contrast:1.1,saturation:.8,blur:2.5,speed:1.5,safeArea:'left',safeStrength:.6,colors:{text:'#abcdef',accent:'#123456',panel:'#112233'}})`);
    const styled=await c.evaluate(`(()=>{const v=getComputedStyle(document.getElementById('cvs-video'));return {position:v.objectPosition,filter:v.filter,gradient:getComputedStyle(document.getElementById('cvs-veil')).backgroundImage,text:getComputedStyle(document.querySelector('[data-markdown-text-style]')).color,rate:document.getElementById('cvs-video').playbackRate};})()`);
    assert.equal(styled.position,'73% 21%');assert.ok(styled.filter.includes('blur(2.5px)'));assert.ok(styled.gradient.includes('linear-gradient'));assert.equal(styled.text,'rgb(171, 205, 239)');assert.equal(styled.rate,1.5);
    await c.evaluate(`${KEY}.setSettings({taskMode:'off'})`);assert.equal((await c.evaluate(`${KEY}.status()`)).paused,true);assert.equal(await c.evaluate(`getComputedStyle(document.getElementById('cvs-video')).opacity`),'0');
    await c.evaluate(`${KEY}.setSettings({taskMode:'atmosphere'})`);assert.equal(await c.evaluate(`getComputedStyle(document.getElementById('cvs-video')).opacity`),'0.35');
    await c.evaluate(`${KEY}.setSettings({taskMode:'full',textMode:'auto',colors:{}})`);
    await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await sleep(100);
    assert.equal(await c.evaluate(`${KEY}.getPalette().text`),'#eef5fc');
    await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await sleep(100);
    assert.equal(await c.evaluate(`${KEY}.getPalette().text`),'#17232e');
    const config=await c.evaluate(`${KEY}.settingsPanel.exportConfig()`);
    await c.evaluate(`${KEY}.resetSettings();${KEY}.settingsPanel.importConfig(${JSON.stringify(config)})`);
    assert.equal((await c.evaluate(`${KEY}.status()`)).focusX,73);
    await assert.rejects(()=>c.evaluate(`${KEY}.settingsPanel.importConfig('{')`));
    await c.evaluate(`${KEY}.settingsPanel.show()`);
    await c.evaluate(`${panel}.getElementById('info').value=25;${panel}.getElementById('info').dispatchEvent(new Event('input'))`);
    assert.equal((await c.evaluate(`${KEY}.status()`)).info,.75);
    await click('undo');assert.equal((await c.evaluate(`${KEY}.status()`)).info,1);
    await click('redo');assert.equal((await c.evaluate(`${KEY}.status()`)).info,.75);
    await c.evaluate(`document.getElementById('summary-fixture').remove();${KEY}.resetSettings();${KEY}.settingsPanel.render()`);
    await c.evaluate(`${panel}.getElementById('section-colors').open=true;${panel}.getElementById('section-background').open=true`);
    await c.evaluate(`${panel}.getElementById('panel').scrollTop=0`);
    const expandedShot=await c.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(ROOT,'work/expanded-settings-test.png'),Buffer.from(expandedShot.data,'base64'));
    await c.call('Emulation.setDeviceMetricsOverride',{width:390,height:740,deviceScaleFactor:1,mobile:false});
    const compact=await c.evaluate(`(()=>{const r=document.getElementById('cvs-controls').shadowRoot.getElementById('panel').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};})()`);
    assert.ok(compact.left>=0&&compact.right<=compact.width&&compact.top>=0&&compact.bottom<=compact.height,'settings fit narrow viewport');
    await c.call('Emulation.clearDeviceMetricsOverride');
    await c.evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=10;canvas.getContext('2d').fillRect(0,0,20,10);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));await ${KEY}.settingsPanel.load(new File([blob],'test-background.png',{type:'image/png'}));})()`);
    assert.equal((await c.evaluate(`${KEY}.status()`)).mediaKind,'image');assert.equal((await c.evaluate(`${KEY}.status()`)).width,20);
    await restoreSaved(c);assert.equal((await c.evaluate(`${KEY}.status()`)).mediaKind,'image','image restored without disk MP4');
    assert.equal(await c.evaluate(`${panel}.getElementById('filename').textContent`),'test-background.png');
    // Exercise exactly the serialized resource shipped by the native App.
    const payloadFile=path.join(ROOT,'work/app-payload-test.js');
    execFileSync(process.execPath,['scripts/build-payload.mjs',payloadFile],{cwd:ROOT});
    const payload=await fs.readFile(payloadFile,'utf8');
    const beforeApp=await c.evaluate(`${KEY}.getSettings()`);
    await c.evaluate(`(()=>{const stale=document.createElement('div');stale.id='cvs-controls';document.body.prepend(stale);})()`);
    const appResult=await c.evaluate(payload);
    assert.deepEqual(appResult,{active:true,panel:true});
    assert.deepEqual(await c.evaluate(`${KEY}.getSettings()`),beforeApp,'App restores saved parameters');
    assert.equal((await c.evaluate(`${KEY}.status()`)).mediaKind,'image');
    await c.evaluate(payload);
    assert.equal(await c.evaluate('document.querySelectorAll("#cvs-controls").length'),1,'reapplying App payload leaves one panel');
    // First-phase personal library: actual panel events, offline re-injection,
    // save/copy, pure background, failed switch and explicit rollback.
    await c.evaluate(`${panel}.getElementById('skin-copy-name').value='测试副本';${panel}.getElementById('skin-copy').click()`);
    await c.evaluate(`${KEY}.settingsPanel.whenIdle()`);
    assert.equal(await c.evaluate(`${KEY}.settingsPanel.library.status().name`),'测试副本');
    await c.evaluate(`${panel}.getElementById('dim').value=42;${panel}.getElementById('dim').dispatchEvent(new Event('input'))`);
    await c.evaluate(`${KEY}.settingsPanel.whenIdle()`);
    assert.equal(await c.evaluate(`${KEY}.settingsPanel.library.status().dirty`),true);
    await restoreSaved(c);
    assert.equal((await c.evaluate(`${KEY}.getSettings()`)).dim,.42);
    assert.equal(await c.evaluate(`${KEY}.settingsPanel.library.status().dirty`),true);
    await c.evaluate(`${panel}.getElementById('skin-save').click()`);await c.evaluate(`${KEY}.settingsPanel.whenIdle()`);
    await c.evaluate(`window.testLibraryModel=(${createSkinLibraryModel})(${createAppearance});window.testLibraryState=testLibraryModel.empty()`);
    await c.evaluate(`(async()=>{const a=${KEY}.settingsPanel.library;window.testLibraryState=testLibraryModel.edit(testLibraryState,{type:'receive',...await a.snapshot()});await a.acknowledge(testLibraryState.receipts);})()`);
    assert.equal(await c.evaluate(`${KEY}.settingsPanel.library.status().pending`),0);
    await c.evaluate(`window.testPure={id:'pure-test',name:'纯色测试',revision:1,asset:null,profiles:{dark:{textMode:'light',dim:.1},light:{textMode:'dark',dim:.2}}}`);
    await c.evaluate(`${KEY}.settingsPanel.library.activate(testPure,'discard')`);await c.evaluate(`${KEY}.settingsPanel.library.finalize()`);
    assert.equal((await c.evaluate(`${KEY}.status()`)).mediaKind,'none');assert.equal(await c.evaluate(`${KEY}.getMediaBlob()===null`),true);
    assert.equal(await c.evaluate(`${panel}.getElementById('play').disabled && ${panel}.getElementById('speed').disabled`),true,'pure skins have no playback controls');
    await assert.rejects(()=>c.evaluate(`${KEY}.settingsPanel.library.activate({...testPure,asset:'f'.repeat(64)},'discard')`),/未缓存/);
    assert.equal(await c.evaluate(`${KEY}.settingsPanel.library.status().skinId`),'pure-test');
    await c.evaluate(`${panel}.getElementById('dim').value=30;${panel}.getElementById('dim').dispatchEvent(new Event('input'))`);await c.evaluate(`${KEY}.settingsPanel.whenIdle()`);
    await c.evaluate(`${KEY}.settingsPanel.library.activate({...testPure,id:'other-pure'},'discard')`);await c.evaluate(`${KEY}.settingsPanel.library.rollback()`);
    assert.equal(await c.evaluate(`${KEY}.settingsPanel.library.status().skinId`),'pure-test');assert.equal(await c.evaluate(`${KEY}.settingsPanel.library.status().dirty`),true);
    assert.equal((await c.evaluate(`${KEY}.getSettings()`)).dim,.3);
    await restoreSaved(c);assert.equal((await c.evaluate(`${KEY}.status()`)).mediaKind,'none');assert.equal((await c.evaluate(`${KEY}.getSettings()`)).dim,.3);
    await c.evaluate(`${KEY}.destroy()`);
    assert.equal(await c.evaluate('document.querySelectorAll("#cvs-video,#cvs-veil,#cvs-style").length'),0);
    assert.equal(await c.evaluate('getComputedStyle(document.getElementById("root")).backgroundColor'),original);
    assert.equal(await c.evaluate(`typeof ${KEY}`),'undefined');
    await assert.rejects(()=>apply(c,Buffer.from('not-a-video')),/Unsupported video codec/);
    assert.equal(await c.evaluate('document.querySelectorAll("#cvs-video,#cvs-veil,#cvs-style").length'),0);
    await fs.writeFile(path.join(ROOT,'work/browser-verification.json'),JSON.stringify({passed:true,first,second,checks:['decode','time and decoded frames advance','pause/resume','loop','reduced motion','synthetic visibility','replace without duplicate','real mouse and input','restore','decode error cleanup','transparent chat','panel alpha does not fade text','uncropped contain mode','settings real clicks','dark text','independent opacity','per-video settings persistence','invalid selection retains video','file picker upload','saved video restore','panel reset and close','embedded browser pointer and typing','settings transparent space pass-through','overlapping menu/listbox/dialog portals','native modal top layer','sidebar edge at three widths and alpha levels in both text modes','summary panel transparency and click','focus and filters','safe-area gradient','task background modes','automatic appearance','config roundtrip','undo redo','image background and saved restore']},null,2));
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
