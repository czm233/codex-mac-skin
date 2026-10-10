import fs from 'node:fs/promises';
import {renderWorkspace,attachWorkspaceInteractions} from '../src/demo/workspace.mjs';
export async function demoResources(){
 const read=name=>fs.readFile(new URL('../src/demo/'+name,import.meta.url),'utf8');
 const [html,css,reference,source]=await Promise.all(['workspace.html','workspace.css','reference.html','workspace.mjs'].map(read));
 return {html,css,reference,source,script:`${renderWorkspace}\n${attachWorkspaceInteractions}`};
}
