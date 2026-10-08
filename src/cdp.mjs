// Minimal CDP transport. Never enumerates page content or logs CDP payloads.
export async function connect(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'ws:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('Only loopback CDP is allowed');
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error('CDP connection timeout')); }, 5000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once:true});
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connection failed')); }, {once:true});
  });
  let next = 0;
  const pending = new Map();
  ws.addEventListener('message', ({data}) => {
    const m = JSON.parse(data); const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id); clearTimeout(p.timer);
    if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
  });
  ws.addEventListener('close', () => {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('CDP disconnected')); }
    pending.clear();
  });
  const call = (method, params={}) => new Promise((resolve,reject) => {
    const id = ++next;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
    pending.set(id, {resolve,reject,timer}); ws.send(JSON.stringify({id,method,params}));
  });
  return {call, close: () => ws.close(), async evaluate(expression) {
    const r = await call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result?.value;
  }};
}
