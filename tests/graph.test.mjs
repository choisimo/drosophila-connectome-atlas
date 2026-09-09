import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateRows,shortestPath,validateRootId,parseShard,LRU,deterministicSample,hasRegion,overviewWeight,matchesNode,DEFAULT_FILTERS,viewExport,CancelledError} from '../src/lib/graph.js';

test('64-bit root IDs stay strings and reject numeric input',()=>{
 const id='720575940596125868';assert.equal(validateRootId(id),true);assert.equal(validateRootId(Number(id)),false);assert.equal(String(Number(id))===id,false);assert.equal(validateRootId('abc'),false);
});
test('parallel neuropils are combined before thresholding',()=>{
 const result=aggregateRows(new Uint32Array([2,3,0,0,2,4,1,0,3,1,0,2]),{minSyn:5});
 assert.equal(result.length,1);assert.equal(result[0].weight,7);assert.deepEqual(result[0].regions,{'0':3,'1':4});
});
test('region restriction happens before aggregation threshold',()=>{
 const raw=new Uint32Array([2,3,0,0,2,4,1,0]);assert.equal(aggregateRows(raw,{region:0,minSyn:5}).length,0);assert.equal(aggregateRows(raw,{region:1,minSyn:4})[0].weight,4);
});
test('unknown transmitter and self loop are retained',()=>{
 const result=aggregateRows(new Uint32Array([1,4,0,6]),{self:1,direction:'in'});assert.equal(result[0].selfLoop,true);assert.equal(result[0].transmitters[6],4);assert.equal(result[0].direction,'in');
});
test('weights are summed without 32-bit bitwise truncation',()=>{const r=aggregateRows([2,3000000000,0,0,2,3000000000,1,0]);assert.equal(r[0].weight,6000000000);});
test('threshold sorting is deterministic',()=>{const r=aggregateRows([4,5,0,0,2,5,0,0]);assert.deepEqual(r.map(x=>x.peer),[2,4]);});
test('overview region weights use actual region rows',()=>{const e=[1,2,7,[[0,3,0],[1,4,0]]];assert.equal(overviewWeight(e,-1),7);assert.equal(overviewWeight(e,0),3);assert.equal(overviewWeight(e,2),0);});
test('region bitsets handle bit 31 and multiple words',()=>{const m=new Uint32Array(8);m[5]=0x80000000;m[7]=1<<14;assert.equal(hasRegion(m,0,8,31),true);assert.equal(hasRegion(m,0,8,78),true);assert.equal(hasRegion(m,0,8,32),false);assert.equal(hasRegion(m,0,8,-1),true);});
test('root IDs and required nodes survive deterministic LOD sampling',()=>{const all=Array.from({length:100},(_,i)=>i);const a=deterministicSample(all,10,[91,97]);assert.deepEqual(a,deterministicSample(all,10,[91,97]));assert.equal(new Set(a).size,10);assert.ok(a.includes(91)&&a.includes(97));});
test('invalid indices in binary shard are rejected',()=>{assert.throws(()=>parseShard(new ArrayBuffer(3),0,1));const bad=new Uint32Array([0,0,1,0,4,0,0]);assert.throws(()=>parseShard(bad.buffer,0,1));});
test('valid shard offsets permit a neuron with no connections',()=>{
 const u=new Uint32Array([0x4e415431,512,2,1,4,0,0,1,5,9,3,0]);const p=parseShard(u.buffer,512,2);assert.deepEqual([...p.offsets],[0,0,1]);assert.deepEqual([...p.records],[5,9,3,0]);
});
test('nonmonotonic binary offsets are rejected',()=>{const u=new Uint32Array([0x4e415431,0,3,1,4,0,1,0,1,2,3,1,0]);assert.throws(()=>parseShard(u.buffer,0,3));});
test('LRU protects the most recently read shard',()=>{const c=new LRU(2);c.set('a',1);c.set('b',2);c.get('a');c.set('c',3);assert.equal(c.get('b'),undefined);assert.equal(c.get('a'),1);c.clear();assert.equal(c.map.size,0);});
const graph={0:[1,2],1:[3],2:[4],3:[5],4:[5],5:[]};
const neighbors=async i=>(graph[i]||[]).map(peer=>({peer,weight:10,regions:{0:10}}));
test('directed BFS returns a shortest path with weighted edges',async()=>{const r=await shortestPath({source:0,target:5,getNeighbors:neighbors,maxHops:5});assert.equal(r.status,'found');assert.equal(r.hops,3);assert.equal(r.nodes[0],0);assert.equal(r.nodes.at(-1),5);assert.equal(r.edges.length,3);assert.equal(r.edges[0].weight,10);});
test('directed BFS does not invent reverse edges',async()=>{const r=await shortestPath({source:5,target:0,getNeighbors:neighbors});assert.equal(r.status,'unreachable');});
test('same source and target is a valid zero-hop path',async()=>{const r=await shortestPath({source:2,target:2,getNeighbors:()=>{throw new Error('must not load')}});assert.equal(r.hops,0);assert.deepEqual(r.nodes,[2]);});
test('hop limit is not falsely reported as graph-wide absence',async()=>{const r=await shortestPath({source:0,target:5,getNeighbors:neighbors,maxHops:1});assert.equal(r.status,'hop-limited');});
test('visited-node budget is not falsely reported as absence',async()=>{const r=await shortestPath({source:0,target:5,getNeighbors:neighbors,maxVisited:2});assert.equal(r.status,'budget-limited');});
test('cancellation is checked after an asynchronous load',async()=>{let stop=false;await assert.rejects(()=>shortestPath({source:0,target:5,getNeighbors:async()=>{stop=true;return[{peer:5,weight:1}];},isCancelled:()=>stop}),CancelledError);});
test('filters distinguish ignored query and exact connectivity tags',()=>{
 const r=['720575940596125868','a','ACH',.9,'optic','','','T4','','left','','rich_club,reciprocal'];const m=new Uint32Array(8);
 assert.equal(matchesNode(r,0,{...DEFAULT_FILTERS,query:'t4',nt:'ACH'},m,8,'a t4',new Set()),true);
 assert.equal(matchesNode(r,0,{...DEFAULT_FILTERS,tag:'rich'},m,8,'a t4',new Set()),false);
 assert.equal(matchesNode(r,0,{...DEFAULT_FILTERS,savedOnly:true},m,8,'a t4',new Set()),false);
});
test('view export explicitly marks a schematic subset and string IDs',()=>{
 const e=viewExport({manifest:{version:'test'},nodes:[{id:'720575940596125868',position:[1,2,3]}],edges:[],filters:{},mode:'local',truncated:true});
 assert.equal(e.nodes[0].id,'720575940596125868');assert.equal(e.coordinates.anatomical,false);assert.equal(e.truncated,true);assert.match(e.scope,/subset/);
});
