import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {demoResources} from './demo-resources.mjs';
export async function siteArtifacts(){
 const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
 const read=p=>fs.readFile(p,'utf8');
 const [appearance,session,library,demo,css,original,shared]=await Promise.all([
  'src/theme.mjs','src/library-session.mjs','src/library.mjs','docs/demo.js','docs/style.css','docs/index.html'
 ].map(read).concat(demoResources()));
 const bundle='(()=>{\n'+shared.script+'\n'+appearance.replace('export function','function')+'\n'+library.replace('export function','function')+'\n'+session.replace('export async function','async function')+'\n'+demo.replace(/^import .*;$/gm,'')+'\n})();\n';
 const filename=`demo-${hash(bundle)}.js`;
 for(const marker of ['<!--WORKSPACE_START-->','<!--WORKSPACE_END-->','<!--REFERENCE_START-->','<!--REFERENCE_END-->'])if(!original.includes(marker))throw Error('Missing shared demo slot: '+marker);
 const html=original.replace(/<!--WORKSPACE_START-->[\s\S]*?<!--WORKSPACE_END-->/,()=> '<!--WORKSPACE_START-->\n'+shared.html.split('<!--WORKSPACE_CONTROLS-->')[0]+'<!--WORKSPACE_END-->')
 .replace(/<!--REFERENCE_START-->[\s\S]*?<!--REFERENCE_END-->/,()=> '<!--REFERENCE_START-->'+shared.reference+'<!--REFERENCE_END-->')
 .replace(/href="workspace.css[^"]*"/,`href="workspace.css?v=${hash(shared.css)}"`)
 .replace(/href="style.css[^"]*"/,`href="style.css?v=${hash(css)}"`)
 .replace(/<script[^>]*src="demo[^"]*"[^>]*><\/script>/,`<script src="${filename}" defer></script>`);
 return {'index.html':html,'appearance.mjs':appearance,'library-session.mjs':session,'library.mjs':library,'workspace.css':shared.css,'workspace.mjs':shared.source,[filename]:bundle};
}
