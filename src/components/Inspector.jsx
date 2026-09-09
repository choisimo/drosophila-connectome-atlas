import React,{useState} from 'react';
import Icon,{IconButton} from './Icon.jsx';
import NodeRow,{number,compact} from './NodeRow.jsx';
import {NT_COLORS,SIDE_LABELS,NT} from '../lib/graph.js';
export default function Inspector({detail,loading,error,featured,onSelect,onClose,onBookmark,saved,onFocus,onSource,onTarget,notify,manifest}){
  const [direction,setDirection]=useState('out'),[showAllTags,setShowAllTags]=useState(false);
  const n=detail?.node;
  async function copy(){try{await navigator.clipboard.writeText(n.id);notify('root ID를 복사했습니다.');}catch{notify('복사 권한이 없습니다. ID를 직접 선택해 복사해 주세요.');}}
  return <aside className="inspector panel-surface" aria-label="뉴런 상세">
    <div className="panel-heading"><span><Icon name="focus" size={15}/>{n?'뉴런 상세':'살펴보기'}</span><IconButton icon="close" label="상세 패널 닫기" onClick={onClose}/></div>
    {loading?<div className="panel-loading"><div className="spinner"/>연결 불러오는 중</div>:error?<div className="inline-error" role="alert">{error}</div>:n?<>
      <div className="neuron-identity"><div className="identity-top"><span className="pill" style={{'--tag-color':NT_COLORS[n.nt]}}><i/>{n.nt==='UNKNOWN'?'미분류':n.nt}</span><IconButton icon="bookmark" active={saved.includes(n.id)} label={saved.includes(n.id)?'저장 해제':'뉴런 저장'} onClick={()=>onBookmark(n.id)}/></div>
        <h2>{n.cellType||n.name}</h2>{n.cellType&&<div className="identity-name">{n.name}</div>}
        <div className="root-id"><code>{n.id}</code><IconButton icon="copy" label="root ID 복사" onClick={copy}/></div>
        <div className="identity-meta"><span>{SIDE_LABELS[n.side]}</span><span>{n.superClass}</span><span>{n.dominantRegion||'연결 없음'}</span></div>
        <button className="primary-button full" onClick={()=>onFocus(n.index)}><Icon name="focus" size={16}/>연결에 집중</button>
      </div>
      <div className="inspector-metrics"><div><small>전체 입력 시냅스</small><strong>{number(n.inSyn)}</strong><span>{number(n.inPartners)}개 입력 뉴런</span></div><div><small>전체 출력 시냅스</small><strong>{number(n.outSyn)}</strong><span>{number(n.outPartners)}개 출력 뉴런</span></div></div>
      <div className="detail-section"><div className="section-heading"><h3>분류</h3></div><dl className="metadata-list"><dt>Class</dt><dd>{n.cellClass||'—'}</dd><dt>Subclass</dt><dd>{n.subClass||'—'}</dd><dt>Flow</dt><dd>{n.flow||'—'}</dd>{n.hemilineage&&<><dt>Hemilineage</dt><dd>{n.hemilineage}</dd></>}{n.additionalTypes&&<><dt>추가 유형</dt><dd>{n.additionalTypes}</dd></>}</dl>
        {n.tags.length>0&&<div className="tag-list">{(showAllTags?n.tags:n.tags.slice(0,3)).map(tag=><span key={tag}>{tag.replaceAll('_',' ')}</span>)}{n.tags.length>3&&<button onClick={()=>setShowAllTags(x=>!x)}>{showAllTags?'접기':`+${n.tags.length-3}`}</button>}</div>}
      </div>
      <details className="prediction-section"><summary>전달물질 예측 <span>{Math.round(n.confidence*100)}%</span><Icon name="down" size={13}/></summary><div className="prediction-bars">{NT.slice(0,6).map((nt,i)=><div key={nt}><span>{nt}</span><div><i style={{width:`${Math.min(100,Math.max(0,n.predictions[i]*100))}%`,background:NT_COLORS[nt]}}/></div><b>{Math.round(n.predictions[i]*100)}%</b></div>)}<p>원본 예측 점수입니다. 활동도·발화율·흥분/억제의 확정값이 아닙니다.</p></div></details>
      <div className="detail-section connections-section"><div className="section-heading"><h3>연결 뉴런</h3><span title="현재 필터를 통과한 연결. 상단 합계는 전체 데이터 기준입니다.">필터 적용</span></div>
        <div className="segmented small"><button className={direction==='in'?'active':''} onClick={()=>setDirection('in')}>입력 <b>{detail.incoming.length}</b></button><button className={direction==='out'?'active':''} onClick={()=>setDirection('out')}>출력 <b>{detail.outgoing.length}</b></button></div>
        <div className="neighbor-list">{(direction==='in'?detail.incoming:detail.outgoing).slice(0,80).map(c=><NodeRow key={`${direction}-${c.peer}`} node={c.node} onSelect={onSelect} weight={c.weight} direction={direction}/>)}{(direction==='in'?detail.incoming:detail.outgoing).length===0&&<div className="empty-small">조건에 맞는 연결이 없습니다.</div>}</div>
        {(direction==='in'?detail.incoming:detail.outgoing).length>80&&<div className="muted-footnote">시냅스 수 상위 80개 표시</div>}
      </div>
      <div className="inspector-footer"><button onClick={()=>onSource(n)}><span className="endpoint-dot a">A</span>시작으로</button><button onClick={()=>onTarget(n)}><span className="endpoint-dot b">B</span>도착으로</button></div>
    </>:<>
      <div className="overview-info"><span className="eyebrow">FLYWIRE / FAFB</span><h2>연결에서 시작하기</h2><p className="minor-copy">뉴런을 선택해 입출력 연결을 펼쳐보세요.</p><div className="summary-cards"><div><strong>{number(manifest?.neurons)}</strong><span>뉴런</span></div><div><strong>{compact(manifest?.synapses)}</strong><span>시냅스 합계</span></div></div></div>
      <div className="section-heading padded"><h3>탐색 시작점</h3><span>{featured.length}</span></div><div className="featured-list">{featured.map(n=><NodeRow key={n.id} node={n} onSelect={onSelect}/>)}</div>
      <div className="anatomy-note"><Icon name="cube" size={23}/><strong>분류 기반 3D 배치</strong><p>첨부 데이터에는 실제 좌표·형태가 없습니다. 점의 거리와 방향은 해부학적 위치를 뜻하지 않습니다.</p></div>
    </>}
  </aside>;
}
