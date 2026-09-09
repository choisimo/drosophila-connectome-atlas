import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {NT_COLORS,mix32} from '../lib/graph.js';
import Icon from './Icon.jsx';

const pointVertex=`attribute float aSize; attribute float aSelected; varying vec3 vColor; varying float vSelected;
uniform float uScale; void main(){vColor=color;vSelected=aSelected;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(aSize*uScale*(330.0/-mv.z),1.4,28.0);gl_Position=projectionMatrix*mv;}`;
const pointFragment=`varying vec3 vColor; varying float vSelected; uniform float uOpacity;
void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;
float core=1.0-smoothstep(0.10,0.73,d);float glow=(1.0-d)*0.38;
vec3 c=mix(vColor,vec3(1.0),core*0.37+vSelected*0.25);gl_FragColor=vec4(c,(core+glow)*uOpacity);}`;
const flowVertex=`attribute vec3 aStart;attribute vec3 aControl;attribute vec3 aEnd;attribute float aPhase;
uniform float uTime;varying vec3 vColor;void main(){float t=fract(uTime*0.15+aPhase);vec3 p=(1.0-t)*(1.0-t)*aStart+2.0*(1.0-t)*t*aControl+t*t*aEnd;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(3.5*330.0/-mv.z,1.5,6.0);vColor=color;}`;
const flowFragment=`varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(vColor,1.-smoothstep(.2,1.,d));}`;
const classColors={optic:'#83b8dc',central:'#97ddbd',sensory:'#d3acdf',visual_projection:'#e9bf86',ascending:'#a7a2ed',descending:'#eb979a',motor:'#cfdb94',visual_centrifugal:'#98c9c9',sensory_ascending:'#c79c93',endocrine:'#dbd19c'};
const sides={left:'#91c7ed',right:'#e5b1a0',center:'#98d4ac','':'#7c8793'};
function colorOf(node,by){return new THREE.Color(by==='side'?(sides[node.side]||'#7c8793'):by==='class'?(classColors[node.superClass]||'#7c8793'):(NT_COLORS[node.nt]||NT_COLORS.UNKNOWN));}
function curveFor(a,b,edge){
  if(edge.source===edge.target){const c=new THREE.Vector3(a.x+14,a.y+18,a.z+10);return new THREE.QuadraticBezierCurve3(a,c,new THREE.Vector3(a.x+.2,a.y,a.z));}
  const c=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5);
  const length=a.distanceTo(b);c.z+=Math.min(46,length*.20)*(mix32(edge.source^edge.target)%2?1:-1);
  c.y+=Math.min(15,length*.07);return new THREE.QuadraticBezierCurve3(a,c,b);
}
function disposeGroup(group){
  while(group.children.length){const c=group.children[0];group.remove(c);c.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}
}

const NetworkScene=forwardRef(function NetworkScene({view,selected,settings,onSelect,onHover,onStats},ref){
  const host=useRef(null),engine=useRef(null),callbacks=useRef({onSelect,onHover,onStats});
  const [error,setError]=useState(''),[recovery,setRecovery]=useState(0);
  callbacks.current={onSelect,onHover,onStats};
  useImperativeHandle(ref,()=>({
    reset(){engine.current?.fit();},
    focus(index){const e=engine.current;if(!e)return;const p=e.nodePositions.get(index);if(p){e.targetTarget.copy(p);e.targetCamera.copy(p).add(new THREE.Vector3(0,25,100));e.animateCamera=true;}},
    zoom(scale){const e=engine.current;if(!e)return;const offset=e.camera.position.clone().sub(e.controls.target).multiplyScalar(scale);e.camera.position.copy(e.controls.target).add(offset);e.controls.update();},
    preset(name){const e=engine.current;if(!e)return;const d=Math.max(100,e.camera.position.distanceTo(e.controls.target));const direction=name==='top'?new THREE.Vector3(0,1,.0001):name==='side'?new THREE.Vector3(1,.12,0):new THREE.Vector3(0,.1,1);e.targetTarget.copy(e.controls.target);e.targetCamera.copy(e.controls.target).add(direction.normalize().multiplyScalar(d));e.animateCamera=true;},
    screenshot(){const e=engine.current;if(!e)throw new Error('3D 화면이 준비되지 않았습니다.');e.renderer.render(e.scene,e.camera);e.renderer.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='neuro-atlas.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);});}
  }),[]);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}
    catch{setError('WebGL을 시작할 수 없습니다. 브라우저의 하드웨어 가속을 확인해 주세요. 검색과 데이터 탐색은 계속 사용할 수 있습니다.');return;}
    setError('');renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.setClearColor(0x0b1117,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label','뉴런 연결의 3차원 그래프. 회전은 드래그, 확대는 스크롤. 뉴런 선택은 왼쪽 목록에서도 가능합니다.');
    renderer.domElement.setAttribute('role','img');renderer.domElement.tabIndex=0;element.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(44,1,.1,4000);camera.position.set(0,55,620);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=18;controls.maxDistance=1600;controls.autoRotateSpeed=.42;controls.target.set(0,-15,0);
    const graph=new THREE.Group();scene.add(graph);
    const raycaster=new THREE.Raycaster();raycaster.params.Points.threshold=2.1;
    const pointer=new THREE.Vector2(),clock=new THREE.Clock();let running=true,frame,visible=true,dragStart=null,hovered=-1,moveAt=0,frames=0,lastStats=performance.now();
    const e={renderer,scene,camera,controls,graph,points:null,nodePositions:new Map(),nodes:[],selected:null,flowMaterial:null,flow:null,nodeMaterial:null,edgeMaterial:null,
      animateCamera:false,targetTarget:new THREE.Vector3(),targetCamera:new THREE.Vector3(),settings:{},
      fit(){const box=new THREE.Box3();e.nodePositions.forEach(p=>box.expandByPoint(p));if(box.isEmpty())return;
        const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
        const vFov=THREE.MathUtils.degToRad(camera.fov),distance=Math.max(size.y,size.x/camera.aspect)/(2*Math.tan(vFov/2))+size.z*.55;
        e.targetTarget.copy(center);e.targetCamera.copy(center).add(new THREE.Vector3(0,distance*.08,Math.max(85,distance*1.18)));e.animateCamera=true;
      }
    };engine.current=e;
    const resize=()=>{const {width,height}=element.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(element);resize();
    const selectAt=(event,isClick)=>{
      if(!e.points||!e.nodes.length)return;const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObject(e.points,false);
      if(hits.length)hits.sort((a,b)=>a.distanceToRay-b.distanceToRay||a.distance-b.distance);
      const hit=hits[0],index=hit?e.nodes[hit.index]?.index:-1;
      if(isClick){if(index>=0)callbacks.current.onSelect?.(index);}
      else if(index!==hovered){hovered=index;renderer.domElement.style.cursor=index>=0?'pointer':'grab';callbacks.current.onHover?.(index>=0?{index,x:event.clientX-rect.left,y:event.clientY-rect.top}:null);}
    };
    const down=event=>{dragStart={x:event.clientX,y:event.clientY};e.animateCamera=false;};
    const up=event=>{if(dragStart&&Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)<5)selectAt(event,true);dragStart=null;};
    const move=event=>{if(dragStart)return;const now=performance.now();if(now-moveAt<55)return;moveAt=now;selectAt(event,false);};
    const leave=()=>{hovered=-1;callbacks.current.onHover?.(null);};
    const lost=event=>{event.preventDefault();setError('GPU 컨텍스트가 중단되었습니다. 3D 화면을 다시 열어 복구할 수 있습니다.');running=false;};
    const key=event=>{if(event.key==='0'){e.fit();event.preventDefault();}if(event.key==='Escape')leave();};
    const visibility=()=>{visible=!document.hidden;clock.getDelta();};
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerleave',leave);renderer.domElement.addEventListener('webglcontextlost',lost);renderer.domElement.addEventListener('keydown',key);document.addEventListener('visibilitychange',visibility);
    const loop=()=>{frame=requestAnimationFrame(loop);if(!running||!visible)return;
      const delta=Math.min(.05,clock.getDelta());
      if(e.animateCamera){camera.position.lerp(e.targetCamera,.085);controls.target.lerp(e.targetTarget,.085);if(camera.position.distanceTo(e.targetCamera)<.1)e.animateCamera=false;}
      controls.update(delta);if(e.flowMaterial)e.flowMaterial.uniforms.uTime.value=clock.elapsedTime;
      renderer.render(scene,camera);frames++;
      const now=performance.now();if(now-lastStats>1500){callbacks.current.onStats?.({fps:Math.round(frames*1000/(now-lastStats)),drawCalls:renderer.info.render.calls});lastStats=now;frames=0;}
    };loop();
    return ()=>{running=false;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerleave',leave);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('keydown',key);controls.dispose();disposeGroup(graph);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();engine.current=null;};
  },[recovery]);
  useEffect(()=>{
    const e=engine.current;if(!e||!view)return;
    disposeGroup(e.graph);e.nodes=view.nodes;e.nodePositions=new Map();e.selected=selected;e.flowMaterial=null;e.nodeMaterial=null;e.edgeMaterial=null;e.flow=null;
    const n=view.nodes.length,position=new Float32Array(n*3),color=new Float32Array(n*3),size=new Float32Array(n),sel=new Float32Array(n);
    for(let i=0;i<n;i++){const node=view.nodes[i];position.set(node.position,i*3);colorOf(node,settings.colorBy).toArray(color,i*3);size[i]=node.size||1.5;sel[i]=node.index===selected?1:0;e.nodePositions.set(node.index,new THREE.Vector3(...node.position));}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('color',new THREE.BufferAttribute(color,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(size,1));geometry.setAttribute('aSelected',new THREE.BufferAttribute(sel,1));geometry.computeBoundingSphere();
    const mat=new THREE.ShaderMaterial({vertexShader:pointVertex,fragmentShader:pointFragment,transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,uniforms:{uScale:{value:settings.pointSize*3.2},uOpacity:{value:1}}});e.nodeMaterial=mat;
    const points=new THREE.Points(geometry,mat);e.points=points;e.graph.add(points);
    const linePositions=[],lineColors=[],starts=[],ends=[],control=[],phases=[],flowColors=[],flowPosition=[];
    const ntByIndex=new Map(view.nodes.map(node=>[node.index,node]));
    for(let k=0;k<view.edges.length;k++){
      const edge=view.edges[k],a=e.nodePositions.get(edge.source),b=e.nodePositions.get(edge.target);if(!a||!b)continue;
      const c=colorOf(ntByIndex.get(edge.source),settings.colorBy),curve=curveFor(a,b,edge),samples=curve.getPoints(view.mode==='overview'?5:13);
      const intensity=view.mode==='overview'?.52:.87;
      for(let j=0;j<samples.length-1;j++){linePositions.push(...samples[j].toArray(),...samples[j+1].toArray());lineColors.push(c.r*intensity,c.g*intensity,c.b*intensity,c.r*intensity,c.g*intensity,c.b*intensity);}
      if(k<3500){starts.push(...a.toArray());ends.push(...b.toArray());control.push(...curve.v1.toArray());phases.push((mix32(edge.source+edge.target)%1000)/1000);flowColors.push(c.r,c.g,c.b);flowPosition.push(...a.toArray());}
    }
    const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));lines.setAttribute('color',new THREE.Float32BufferAttribute(lineColors,3));
    const edgeMat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:settings.edgeOpacity,depthWrite:false,blending:THREE.AdditiveBlending});e.edgeMaterial=edgeMat;
    const segments=new THREE.LineSegments(lines,edgeMat);segments.visible=settings.showEdges;e.edgeSegments=segments;e.graph.add(segments);
    const fgeo=new THREE.BufferGeometry();fgeo.setAttribute('position',new THREE.Float32BufferAttribute(flowPosition,3));fgeo.setAttribute('aStart',new THREE.Float32BufferAttribute(starts,3));fgeo.setAttribute('aControl',new THREE.Float32BufferAttribute(control,3));fgeo.setAttribute('aEnd',new THREE.Float32BufferAttribute(ends,3));fgeo.setAttribute('aPhase',new THREE.Float32BufferAttribute(phases,1));fgeo.setAttribute('color',new THREE.Float32BufferAttribute(flowColors,3));
    const fm=new THREE.ShaderMaterial({vertexShader:flowVertex,fragmentShader:flowFragment,transparent:true,vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0}}});
    const flow=new THREE.Points(fgeo,fm);flow.frustumCulled=false;flow.visible=settings.flow&&settings.showEdges;e.graph.add(flow);e.flowMaterial=fm;e.flow=flow;
    const layoutKey=view.mode==='local'?`local:${view.selected}`:view.mode==='path'?`path:${view.nodes.map(n=>n.index).join(':')}`:'overview';
    if(e.lastLayout!==layoutKey || !e.didFit){e.fit();e.lastLayout=layoutKey;e.didFit=true;}
  },[view,recovery,settings.colorBy]);
  useEffect(()=>{const e=engine.current;if(!e)return;e.controls.autoRotate=settings.autoRotate;if(e.nodeMaterial)e.nodeMaterial.uniforms.uScale.value=settings.pointSize*3.2;if(e.edgeMaterial)e.edgeMaterial.opacity=settings.edgeOpacity;if(e.edgeSegments)e.edgeSegments.visible=settings.showEdges;if(e.flow)e.flow.visible=settings.flow&&settings.showEdges;
    if(e.points){const s=e.points.geometry.getAttribute('aSelected');for(let i=0;i<e.nodes.length;i++)s.setX(i,e.nodes[i].index===selected?1:0);s.needsUpdate=true;}
  },[settings,selected,view,recovery]);
  return <div className="scene-host" ref={host}>{error&&<div className="webgl-error" role="alert"><Icon name="info" size={26}/><p>{error}</p><button onClick={()=>{setError('');setRecovery(v=>v+1);}}>3D 다시 열기</button></div>}</div>;
});
export default NetworkScene;
