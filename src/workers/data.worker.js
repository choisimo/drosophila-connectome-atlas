import { DEFAULT_FILTERS,FIELDS,NT,assertIndex,matchesNode,aggregateRows,overviewWeight,deterministicSample,localPosition,parseShard,LRU,shortestPath,validateRootId } from '../lib/graph.js';

let manifest,rows,metrics,partners,positions,overview,searchText,rootIndex,dataBase;
const cache=new LRU(18),pending=new Map();let pathGeneration=0;
const decoder=new TextDecoder();
const send=(id,data)=>self.postMessage({id,ok:true,data});
function progress(stage,percent,detail){self.postMessage({event:'progress',stage,percent,detail});}
function hex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function fetchData(name){
  const entry=manifest.files[name];if(!entry)throw new Error('매니페스트에 없는 데이터 파일입니다.');
  if(!self.crypto?.subtle)throw new Error('데이터 검증을 위해 localhost 또는 HTTPS로 실행해 주세요.');
  for(let attempt=0;attempt<2;attempt++){
    const response=await fetch(new URL(name+'?v='+manifest.version,dataBase),{cache:attempt?'reload':'force-cache'});
    if(!response.ok)throw new Error(`${name}: HTTP ${response.status}. 데이터 폴더와 실행 경로를 확인해 주세요.`);
    const bytes=await response.arrayBuffer();
    const digest=hex(await crypto.subtle.digest('SHA-256',bytes));
    const compressed=bytes.byteLength===entry.bytes && digest===entry.sha256;
    // Some dev servers/CDNs advertise .gz as Content-Encoding:gzip. Fetch then
    // exposes the already-decoded payload even though the file on disk is gzip.
    // Accept only the independently pinned decoded hash; never skip integrity.
    const decoded=Number.isSafeInteger(entry.payloadBytes) && typeof entry.payloadSha256==='string'
      && bytes.byteLength===entry.payloadBytes && digest===entry.payloadSha256;
    if(!compressed && !decoded){
      if(attempt===0)continue;
      throw new Error(`${name}: 체크섬 불일치. 서로 다른 버전의 데이터를 함께 사용할 수 없습니다.`);
    }
    if(decoded)return bytes;
    if(typeof DecompressionStream==='undefined')throw new Error('이 브라우저는 gzip 해제를 지원하지 않습니다. 최신 브라우저에서 실행해 주세요.');
    return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
}
const loadJSON=async(name)=>JSON.parse(decoder.decode(await fetchData(name)));
function node(index,full=false){
  assertIndex(index,rows.length);const r=rows[index],m=index*manifest.metricsWidth;
  const result={index,id:r[0],name:r[1]||r[7]||r[0],nt:r[2],confidence:r[3],superClass:r[4],cellClass:r[5],cellType:r[7],side:r[9],
    inSyn:metrics[m],outSyn:metrics[m+1],inRows:metrics[m+2],outRows:metrics[m+3],inPartners:partners[index*2],outPartners:partners[index*2+1],
    dominantRegion:metrics[m]+metrics[m+1]>0?manifest.regions[metrics[m+4]]:'',position:Array.from(positions.subarray(index*3,index*3+3))};
  if(full)Object.assign(result,{subClass:r[6],group:r[8],flow:r[10],tags:r[11].split(',').filter(Boolean),additionalTypes:r[12],hemilineage:r[13],nerve:r[14],predictions:r[15]});
  return result;
}
function normalizedFilters(given={}){
  const f={...DEFAULT_FILTERS,...given};f.region=Number(f.region);f.minSyn=Math.max(1,Math.min(100000,Number(f.minSyn)||1));
  if(!Number.isInteger(f.region)||f.region< -1||f.region>=manifest.regions.length)throw new Error('잘못된 영역 필터입니다.');
  return f;
}
function predicate(filters,saved=[]){const set=new Set(saved);return i=>matchesNode(rows[i],i,filters,metrics,manifest.metricsWidth,searchText[i],set);}
async function shard(direction,index){
  const number=Math.floor(index/manifest.shardSize),key=`${direction}/${String(number).padStart(4,'0')}.bin.gz`;
  const hit=cache.get(key);if(hit)return hit;
  if(pending.has(key))return pending.get(key);
  const promise=(async()=>{
    const start=number*manifest.shardSize;
    return cache.set(key,parseShard(await fetchData(key),start,Math.min(manifest.shardSize,rows.length-start)));
  })();
  pending.set(key,promise);
  try{return await promise;}finally{pending.delete(key);}
}
async function connections(index,direction='out',filters={}){
  assertIndex(index,rows.length);const sh=await shard(direction,index),local=index-sh.start;
  const raw=sh.records.subarray(sh.offsets[local]*4,sh.offsets[local+1]*4);
  return aggregateRows(raw,{minSyn:filters.minSyn||1,region:filters.region??-1,direction,self:index});
}
async function initialize(payload){
  dataBase=new URL(payload.base);
  if(!['http:','https:'].includes(dataBase.protocol))throw new Error('HTML 파일을 직접 열지 말고 로컬 서버에서 실행해 주세요.');
  progress('manifest',4,'데이터 확인');
  const response=await fetch(new URL('manifest.json',dataBase),{cache:'no-cache'});
  if(!response.ok)throw new Error('data/manifest.json을 읽을 수 없습니다. 데이터가 포함된 실행 폴더인지 확인해 주세요.');
  manifest=await response.json();
  if(manifest.schema!==1 || !Number.isSafeInteger(manifest.neurons) || manifest.neurons<1)throw new Error('지원하지 않는 데이터 형식입니다.');
  progress('metadata',15,'뉴런 인덱스 로딩');
  [rows,metrics,positions,overview,partners]=await Promise.all([
    loadJSON('nodes.json.gz'),fetchData('metrics.bin.gz').then(b=>new Uint32Array(b)),
    fetchData('positions.bin.gz').then(b=>new Float32Array(b)),loadJSON('overview.json.gz'),fetchData('partners.bin.gz').then(b=>new Uint32Array(b))
  ]);
  if(rows.length!==manifest.neurons || metrics.length!==rows.length*manifest.metricsWidth || positions.length!==rows.length*3 || partners.length!==rows.length*2)throw new Error('뉴런 데이터와 인덱스 길이가 일치하지 않습니다.');
  progress('index',82,'검색 인덱스 생성');
  rootIndex=new Map();searchText=new Array(rows.length);
  for(let i=0;i<rows.length;i++){
    const r=rows[i];if(typeof r[0]!=='string'||rootIndex.has(r[0]))throw new Error('잘못되었거나 중복된 root ID입니다.');
    rootIndex.set(r[0],i);searchText[i]=[r[0],r[1],r[4],r[5],r[6],r[7],r[8],r[11],r[12]].join(' ').toLowerCase();
  }
  progress('ready',100,'준비 완료');
  return {manifest,featured:manifest.featured.map(i=>node(i))};
}
function search(payload){
  const filters=normalizedFilters(payload.filters),match=predicate(filters,payload.saved),found=[];
  for(let i=0;i<rows.length;i++)if(match(i))found.push(i);
  const exact=filters.query.trim();
  found.sort((a,b)=>{
    if(rows[a][0]===exact)return -1;if(rows[b][0]===exact)return 1;
    const ta=rows[a][7].toLowerCase()===exact.toLowerCase(),tb=rows[b][7].toLowerCase()===exact.toLowerCase();
    return Number(tb)-Number(ta) || (metrics[b*manifest.metricsWidth]+metrics[b*manifest.metricsWidth+1])-(metrics[a*manifest.metricsWidth]+metrics[a*manifest.metricsWidth+1]) || a-b;
  });
  const offset=Math.max(0,payload.offset||0),limit=Math.max(1,Math.min(120,payload.limit||50));
  return {total:found.length,offset,items:found.slice(offset,offset+limit).map(i=>node(i))};
}
function overviewView(payload){
  const filters=normalizedFilters(payload.filters),match=predicate(filters,payload.saved),matched=[];
  for(let i=0;i<rows.length;i++)if(match(i))matched.push(i);
  const edges=[];const required=new Set();const limit=Math.max(250,Math.min(45000,payload.limit||18000));
  const edgeLimit=Math.max(0,Math.min(10000,payload.edgeLimit??2200));
  let eligibleOverview=0;
  for(const e of overview){
    const weight=overviewWeight(e,filters.region);
    if(weight<filters.minSyn || !match(e[0]) || !match(e[1]))continue;
    eligibleOverview++;
    if(edges.length>=edgeLimit)continue;
    const added=(!required.has(e[0])?1:0)+(!required.has(e[1])?1:0);
    if(required.size+added>limit)continue;
    required.add(e[0]);required.add(e[1]);edges.push({source:e[0],target:e[1],weight});
  }
  const indices=deterministicSample(matched,limit,[...required]);
  const nodes=indices.map(i=>({index:i,id:rows[i][0],nt:rows[i][2],side:rows[i][9],superClass:rows[i][4],size:1+Math.min(2,Math.log10(1+metrics[i*manifest.metricsWidth]+metrics[i*manifest.metricsWidth+1])*.28),position:Array.from(positions.subarray(i*3,i*3+3))}));
  return {mode:'overview',nodes,edges,matchedNodes:matched.length,eligibleOverview,truncated:indices.length<matched.length||edges.length<manifest.directedPairs,
    scope:'overview-top-pairs',overviewCandidates:manifest.overviewPairs};
}
async function detail(payload){
  const index=typeof payload.index==='number'?payload.index:rootIndex.get(String(payload.id));
  assertIndex(index,rows.length);
  const filters=normalizedFilters(payload.filters),match=predicate({...filters,query:''},payload.saved);
  const [incoming,outgoing]=await Promise.all([connections(index,'in',filters),connections(index,'out',filters)]);
  const map=a=>({...a,node:node(a.peer)});
  return {node:node(index,true),incoming:incoming.filter(c=>match(c.peer)).map(map),outgoing:outgoing.filter(c=>match(c.peer)).map(map),
    pairThreshold:filters.minSyn,region:filters.region,unfilteredDirections:{incoming:incoming.length,outgoing:outgoing.length}};
}
async function localView(payload){
  const detailData=await detail(payload),selected=detailData.node.index;
  let list=payload.direction==='in'?detailData.incoming:payload.direction==='out'?detailData.outgoing:[...detailData.incoming,...detailData.outgoing];
  // A self-loop is the same directed connection in both adjacency indexes.
  if(payload.direction==='both')list=list.filter(c=>!(c.direction==='in'&&c.peer===selected));
  list.sort((a,b)=>b.weight-a.weight||a.peer-b.peer);
  const total=list.length,chosen=list.slice(0,Math.min(1200,payload.limit||180)),ids=[...new Set([selected,...chosen.map(c=>c.peer)])];
  const nodes=ids.map(i=>({...node(i),position:localPosition(i,selected,chosen),size:i===selected?3.2:1.5}));
  const edges=chosen.map(c=>({source:c.direction==='in'?c.peer:selected,target:c.direction==='in'?selected:c.peer,weight:c.weight,direction:c.direction,regions:c.regions}));
  return {mode:'local',nodes,edges,matchedNodes:ids.length,eligibleOverview:total,selected,truncated:chosen.length<total,scope:'selected-one-hop',totalConnections:total};
}
async function path(payload,id){
  const sourceId=String(payload.source).trim(),targetId=String(payload.target).trim();
  if(!validateRootId(sourceId)||!validateRootId(targetId))throw new Error('시작과 도착에 정확한 root ID를 입력해 주세요.');
  const source=rootIndex.get(sourceId),target=rootIndex.get(targetId);
  assertIndex(source,rows.length);assertIndex(target,rows.length);
  const gen=++pathGeneration,filters=normalizedFilters(payload.filters);
  const result=await shortestPath({source,target,maxHops:Math.max(1,Math.min(8,Number(payload.maxHops)||5)),maxVisited:12000,
    isCancelled:()=>gen!==pathGeneration,
    getNeighbors:i=>connections(i,'out',filters),
    onProgress:p=>self.postMessage({event:'path-progress',requestId:id,...p})});
  if(result.status==='found'){
    const nodes=result.nodes.map((i,k)=>({...node(i),position:[(k-(result.nodes.length-1)/2)*67,Math.sin(k*.9)*18,Math.cos(k*.9)*22],size:2.5}));
    result.view={mode:'path',nodes,edges:result.edges,matchedNodes:nodes.length,truncated:false,scope:'shortest-directed-path'};
    result.nodes=nodes;
  }
  return result;
}
self.onmessage=async({data:{id,type,payload={}}})=>{
  if(type==='cancel-path'){pathGeneration++;send(id,{cancelled:true});return;}
  try{
    if(type==='init'){send(id,await initialize(payload));return;}
    if(!rows)throw new Error('데이터 로딩이 끝나지 않았습니다.');
    let result;
    switch(type){
      case 'search':result=search(payload);break;
      case 'view':result=payload.mode==='local'?await localView(payload):overviewView(payload);break;
      case 'detail':result=await detail(payload);break;
      case 'node':result=node(payload.index,true);break;
      case 'resolve':{const i=rootIndex.get(String(payload.id));result=i===undefined?null:node(i,true);break;}
      case 'path':result=await path(payload,id);break;
      default:throw new Error('지원하지 않는 작업입니다.');
    }
    send(id,result);
  }catch(error){self.postMessage({id,ok:false,error:error.message,name:error.name});}
};
