/** Pure graph operations. Root IDs remain strings at every external boundary. */
export const NT = ['ACH','GABA','GLUT','DA','SER','OCT','UNKNOWN'];
export const NT_COLORS = { ACH:'#7fddc2', GABA:'#bba5f3', GLUT:'#eca883', DA:'#ec87ae', SER:'#82bfea', OCT:'#e7d588', UNKNOWN:'#77838e' };
export const FIELDS = { id:0,name:1,nt:2,confidence:3,superClass:4,cellClass:5,subClass:6,cellType:7,group:8,side:9,flow:10,tags:11,additionalTypes:12,hemilineage:13,nerve:14,predictions:15 };
export const DEFAULT_FILTERS = { query:'', nt:'all', side:'all', superClass:'all', region:-1, tag:'all', minSyn:5, savedOnly:false };
export const SIDE_LABELS = {left:'왼쪽',right:'오른쪽',center:'중앙',UNKNOWN:'미분류','':'미분류'};
export function validateRootId(value) { return typeof value === 'string' && /^\d{10,22}$/.test(value.trim()); }
export function assertIndex(i,n) { if (!Number.isInteger(i)||i<0||i>=n) throw new Error('존재하지 않는 뉴런입니다.'); return i; }
export function hasRegion(metrics,index,width,region) {
  if (region < 0) return true;
  return ((metrics[index*width+5+(region>>>5)] >>> (region&31)) & 1) === 1;
}
export function matchesNode(row,index,filters,metrics,width,searchText,savedSet) {
  if (filters.nt!=='all' && row[FIELDS.nt]!==filters.nt) return false;
  if (filters.side!=='all' && (row[FIELDS.side]||'UNKNOWN')!==filters.side) return false;
  if (filters.superClass!=='all' && row[FIELDS.superClass]!==filters.superClass) return false;
  if (!hasRegion(metrics,index,width,Number(filters.region))) return false;
  if (filters.tag!=='all' && !row[FIELDS.tags].split(',').includes(filters.tag)) return false;
  if (filters.savedOnly && !savedSet?.has(row[0])) return false;
  const terms=filters.query?.trim().toLowerCase().split(/\s+/).filter(Boolean)||[];
  return terms.every(term=>searchText.includes(term));
}
/** Rows contain [peerIndex, synapseCount, regionIndex, ntIndex].
 * Parallel neuropils are aggregated BEFORE the pair threshold is applied. */
export function aggregateRows(rows, { region=-1, minSyn=1, direction='out', self=-1 }={}) {
  const peers=new Map();
  for (let p=0;p<rows.length;p+=4) {
    const peer=rows[p],w=rows[p+1],r=rows[p+2],nt=rows[p+3];
    if (region>=0 && r!==region) continue;
    let a=peers.get(peer);
    if (!a) {a={peer,weight:0,regions:{},transmitters:{},direction,selfLoop:peer===self};peers.set(peer,a);}
    a.weight+=w;a.regions[r]=(a.regions[r]||0)+w;a.transmitters[nt]=(a.transmitters[nt]||0)+w;
  }
  return [...peers.values()].filter(a=>a.weight>=minSyn).sort((a,b)=>b.weight-a.weight||a.peer-b.peer);
}
export function overviewWeight(edge,region) {
  return region<0 ? edge[2] : edge[3].reduce((sum,row)=>sum+(row[0]===region?row[1]:0),0);
}
export function mix32(x) { x=Math.imul(x ^ (x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>15))>>>0; }
export function deterministicSample(indices,limit,required=[]) {
  const set=new Set(required), result=[...set].slice(0,limit);
  const chosen=indices.filter(i=>!set.has(i));
  chosen.sort((a,b)=>mix32(a)-mix32(b)||a-b);
  result.push(...chosen.slice(0,Math.max(0,limit-result.length)));
  return result;
}
export function localPosition(i,selected,connections) {
  if(i===selected)return [0,0,0];
  const incoming=connections.filter(c=>c.direction==='in');
  const outgoing=connections.filter(c=>c.direction==='out');
  let group=incoming,index=group.findIndex(c=>c.peer===i),sign=-1;
  if(index<0){group=outgoing;index=group.findIndex(c=>c.peer===i);sign=1;}
  if(index<0)return [0,0,0];
  const a=index*2.399963229728653, r=22+Math.sqrt(index/Math.max(1,group.length))*80;
  return [sign*(57+((mix32(i)%100)/100)*38), Math.cos(a)*r, Math.sin(a)*r*.85];
}
export function parseShard(buffer, expectedStart, expectedNodes) {
  if(buffer.byteLength%4 || buffer.byteLength<24)throw new Error('손상된 연결 인덱스입니다.');
  const u=new Uint32Array(buffer),[magic,start,n,rows,width]=u;
  if(magic!==0x4e415431||start!==expectedStart||n!==expectedNodes||width!==4||u.length!==5+n+1+rows*4)throw new Error('연결 인덱스 버전 또는 길이가 맞지 않습니다.');
  const offsets=u.subarray(5,5+n+1);
  if(offsets[0]!==0 || offsets[n]!==rows)throw new Error('잘못된 연결 오프셋입니다.');
  for(let i=1;i<offsets.length;i++)if(offsets[i]<offsets[i-1])throw new Error('정렬되지 않은 연결 오프셋입니다.');
  return {start,n,offsets,records:u.subarray(5+n+1)};
}
export class LRU {
  constructor(limit=16){this.limit=limit;this.map=new Map();}
  get(key){const v=this.map.get(key);if(v!==undefined){this.map.delete(key);this.map.set(key,v);}return v;}
  set(key,value){this.map.delete(key);this.map.set(key,value);while(this.map.size>this.limit)this.map.delete(this.map.keys().next().value);return value;}
  clear(){this.map.clear();}
}
export class CancelledError extends Error { constructor(){super('탐색이 취소되었습니다.');this.name='CancelledError';} }
/** Level-order BFS. A budget cap is never reported as proof that no path exists.
 * getNeighbors must produce thresholded, directed, aggregated connections. */
export async function shortestPath({source,target,getNeighbors,maxHops=5,maxVisited=12000,isCancelled=()=>false,onProgress=()=>{}}) {
  if(source===target)return {status:'found',nodes:[source],edges:[],visited:1,hops:0};
  const seen=new Set([source]),parents=new Map();let frontier=[source],depth=0;
  while(frontier.length && depth<maxHops){
    const next=[];depth++;
    for(const node of frontier){
      if(isCancelled())throw new CancelledError();
      const neighbors=await getNeighbors(node);
      if(isCancelled())throw new CancelledError();
      for(const edge of neighbors){
        const peer=edge.peer;if(seen.has(peer))continue;
        parents.set(peer,{from:node,weight:edge.weight,regions:edge.regions});
        if(peer===target){
          const nodes=[target],edges=[];let at=target;
          while(at!==source){const p=parents.get(at);edges.push({source:p.from,target:at,weight:p.weight,regions:p.regions});nodes.push(p.from);at=p.from;}
          return {status:'found',nodes:nodes.reverse(),edges:edges.reverse(),visited:seen.size+1,hops:depth};
        }
        if(seen.size>=maxVisited)return {status:'budget-limited',visited:seen.size,hops:depth,maxVisited};
        seen.add(peer);next.push(peer);
      }
    }
    frontier=next;onProgress({depth,visited:seen.size,frontier:frontier.length});
    await new Promise(r=>setTimeout(r,0));
  }
  return {status:frontier.length?'hop-limited':'unreachable',visited:seen.size,hops:depth,maxHops};
}
export function viewExport({manifest,nodes,edges,filters,mode,truncated}) {
  return {format:'neuro-atlas-view-v1',datasetVersion:manifest.version,exportedAt:new Date().toISOString(),
    coordinates:{anatomical:false,units:'arbitrary',method:mode==='local'?'input-output schematic':'class/type schematic'},
    scope:'Only the currently rendered subset; not the complete connectome',truncated:Boolean(truncated),filters,
    nodes:nodes.map(n=>({...n,id:String(n.id)})),edges};
}
