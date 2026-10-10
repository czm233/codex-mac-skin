import {createCompatibility} from '../src/compatibility.mjs';
import fs from 'node:fs/promises';
import {installVideoSkin} from '../src/renderer.mjs';
import {createAppearance} from '../src/theme.mjs';
import {attachSettings} from '../src/panel.mjs';
// Build-time serialization only. The distributed App never launches Node.
const output=process.argv[2];
if(!output)throw new Error('Output filename required');
await fs.writeFile(output,`(async()=>{(${installVideoSkin})({},${createAppearance},${createCompatibility}); const api=window.__codexVideoSkinV1; await (${attachSettings})(api,{id:'unselected',name:'请选择背景',preferSaved:true});return {active:api.status().active,panel:!!api.settingsPanel};})()`);
