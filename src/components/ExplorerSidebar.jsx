import React,{useState} from 'react';
import Icon,{IconButton} from './Icon.jsx';
import NodeRow,{number} from './NodeRow.jsx';
import {NT_COLORS,DEFAULT_FILTERS,SIDE_LABELS} from '../lib/graph.js';
export default function ExplorerSidebar({manifest,filters,setFilters,results,pending,selected,onSelect,saved,offset,setOffset,searchRef,onClose,pathMode,onSource,onTarget}){
  const [showFilters,setShowFilters]=useState(true);
  const update=(key,value)=>{setOffset(0);setFilters(f=>({...f,[key]:value}));};
  const active=filters.nt!=='all'||filters.side!=='all'||filters.superClass!=='all'||filters.region>=0||filters.tag!=='all'||filters.minSyn!==5;
  return <aside className="explorer panel-surface" aria-label="뉴런 탐색">
    <div className="panel-heading"><span><Icon name="network" size={16}/>뉴런 탐색</span><div><IconButton icon="filter" label="필터 펼치기" active={showFilters||active} onClick={()=>setShowFilters(v=>!v)}/><IconButton icon="close" className="mobile-only" label="탐색 패널 닫기" onClick={onClose}/></div></div>
    <div className="search-box"><Icon name="search" size={17}/><input ref={searchRef} aria-label="뉴런 검색" placeholder="ID, 이름, 세포 유형 검색" value={filters.query} onChange={e=>update('query',e.target.value)}/>{filters.query?<IconButton icon="close" label="검색어 지우기" onClick={()=>update('query','')}/>:<kbd>/</kbd>}</div>
    <div className="sidebar-tabs"><button className={!filters.savedOnly?'active':''} onClick={()=>update('savedOnly',false)}>전체 뉴런</button><button className={filters.savedOnly?'active':''} onClick={()=>update('savedOnly',true)}><Icon name="bookmark" size={13}/>저장 <span>{saved.length}</span></button></div>
    {showFilters&&<div className="filter-controls">
      <div className="section-heading"><h3>전달물질</h3><IconButton icon="reset" label="필터 초기화" onClick={()=>{setOffset(0);setFilters(f=>({...DEFAULT_FILTERS,query:f.query,savedOnly:f.savedOnly}));}}/></div>
      <div className="nt-filter"><button className={filters.nt==='all'?'active':''} onClick={()=>update('nt','all')}>모두</button>{Object.keys(NT_COLORS).map(nt=><button key={nt} className={filters.nt===nt?'active':''} onClick={()=>update('nt',nt)} title={nt==='UNKNOWN'?'미분류':nt}><i style={{background:NT_COLORS[nt]}}/>{nt==='UNKNOWN'?'미분류':nt}</button>)}</div>
      <div className="filter-grid"><label>분류<select value={filters.superClass} onChange={e=>update('superClass',e.target.value)}><option value="all">모든 분류</option>{Object.keys(manifest.facets.superClass).map(c=><option key={c} value={c}>{c}</option>)}</select></label><label>좌우<select value={filters.side} onChange={e=>update('side',e.target.value)}><option value="all">모두</option>{['left','right','center','UNKNOWN'].map(s=><option value={s} key={s}>{SIDE_LABELS[s]}</option>)}</select></label></div>
      <label className="filter-label">연결 영역<select aria-label="연결 영역" value={filters.region} onChange={e=>update('region',Number(e.target.value))}><option value={-1}>모든 영역</option>{manifest.regions.map((r,i)=>({r,i})).sort((a,b)=>a.r.localeCompare(b.r)).map(({r,i})=><option key={r} value={i}>{r}</option>)}</select></label>
      <div className="threshold-heading"><label htmlFor="min-syn">최소 시냅스 <span title="같은 방향의 뉴런 쌍별 합계. 특정 영역을 선택하면 해당 영역만 합산합니다."><Icon name="info" size={12}/></span></label><input id="min-syn" type="number" min="1" max="100000" step="1" value={filters.minSyn} onChange={e=>update('minSyn',Math.max(1,Math.min(100000,Number(e.target.value)||1)))}/></div><input aria-label="최소 시냅스 슬라이더" type="range" min="1" max="150" value={Math.min(150,filters.minSyn)} onChange={e=>update('minSyn',Number(e.target.value))}/>
      <label className="tag-filter"><input type="checkbox" checked={filters.tag==='rich_club'} onChange={e=>update('tag',e.target.checked?'rich_club':'all')}/>Rich club만</label>
    </div>}
    <div className="list-heading"><span>{pending?'검색 중…':`${number(results.total)}개 뉴런`}</span><span>연결량순</span></div>
    <div className={`node-list ${pending?'pending':''}`} aria-busy={pending}>{results.items.map(n=><NodeRow key={n.id} node={n} selected={n.index===selected} onSelect={onSelect} onSetSource={pathMode?onSource:undefined} onSetTarget={pathMode?onTarget:undefined}/>)}{!pending&&results.total===0&&<div className="empty-state"><Icon name="search" size={25}/><strong>일치하는 뉴런이 없습니다.</strong><button onClick={()=>{setOffset(0);setFilters({...DEFAULT_FILTERS});}}>검색·필터 초기화</button></div>}</div>
    <div className="list-pagination"><span>{results.total?`${number(offset+1)}–${number(Math.min(offset+50,results.total))}`:'0'} / {number(results.total)}</span><div><IconButton icon="left" label="이전 뉴런 목록" disabled={offset===0||pending} onClick={()=>setOffset(Math.max(0,offset-50))}/><IconButton icon="chevron" label="다음 뉴런 목록" disabled={offset+50>=results.total||pending} onClick={()=>setOffset(offset+50)}/></div></div>
  </aside>;
}
