import {demoResources} from './demo-resources.mjs';
import {installSkinPreview} from '../src/preview.mjs';
import {createLibrarySession} from '../src/library-session.mjs';
import {createSkinLibraryModel} from '../src/library.mjs';
import {createCompatibility} from '../src/compatibility.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {installVideoSkin} from '../src/renderer.mjs';
import {createAppearance} from '../src/theme.mjs';
import {attachSettings} from '../src/panel.mjs';
// Build-time serialization only. The distributed App never launches Node.
const output=process.argv[2];
if(!output)throw new Error('Output filename required');
const revision=createHash('sha256').update([installVideoSkin,createAppearance,createCompatibility,attachSettings,createLibrarySession].join('')).digest('hex').slice(0,16);
await fs.writeFile(path.join(path.dirname(output),'skin-build.txt'),revision);
await fs.writeFile(output,`(async()=>{const migrationConfig=window.__codexVideoSkinV1?.settingsPanel&&!window.__codexVideoSkinV1.settingsPanel.library?window.__codexVideoSkinV1.settingsPanel.exportConfig():null;await window.__codexVideoSkinV1?.settingsPanel?.library?.checkpoint();(${installVideoSkin})({},${createAppearance},${createCompatibility}); const api=window.__codexVideoSkinV1; await (${attachSettings})(api,{id:'unselected',name:'请选择背景',preferSaved:true,migrationConfig},${createLibrarySession});api.buildRevision=${JSON.stringify(revision)};return {active:api.status().active,panel:!!api.settingsPanel};})()`);

await fs.writeFile(path.join(path.dirname(output),'library.js'), `var skinLibraryModel=(${createSkinLibraryModel})(${createAppearance});`);

const previewTemplate=await fs.readFile(new URL('../app/preview.html',import.meta.url),'utf8');
const shared=await demoResources();
const previewScript=`${shared.script};window.skinPreview=(${installSkinPreview})(${createAppearance},renderWorkspace,attachWorkspaceInteractions);`;
await fs.writeFile(path.join(path.dirname(output),'preview.html'),previewTemplate.replace('/*WORKSPACE_STYLE*/',()=>shared.css).replace('<!--WORKSPACE-->',()=>shared.html.replace('<!--WORKSPACE_CONTROLS-->','')).replace('<!--REFERENCE-->',()=>shared.reference).replace('/*PREVIEW_SCRIPT*/',()=>previewScript));
