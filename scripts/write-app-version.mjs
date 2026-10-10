import fs from 'node:fs/promises';
import {versionInfo} from './release-policy.mjs';
const v=versionInfo(JSON.parse(await fs.readFile('package.json','utf8')).version);
const file=process.argv[2];if(!file)throw Error('Missing Info.plist');
let text=await fs.readFile(file,'utf8');
text=text.replace('__APP_VERSION__',v.short).replace('__BUILD_VERSION__',v.short).replace('__FULL_VERSION__',v.version);
await fs.writeFile(file,text);
