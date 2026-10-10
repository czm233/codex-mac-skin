import {StringDecoder} from 'node:string_decoder';
import {spawn} from 'node:child_process';
// CDP pipe is private to this child: no TCP port and no connection to user tabs.
export async function headlessPage(chrome,url,profile){
 const child=spawn(chrome,['--headless=new','--allow-file-access-from-files','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--remote-debugging-pipe',`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe','pipe','pipe']});
 let next=0,buffer='',stderr='';const pending=new Map(),decoder=new StringDecoder('utf8');
 child.stderr.on('data',data=>{stderr=(stderr+data).slice(-2000);});
 const rejectAll=error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();};
 child.on('error',rejectAll);child.on('exit',()=>rejectAll(Error('Headless exited: '+stderr)));
 child.stdio[4].on('data',data=>{buffer+=decoder.write(data);let end;while((end=buffer.indexOf('\0'))>=0){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const p=pending.get(message.id);if(p){pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}}});
 const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Headless timeout: '+method));},30000);
  pending.set(id,{resolve,reject,timer});child.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
 });
 const close=async()=>{if(child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');const force=setTimeout(()=>child.kill('SIGKILL'),2000);await exited;clearTimeout(force);}rejectAll(Error('Headless closed'));};
 try{
  const {targetId}=await call('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  await call('Page.navigate',{url},sessionId);
  return {close,evaluate:async expression=>{
   const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);
   if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
   return result.result.value;
  }};
 }catch(e){await close();throw e;}
}
