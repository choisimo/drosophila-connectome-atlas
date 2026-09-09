export class DataClient {
  constructor(onEvent){
    this.worker=new Worker(new URL('../workers/data.worker.js',import.meta.url),{type:'module'});
    this.nextId=1;this.pending=new Map();this.closed=false;
    this.worker.onmessage=({data})=>{
      if(data.event){onEvent?.(data);return;}
      const p=this.pending.get(data.id);if(!p)return;this.pending.delete(data.id);
      if(data.ok)p.resolve(data.data);else{const error=new Error(data.error);error.name=data.name||'Error';p.reject(error);}
    };
    this.worker.onerror=()=>{const error=new Error('데이터 작업자를 시작할 수 없습니다. 서버 실행과 브라우저 개발자 콘솔을 확인해 주세요.');this.pending.forEach(p=>p.reject(error));this.pending.clear();onEvent?.({event:'fatal',message:error.message});};
  }
  request(type,payload={}){
    if(this.closed)return Promise.reject(new Error('데이터 세션이 종료되었습니다.'));
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,type,payload});});
  }
  dispose(){this.closed=true;this.worker.terminate();this.pending.forEach(p=>{const e=new Error('세션 종료');e.name='AbortError';p.reject(e);});this.pending.clear();}
}
export function downloadText(filename,text,type='application/json'){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export function loadSaved(){try{const value=JSON.parse(localStorage.getItem('neuro-atlas:saved')||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string').slice(0,500):[];}catch{return [];}}
export function saveBookmarks(value){try{localStorage.setItem('neuro-atlas:saved',JSON.stringify(value));return true;}catch{return false;}}
