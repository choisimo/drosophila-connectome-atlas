import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/data');
const present=fs.existsSync(path.join(root,'manifest.json'));
let worker,server,next=1,info;const pending=new Map();
function request(type,payload={}){const id=next++;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,type,payload});});}
before(async()=>{
 if(!present)return;
 server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+data\//,'');const target=path.resolve(root,name);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','application/octet-stream');if(name.endsWith('.gz'))res.setHeader('Content-Encoding','gzip');fs.createReadStream(target).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 worker=new Worker(new URL('./worker-harness.mjs',import.meta.url));
 worker.on('message',data=>{if(data.event)return;const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.ok?p.resolve(data.data):p.reject(Object.assign(new Error(data.error),{name:data.name}));});
 worker.on('error',error=>{for(const p of pending.values())p.reject(error);pending.clear();});
 info=await request('init',{base:`http://127.0.0.1:${server.address().port}/data/`});
}, {timeout:60000});
after(async()=>{if(worker)await worker.terminate();if(server)await new Promise(r=>server.close(r));});
const integration=(name,fn)=>test(name,{skip:!present,timeout:60000},fn);
integration('worker indexes all actual uploaded neurons and connection totals',()=>{assert.equal(info.manifest.neurons,139255);assert.equal(info.manifest.synapses,50666648);assert.equal(info.manifest.directedPairs,3732460);assert.equal(info.manifest.connectionRows,5342446);});
integration('exact 64-bit root ID round trips through search and resolution',async()=>{
 const id='720575940596125868';const n=await request('resolve',{id});assert.equal(n.id,id);const r=await request('search',{filters:{query:id}});assert.equal(r.items[0].id,id);assert.equal(r.total,1);
});
integration('transmitter filtering matches the full source count',async()=>{const r=await request('search',{filters:{nt:'GABA'}});assert.equal(r.total,16017);assert.ok(r.items.every(n=>n.nt==='GABA'));});
integration('unknown IDs return null without aliasing a nearby large integer',async()=>{assert.equal(await request('resolve',{id:'720575940596125869'}),null);});
integration('paged metadata list uses real offset and no overlap',async()=>{const a=await request('search',{offset:0}),b=await request('search',{offset:50});assert.equal(a.items.length,50);assert.equal(b.offset,50);assert.equal(new Set([...a.items,...b.items].map(n=>n.id)).size,100);});
integration('full selected-neuron adjacency matches independently computed node totals',async()=>{
 const index=info.featured[0].index;const d=await request('detail',{index,filters:{minSyn:1}});assert.equal(d.incoming.reduce((s,c)=>s+c.weight,0),d.node.inSyn);assert.equal(d.outgoing.reduce((s,c)=>s+c.weight,0),d.node.outSyn);assert.equal(d.incoming.length,d.node.inPartners);assert.equal(d.outgoing.length,d.node.outPartners);
});
integration('overview LOD retains every displayed edge endpoint and threshold',async()=>{
 const v=await request('view',{limit:8000,edgeLimit:800,filters:{minSyn:10}}),set=new Set(v.nodes.map(n=>n.index));assert.equal(v.nodes.length,8000);assert.ok(v.edges.length<=800);assert.ok(v.edges.every(e=>set.has(e.source)&&set.has(e.target)&&e.weight>=10));assert.equal(v.truncated,true);assert.equal(v.matchedNodes,139255);
});
integration('local direction filtering preserves edge orientation and selection',async()=>{const index=info.featured[0].index;const v=await request('view',{mode:'local',index,direction:'out',filters:{minSyn:1},limit:80});assert.ok(v.nodes.some(n=>n.index===index));assert.ok(v.edges.every(e=>e.source===index));assert.ok(v.edges.length<=80);});
integration('actual neighboring neurons have a verified one-hop path',async()=>{
 const d=await request('detail',{index:info.featured[0].index,filters:{minSyn:1}});const edge=d.outgoing.find(c=>c.peer!==d.node.index);assert.ok(edge);const r=await request('path',{source:d.node.id,target:edge.node.id,maxHops:1,filters:{minSyn:1}});assert.equal(r.status,'found');assert.equal(r.hops,1);assert.equal(r.edges[0].weight,edge.weight);assert.equal(r.nodes[0].id,d.node.id);assert.equal(r.nodes[1].id,edge.node.id);
});
integration('no-result filter yields an empty graph, never fabricated neurons',async()=>{const r=await request('view',{filters:{query:'nonexistent-root-xyz-000'},limit:8000,edgeLimit:800});assert.equal(r.nodes.length,0);assert.equal(r.edges.length,0);});
integration('invalid source ID is rejected before traversal',async()=>{await assert.rejects(()=>request('path',{source:'abc',target:'720575940596125868'}),/root ID/);});
