import fs from 'node:fs/promises';
import path from 'node:path';
import {appClients,ROOT,KEY} from '../src/cli.mjs';
const clients=await appClients();
try {
  const results=[];
  for(const client of clients) {
    const first=await client.evaluate(`${KEY}?.status()`);
    await new Promise(r=>setTimeout(r,1400));
    const second=await client.evaluate(`${KEY}?.status()`);
    const layout=await client.evaluate(`(() => ({
      main:!!document.querySelector('main, [role="main"]'),
      background:getComputedStyle(document.getElementById('root')).backgroundColor,
      videoCount:document.querySelectorAll('#cvs-video').length,
      pointerEvents:document.getElementById('cvs-video')?getComputedStyle(document.getElementById('cvs-video')).pointerEvents:null
    }))()`);
    results.push({first,second,layout,framesAdvance:second?.decodedFrames>first?.decodedFrames});
  }
  await fs.writeFile(path.join(ROOT,'work/live-verification.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally {clients.forEach(c=>c.close());}
