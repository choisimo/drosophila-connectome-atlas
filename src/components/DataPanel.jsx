import React from 'react';
import Icon,{IconButton} from './Icon.jsx';
import {number} from './NodeRow.jsx';
import {downloadText} from '../lib/client.js';
export default function DataPanel({manifest,onClose}){
 const a=manifest.audit;const sourceNames=Object.keys(a.sourceSha256);
 return <section className="data-panel panel-surface" aria-label="원본 데이터와 검증"><header><div><span className="eyebrow">DATASET</span><h2>FlyWire FAFB</h2></div><IconButton icon="close" label="데이터 패널 닫기" onClick={onClose}/></header>
  <div className="dataset-stat-grid">{[['뉴런',manifest.neurons],['방향성 뉴런 쌍',manifest.directedPairs],['연결 행',manifest.connectionRows],['시냅스 합계',manifest.synapses]].map(([label,value])=><div key={label}><strong>{number(value)}</strong><span>{label}</span></div>)}</div>
  <div className="dataset-integrity"><Icon name="check" size={16}/><span>입력·출력 합계 일치 · 알 수 없는 연결 대상 0개</span><code>{manifest.version}</code></div>
  <div className="data-columns"><div><h3>첨부 원본 6개</h3><div className="source-file-list">{sourceNames.map((name,i)=><details key={name}><summary><Icon name="database" size={15}/><span>{name}</span><Icon name="down" size={13}/></summary><code>SHA-256<br/>{a.sourceSha256[name]}</code></details>)}</div></div><div><h3>표현 범위</h3><dl className="data-facts"><dt>좌표</dt><dd>유형·분류 기반 합성 배치</dd><dt>실제 3D 좌표 / 형태</dt><dd>첨부 데이터에 없음</dd><dt>개요</dt><dd>연결 강도 상위 {number(manifest.overviewPairs)}쌍에서 표시</dd><dt>뉴런 상세</dt><dd>전체 인덱스의 입출력 연결을 지연 로딩</dd><dt>경로</dt><dd>방향성 BFS · 최대 12,000개 방문</dd><dt>원본 릴리스 번호</dt><dd>파일에 명시되지 않아 추정하지 않음</dd><dt>신경 활동 / 학습 모델</dt><dd>제공하지 않음</dd></dl></div></div>
  <div className="dataset-region-header"><h3>시냅스 수 상위 영역</h3><span>{manifest.regions.length}개 영역</span></div><div className="region-summary">{manifest.regions.map((name,i)=>({name,count:manifest.regionSynapses[i]})).sort((a,b)=>b.count-a.count).slice(0,8).map(r=><div key={r.name}><span>{r.name}</span><div><i style={{width:`${r.count/Math.max(...manifest.regionSynapses)*100}%`}}/></div><strong>{number(r.count)}</strong></div>)}</div>
  <footer><button className="secondary-button" onClick={()=>downloadText('neuro-atlas-manifest.json',JSON.stringify(manifest,null,2))}><Icon name="download" size={16}/>매니페스트 저장</button><a className="text-link" href="https://codex.flywire.ai/" target="_blank" rel="noreferrer">FlyWire Codex<Icon name="external" size={14}/></a></footer>
 </section>;
}
