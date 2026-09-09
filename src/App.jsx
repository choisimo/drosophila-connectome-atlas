import React,{useCallback,useEffect,useRef,useState} from 'react';
import {DataClient,downloadText,loadSaved,saveBookmarks} from './lib/client.js';
import {DEFAULT_FILTERS,NT_COLORS,viewExport} from './lib/graph.js';
import NetworkScene from './components/SceneLoader.jsx';
import ExplorerSidebar from './components/ExplorerSidebar.jsx';
import Inspector from './components/Inspector.jsx';
import PathPanel from './components/PathPanel.jsx';
import DataPanel from './components/DataPanel.jsx';
import Icon,{IconButton} from './components/Icon.jsx';
import {number,compact} from './components/NodeRow.jsx';

const INITIAL_SETTINGS={colorBy:'nt',density:18000,edgeLimit:2200,pointSize:1.2,edgeOpacity:.16,showEdges:true,flow:false,autoRotate:false};
function Loading({progress,error,onRetry}){
  return <main className="loading-screen"><div className="loading-brand"><div className="brand-mark"><Icon name="network" size={27}/></div><h1>Neuro Atlas</h1></div><div className="loading-orbit"><span/><span/><span/><i/></div>{error?<div className="startup-error" role="alert"><p>{error}</p><button className="primary-button" onClick={onRetry}><Icon name="reset"/>다시 시도</button></div>:<><div className="load-title">{progress?.detail||'연결 데이터 준비 중'}</div><div className="loading-bar"><i style={{width:`${progress?.percent||2}%`}}/></div><span className="loading-percent">{progress?.percent||0}%</span></>}<footer>FLYWIRE · 실제 데이터 기반 3D 네트워크</footer></main>;
}
function SettingsPopover({settings,setSettings,onClose}){
  const set=(key,value)=>setSettings(s=>({...s,[key]:value}));
  return <><button className="popover-dismiss" onClick={onClose} aria-label="표시 설정 닫기"/><div className="settings-popover panel-surface"><div className="panel-heading"><span>표시 설정</span><IconButton icon="close" label="표시 설정 닫기" onClick={onClose}/></div><label>색상 기준<select value={settings.colorBy} onChange={e=>set('colorBy',e.target.value)}><option value="nt">전달물질</option><option value="class">상위 분류</option><option value="side">좌우</option></select></label><label>개요 최대 뉴런<select value={settings.density} onChange={e=>set('density',Number(e.target.value))}><option value={8000}>8,000 · 가볍게</option><option value={18000}>18,000 · 균형</option><option value={45000}>45,000 · 상세</option></select></label><label>개요 최대 연결<select value={settings.edgeLimit} onChange={e=>set('edgeLimit',Number(e.target.value))}><option value={800}>800</option><option value={2200}>2,200</option><option value={6000}>6,000</option></select></label><label>점 크기 <span>{settings.pointSize.toFixed(1)}</span><input type="range" min="0.6" max="3" step="0.1" value={settings.pointSize} onChange={e=>set('pointSize',Number(e.target.value))}/></label><label>연결 투명도 <span>{Math.round(settings.edgeOpacity*100)}%</span><input type="range" min="0.02" max="0.7" step="0.01" value={settings.edgeOpacity} onChange={e=>set('edgeOpacity',Number(e.target.value))}/></label><div className="toggle-row"><label htmlFor="edges-toggle">연결 표시</label><input id="edges-toggle" type="checkbox" checked={settings.showEdges} onChange={e=>set('showEdges',e.target.checked)}/></div><div className="toggle-row"><label htmlFor="flow-toggle" title="입자 이동은 연결 방향 표시이며, 발화나 활성도 시뮬레이션이 아닙니다.">방향 입자 <Icon name="info" size={12}/></label><input id="flow-toggle" type="checkbox" checked={settings.flow} onChange={e=>set('flow',e.target.checked)}/></div><div className="toggle-row"><label htmlFor="rotate-toggle">자동 회전</label><input id="rotate-toggle" type="checkbox" checked={settings.autoRotate} onChange={e=>set('autoRotate',e.target.checked)}/></div></div></>;
}
export default function App(){
  const [attempt,setAttempt]=useState(0),[manifest,setManifest]=useState(null),[featured,setFeatured]=useState([]),[progress,setProgress]=useState(null),[fatal,setFatal]=useState('');
  const [filters,setFilters]=useState({...DEFAULT_FILTERS}),[saved,setSaved]=useState(loadSaved),[results,setResults]=useState({items:[],total:0}),[offset,setOffset]=useState(0),[searchPending,setSearchPending]=useState(false);
  const [selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState('');
  const [networkView,setNetworkView]=useState(null),[viewMode,setViewMode]=useState('overview'),[direction,setDirection]=useState('both'),[localLimit,setLocalLimit]=useState(180),[viewPending,setViewPending]=useState(false),[viewError,setViewError]=useState('');
  const [tab,setTab]=useState('explore'),[leftOpen,setLeftOpen]=useState(true),[rightOpen,setRightOpen]=useState(true),[settingsOpen,setSettingsOpen]=useState(false),[settings,setSettings]=useState(INITIAL_SETTINGS),[stats,setStats]=useState(null),[hover,setHover]=useState(null),[toast,setToast]=useState('');
  const [source,setSource]=useState(''),[target,setTarget]=useState(''),[maxHops,setMaxHops]=useState(5),[pathBusy,setPathBusy]=useState(false),[pathProgress,setPathProgress]=useState(null),[pathResult,setPathResult]=useState(null),[pathError,setPathError]=useState('');
  const client=useRef(null),scene=useRef(null),searchRef=useRef(null),toastTimer=useRef(null),hoverSequence=useRef(0),pathRequestId=useRef(null),pathRun=useRef(0);
  const notify=useCallback(message=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4200);},[]);
  useEffect(()=>{
    let live=true;setFatal('');setManifest(null);setProgress(null);
    const c=new DataClient(event=>{if(!live)return;if(event.event==='progress')setProgress(event);if(event.event==='fatal')setFatal(event.message);if(event.event==='path-progress'&&event.requestId===pathRequestId.current)setPathProgress(event);});client.current=c;
    c.request('init',{base:new URL('./data/',window.location.href).href}).then(data=>{if(!live)return;setManifest(data.manifest);setFeatured(data.featured);}).catch(e=>{if(live)setFatal(e.message);});
    return ()=>{live=false;c.dispose();if(client.current===c)client.current=null;};
  },[attempt]);
  useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
  useEffect(()=>{
    const media=window.matchMedia('(max-width: 1000px)');
    const adapt=()=>{if(media.matches){setLeftOpen(false);setRightOpen(false);}};adapt();media.addEventListener('change',adapt);return()=>media.removeEventListener('change',adapt);
  },[]);
  useEffect(()=>{
    function key(event){const editing=event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]');if(editing)return;
      if(event.key==='/'){event.preventDefault();setLeftOpen(true);setTimeout(()=>searchRef.current?.focus(),0);}
      if(event.key==='Escape'){setSettingsOpen(false);setHover(null);if(window.innerWidth<=1000){setLeftOpen(false);setRightOpen(false);}}
    }
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);
  useEffect(()=>{
    if(!manifest)return;let stale=false;setSearchPending(true);
    const timer=setTimeout(()=>{client.current.request('search',{filters,saved,offset,limit:50}).then(data=>{if(!stale){setResults(data);setSearchPending(false);}}).catch(e=>{if(!stale){notify(e.message);setSearchPending(false);}});},130);
    return()=>{stale=true;clearTimeout(timer);};
  },[manifest,filters,saved,offset,notify]);
  useEffect(()=>{
    if(!manifest)return;let stale=false;setViewPending(true);setViewError('');
    const timer=setTimeout(()=>{client.current.request('view',{mode:viewMode==='local'&&selected!==null?'local':'overview',index:selected,direction,filters,saved,limit:viewMode==='local'?localLimit:settings.density,edgeLimit:settings.edgeLimit}).then(data=>{if(!stale){setNetworkView({...data,filterSnapshot:{...filters}});setViewPending(false);}}).catch(e=>{if(!stale){setViewError(e.message);setViewPending(false);}});},160);
    return()=>{stale=true;clearTimeout(timer);};
  },[manifest,selected,viewMode,direction,filters,saved,localLimit,settings.density,settings.edgeLimit]);
  useEffect(()=>{
    if(!manifest||selected===null){setDetail(null);setDetailLoading(false);return;}
    let stale=false;setDetailLoading(true);setDetailError('');
    client.current.request('detail',{index:selected,filters,saved}).then(data=>{if(!stale){setDetail(data);setDetailLoading(false);}}).catch(e=>{if(!stale){setDetailError(e.message);setDetailLoading(false);}});
    return()=>{stale=true;};
  },[manifest,selected,filters,saved]);
  const cancelPath=useCallback(()=>{pathRun.current++;pathRequestId.current=null;setPathBusy(false);setPathProgress(null);client.current?.request('cancel-path').catch(()=>{});},[]);
  useEffect(()=>{cancelPath();setPathResult(null);setPathError('');},[source,target,maxHops,filters.minSyn,filters.region,cancelPath]);
  const select=useCallback(index=>{setSelected(index);setViewMode('local');setRightOpen(true);setHover(null);if(window.innerWidth<=1000)setLeftOpen(false);},[]);
  const handleHover=useCallback(async hit=>{const seq=++hoverSequence.current;if(!hit){setHover(null);return;}try{const n=await client.current.request('node',{index:hit.index});if(seq===hoverSequence.current)setHover({...hit,node:n});}catch{if(seq===hoverSequence.current)setHover(null);}},[]);
  function bookmark(id){
    const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];if(next.length>500){notify('저장은 최대 500개까지 가능합니다.');return;}
    setSaved(next);if(!saveBookmarks(next))notify('브라우저 저장 공간에 기록하지 못했습니다. 현재 세션에서만 유지됩니다.');
  }
  function setEndpoint(which,node){cancelPath();setTab('path');setPathResult(null);setPathError('');if(which==='source')setSource(node.id);else setTarget(node.id);if(window.innerWidth<=1000)setRightOpen(false);}
  async function runPath(){
    if(!client.current)return;cancelPath();const seq=++pathRun.current;setPathBusy(true);setPathError('');setPathResult(null);setPathProgress(null);
    pathRequestId.current=client.current.nextId;
    try{const result=await client.current.request('path',{source,target,filters,maxHops});if(seq===pathRun.current){if(result.view)result.view.filterSnapshot={...filters};setPathResult(result);setPathBusy(false);pathRequestId.current=null;}}
    catch(e){if(seq===pathRun.current){setPathBusy(false);pathRequestId.current=null;if(e.name!=='CancelledError')setPathError(e.message);}}
  }
  const view=tab==='path'&&pathResult?.view?pathResult.view:networkView;
  function exportView(){
    if(!view||viewPending||viewError){notify('화면 갱신이 끝난 뒤 내보내기해 주세요.');return;}
    const indices=new Map(view.nodes.map(n=>[n.index,n.id]));
    const output=viewExport({manifest,nodes:view.nodes,edges:view.edges.map(e=>({...e,source:indices.get(e.source),target:indices.get(e.target)})),filters:view.filterSnapshot,mode:view.mode,truncated:view.truncated});
    downloadText(`neuro-atlas-${view.mode}.json`,JSON.stringify(output,null,2));notify('현재 표시된 그래프를 JSON으로 저장했습니다.');
  }
  function openPanel(which){if(which==='left'){setLeftOpen(v=>!v);if(window.innerWidth<=1000)setRightOpen(false);}else{setRightOpen(v=>!v);if(window.innerWidth<=1000)setLeftOpen(false);}}
  if(!manifest||fatal)return <Loading progress={progress} error={fatal} onRetry={()=>setAttempt(x=>x+1)}/>;
  const isPathView=view?.mode==='path';
  return <div className={`app ${leftOpen?'left-open':''} ${rightOpen?'right-open':''}`}>
    <header className="app-header"><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('explore');setViewMode('overview');}}><div className="brand-mark"><Icon name="network" size={22}/></div><span>Neuro <b>Atlas</b></span></a><div className="header-divider"/><button className="dataset-switch" onClick={()=>setTab(tab==='data'?'explore':'data')}><span className="live-dot"/>FlyWire <span className="dataset-version">FAFB</span><Icon name="down" size={12}/></button>
      <nav className="main-nav" aria-label="주 탐색"><button className={tab==='explore'?'active':''} onClick={()=>setTab('explore')}><Icon name="network" size={16}/><span>네트워크</span></button><button className={tab==='path'?'active':''} onClick={()=>setTab('path')}><Icon name="route" size={16}/><span>경로</span></button><button className={tab==='data'?'active':''} onClick={()=>setTab('data')}><Icon name="database" size={16}/><span>데이터</span></button></nav>
      <div className="header-right"><span className="header-count"><b>{number(manifest.neurons)}</b> 뉴런</span><button className="export-button" onClick={exportView} disabled={!view||viewPending||Boolean(viewError)}><Icon name="download" size={15}/><span>내보내기</span></button></div>
    </header>
    <div className="workspace">
      {leftOpen&&<ExplorerSidebar manifest={manifest} filters={filters} setFilters={setFilters} results={results} pending={searchPending} selected={selected} onSelect={select} saved={saved} offset={offset} setOffset={setOffset} searchRef={searchRef} onClose={()=>setLeftOpen(false)} pathMode={tab==='path'} onSource={n=>setEndpoint('source',n)} onTarget={n=>setEndpoint('target',n)}/>}
      <main className="viewport" aria-label="3D 네트워크 작업 공간">
        <NetworkScene ref={scene} view={view} selected={selected} settings={settings} onSelect={select} onHover={handleHover} onStats={setStats}/>
        <div className="viewport-title"><span className="eyebrow">{isPathView?'DIRECTED PATH':viewMode==='local'?'NEURON CONNECTIONS':'CONNECTOME EXPLORER'}</span><h1>{isPathView?'연결 경로':viewMode==='local'?(detail?.node.index===selected?detail.node.cellType||detail.node.name:'뉴런 연결'):'신경망 탐색'}</h1><div className="scope-badge"><span/>{isPathView?'최소 홉 방향성 경로':viewMode==='local'?'실제 연결 · 1홉 주변':'분류 기반 배치 · 실제 좌표 아님'}</div></div>
        <div className="viewport-actions"><IconButton icon="panel" label={leftOpen?'탐색 패널 접기':'탐색 패널 열기'} active={leftOpen} onClick={()=>openPanel('left')}/><IconButton icon="layers" label="표시 설정" active={settingsOpen} onClick={()=>setSettingsOpen(v=>!v)}/><IconButton icon="info" label={rightOpen?'상세 패널 접기':'상세 패널 열기'} active={rightOpen} onClick={()=>openPanel('right')}/></div>
        {settingsOpen&&<SettingsPopover settings={settings} setSettings={setSettings} onClose={()=>setSettingsOpen(false)}/>}
        {tab==='path'&&<PathPanel source={source} target={target} setSource={setSource} setTarget={setTarget} maxHops={maxHops} setMaxHops={setMaxHops} busy={pathBusy} progress={pathProgress} result={pathResult} error={pathError} onRun={runPath} onCancel={cancelPath} onSelect={index=>{setSelected(index);setRightOpen(true);scene.current?.focus(index);}} minSyn={filters.minSyn} region={filters.region} manifest={manifest}/>}
        {tab==='data'&&<DataPanel manifest={manifest} onClose={()=>setTab('explore')}/>}
        {view?.nodes.length===0&&!viewPending&&tab!=='data'&&<div className="canvas-empty"><Icon name="network" size={33}/><strong>표시할 뉴런이 없습니다.</strong><button onClick={()=>setFilters({...DEFAULT_FILTERS})}>필터 초기화</button></div>}
        {viewError&&<div className="view-error" role="alert"><Icon name="info" size={16}/>{viewError}<button onClick={()=>setFilters(f=>({...f}))}>재시도</button></div>}
        {(viewPending||pathBusy)&&<div className="view-busy" role="status"><span className="spinner tiny"/>{pathBusy?'경로 탐색 중':'그래프 갱신 중'}</div>}
        {hover&&tab!=='data'&&!settingsOpen&&<div className="node-tooltip" style={{left:Math.max(8,Math.min(hover.x+16,hostWidth())),top:Math.max(80,hover.y-36)}}><div><i style={{background:NT_COLORS[hover.node.nt]}}/><strong>{hover.node.cellType||hover.node.name}</strong><span>{hover.node.nt}</span></div><code>{hover.node.id}</code><small>입력 {number(hover.node.inSyn)} · 출력 {number(hover.node.outSyn)}</small></div>}
        {tab!=='data'&&<>
          <div className="scene-axis" aria-hidden="true"><svg width="66" height="66" viewBox="0 0 66 66"><path d="M32 34 56 41" stroke="#b68d87"/><path d="M32 34 13 49" stroke="#8ba990"/><path d="M32 34 32 9" stroke="#859aaf"/><circle cx="32" cy="34" r="3" fill="#7b8b95"/><text x="55" y="51">x</text><text x="7" y="56">y</text><text x="35" y="11">z</text></svg><span>임의 좌표</span></div>
          <div className="legend">{settings.colorBy==='nt'?Object.entries(NT_COLORS).map(([nt,c])=><button key={nt} className={filters.nt===nt?'active':''} onClick={()=>{setOffset(0);setFilters(f=>({...f,nt:f.nt===nt?'all':nt}));}}><i style={{background:c}}/>{nt==='UNKNOWN'?'미분류':nt}</button>):<span>{settings.colorBy==='side'?'좌우 분류':'상위 분류'} 색상</span>}</div>
          <div className="camera-tools"><IconButton icon="plus" label="확대" onClick={()=>scene.current?.zoom(.8)}/><IconButton icon="minus" label="축소" onClick={()=>scene.current?.zoom(1.25)}/><span/><IconButton icon="focus" label="전체 맞춤 (0)" onClick={()=>scene.current?.reset()}/><IconButton icon="camera" label="PNG 캡처" onClick={()=>{try{scene.current?.screenshot();}catch(e){notify(e.message);}}}/></div>
          <div className="bottom-toolbar"><div className="segmented"><button className={viewMode==='overview'&&!isPathView?'active':''} onClick={()=>{setTab('explore');setViewMode('overview');}}>전체</button><button disabled={selected===null} className={viewMode==='local'&&!isPathView?'active':''} onClick={()=>{setTab('explore');setViewMode('local');}}>선택 주변</button></div><span className="tool-divider"/>{viewMode==='local'&&!isPathView?<><select aria-label="연결 방향" value={direction} onChange={e=>setDirection(e.target.value)}><option value="both">입력 + 출력</option><option value="in">입력만</option><option value="out">출력만</option></select><select aria-label="표시할 주변 연결 수" value={localLimit} onChange={e=>setLocalLimit(Number(e.target.value))}><option value={80}>80 연결</option><option value={180}>180 연결</option><option value={600}>600 연결</option><option value={1200}>1,200 연결</option></select></>:<><button className="text-tool" onClick={()=>scene.current?.preset('front')}>정면</button><button className="text-tool" onClick={()=>scene.current?.preset('top')}>윗면</button></>}<span className="tool-divider"/><IconButton icon={settings.autoRotate?'pause':'play'} label={settings.autoRotate?'자동 회전 정지':'자동 회전'} active={settings.autoRotate} onClick={()=>setSettings(s=>({...s,autoRotate:!s.autoRotate}))}/></div>
          <div className="canvas-footnote">{settings.flow?'입자 이동 = 방향 표시 · 활동도 시뮬레이션 아님':'드래그 회전 · 스크롤 확대 · Shift + 드래그 이동'}</div>
        </>}
      </main>
      {rightOpen&&<Inspector detail={detail?.node.index===selected?detail:null} loading={detailLoading} error={detailError} featured={featured} onSelect={select} onClose={()=>setRightOpen(false)} onBookmark={bookmark} saved={saved} onFocus={i=>{setTab('explore');setViewMode('local');setSelected(i);setTimeout(()=>scene.current?.reset(),250);}} onSource={n=>setEndpoint('source',n)} onTarget={n=>setEndpoint('target',n)} notify={notify} manifest={manifest}/>}
      {(leftOpen||rightOpen)&&<button className="mobile-scrim" aria-label="패널 닫기" onClick={()=>{setLeftOpen(false);setRightOpen(false);}}/>}
    </div>
    <footer className="status-bar"><div><span className="live-dot"/><span>로컬 데이터</span><span className="status-separator">/</span><span className="status-layout">{view?.mode==='local'?'입출력 배치':view?.mode==='path'?'경로 배치':'유형 군집'} · 합성 좌표</span></div><div><span><b>{number(view?.nodes.length)}</b> 뉴런</span><span><b>{number(view?.edges.length)}</b> 연결 표시</span>{view?.truncated&&<span className="subset-label" title={view.mode==='overview'?`개요는 강한 연결 ${number(manifest.overviewPairs)}쌍만 후보로 사용합니다. 모든 연결은 뉴런을 선택해 탐색할 수 있습니다.`:`조건에 맞는 ${number(view.totalConnections)}개 연결 중 일부 표시`}>일부 표시</span>}<span className="status-fps">{stats?`${stats.fps} FPS`:'WebGL'}</span></div></footer>
    {toast&&<div className="toast" role="status"><Icon name="check" size={16}/>{toast}</div>}
  </div>;
}
function hostWidth(){const e=document.querySelector('.viewport');return Math.max(12,(e?.clientWidth||600)-245);}
