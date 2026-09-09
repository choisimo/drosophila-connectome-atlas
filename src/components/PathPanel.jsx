import React from 'react';
import Icon from './Icon.jsx';
import {number} from './NodeRow.jsx';
const statuses={unreachable:'이 조건에서는 도달할 수 없습니다. 전체 도달 가능 영역을 확인했습니다.','hop-limited':'설정한 홉 수 안에서는 경로가 없습니다. 더 긴 경로는 있을 수 있습니다.','budget-limited':'12,000개 뉴런 탐색 한도에 도달했습니다. 경로가 없다는 뜻은 아닙니다.'};
export default function PathPanel({source,target,setSource,setTarget,maxHops,setMaxHops,busy,progress,result,error,onRun,onCancel,onSelect,minSyn,region,manifest}){
 return <section className="path-card panel-surface" aria-label="방향성 경로 탐색"><div className="path-card-title"><Icon name="route" size={17}/><h2>연결 경로</h2><span>최소 홉</span></div>
  <div className="endpoint-inputs"><label><span className="endpoint-dot a">A</span><input aria-label="시작 뉴런 ID" placeholder="시작 root ID" value={source} onChange={e=>setSource(e.target.value)} inputMode="numeric" autoComplete="off"/></label><div className="path-bridge"><i/><button title="시작과 도착 교환" aria-label="시작과 도착 교환" onClick={()=>{setSource(target);setTarget(source);}}><Icon name="swap" size={14}/></button></div><label><span className="endpoint-dot b">B</span><input aria-label="도착 뉴런 ID" placeholder="도착 root ID" value={target} onChange={e=>setTarget(e.target.value)} inputMode="numeric" autoComplete="off"/></label></div>
  <div className="path-options"><label>최대 홉<select value={maxHops} onChange={e=>setMaxHops(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}</select></label><span>시냅스 ≥ {minSyn}<br/>{region>=0?manifest.regions[region]:'모든 영역'}</span></div>
  <p className="path-hint">뉴런 상세의 A·B 버튼으로 지정할 수 있습니다. 경로에는 시냅스·영역 조건만 적용됩니다.</p>
  {busy?<button className="secondary-button full" onClick={onCancel}><span className="spinner tiny"/>탐색 취소</button>:<button className="primary-button full" disabled={!source.trim()||!target.trim()} onClick={onRun}><Icon name="route" size={16}/>경로 찾기</button>}
  {busy&&<div className="path-progress" role="status">{progress?`${progress.depth}홉 · ${number(progress.visited)}개 확인`:'방향성 연결 탐색 중…'}</div>}
  {error&&<div className="inline-error" role="alert">{error}</div>}
  {result&&<div className="path-result">{result.status==='found'?<><div className="path-result-summary"><Icon name="check" size={15}/><strong>{result.hops===0?'동일한 뉴런':`${result.hops}홉 경로`}</strong><span>{number(result.visited)}개 확인</span></div><ol>{result.nodes.map((n,i)=><li key={n.id}><button onClick={()=>onSelect(n.index)}><span className="path-step">{i+1}</span><span><strong>{n.cellType||n.name}</strong><small>{n.id}</small></span></button>{i<result.edges.length&&<div className="path-edge-weight">↓ {number(result.edges[i].weight)} 시냅스</div>}</li>)}</ol></>:<p className="path-status">{statuses[result.status]||'탐색을 완료했습니다.'}</p>}</div>}
 </section>;
}
