import React from 'react';
import Icon from './Icon.jsx';
import {NT_COLORS} from '../lib/graph.js';
export const number=n=>new Intl.NumberFormat('en-US').format(n??0);
export const compact=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':String(n??0);
export default function NodeRow({node,selected,onSelect,weight,direction,onSetSource,onSetTarget}){
  return <div className={`node-row ${selected?'selected':''}`}>
    <button className="node-main" onClick={()=>onSelect(node.index)} title={`${node.name}\n${node.id}`}>
      <i className="nt-dot" style={{background:NT_COLORS[node.nt]}}/>
      <span className="node-copy"><strong>{node.cellType||node.name}</strong><small>{node.cellType?node.name:node.id}</small></span>
      {weight!==undefined?<span className="row-weight">{direction==='in'?'↙':'↗'} {number(weight)}</span>:<span className="row-type">{node.nt==='UNKNOWN'?'—':node.nt}</span>}
      <Icon name="chevron" size={13}/>
    </button>
    {(onSetSource||onSetTarget)&&<div className="row-path-actions"><button onClick={()=>onSetSource(node)} title="시작 뉴런으로 설정">A</button><button onClick={()=>onSetTarget(node)} title="도착 뉴런으로 설정">B</button></div>}
  </div>;
}
