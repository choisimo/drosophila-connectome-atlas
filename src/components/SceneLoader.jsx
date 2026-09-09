import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import Icon from './Icon.jsx';
/** The dataset UI remains usable when WebGL or the portable CDN is unavailable. */
const SceneLoader=forwardRef(function SceneLoader(props,ref){
  const inner=useRef(null);const [Component,setComponent]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let live=true;import('./NetworkScene.jsx').then(m=>{if(live)setComponent(()=>m.default);}).catch(e=>{console.error('Three.js load:',e);if(live)setError('3D 라이브러리를 불러오지 못했습니다. 간편 실행판은 Three.js CDN 연결이 필요합니다. npm 실행판은 설치된 로컬 라이브러리를 사용합니다.');});return()=>{live=false;};},[]);
  useImperativeHandle(ref,()=>({reset:(...a)=>inner.current?.reset(...a),focus:(...a)=>inner.current?.focus(...a),zoom:(...a)=>inner.current?.zoom(...a),preset:(...a)=>inner.current?.preset(...a),screenshot:(...a)=>{if(!inner.current)throw new Error('3D 화면이 준비되지 않았습니다.');return inner.current.screenshot(...a);}}),[]);
  if(Component)return <Component ref={inner} {...props}/>;
  return <div className="scene-host">{error?<div className="webgl-error" role="alert"><Icon name="info" size={24}/><p>{error}</p><button onClick={()=>window.location.reload()}>페이지 다시 열기</button></div>:<div className="view-busy" role="status"><span className="spinner tiny"/>3D 엔진 로딩 중</div>}</div>;
});
export default SceneLoader;
