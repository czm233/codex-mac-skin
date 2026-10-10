import fs from 'node:fs/promises';
import {siteArtifacts} from './site-artifacts.mjs';
import {checkDemoSync} from './demo-gate.mjs';
for(const [name,content] of Object.entries(await siteArtifacts()))await fs.writeFile('docs/'+name,content);
await checkDemoSync();
