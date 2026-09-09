#!/usr/bin/env node
/** Produces unbundled browser ESM. React is local, Three.js is version-pinned CDN. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let ts;
try{ts=(await import('typescript')).default;}catch{
  if(!process.env.NEURO_TYPESCRIPT_PATH)throw new Error('Run npm install first, or provide NEURO_TYPESCRIPT_PATH to an existing TypeScript package.');
  ts=createRequire(import.meta.url)(process.env.NEURO_TYPESCRIPT_PATH);
}
const dest=path.join(root,'portable');await fs.rm(dest,{recursive:true,force:true});await fs.mkdir(dest,{recursive:true});
let count=0;
async function walk(source,target){
  await fs.mkdir(target,{recursive:true});
  for(const entry of await fs.readdir(source,{withFileTypes:true})){
    const a=path.join(source,entry.name),b=path.join(target,entry.name.replace(/\.jsx$/,'.js'));
    if(entry.isDirectory()){await walk(a,b);continue;}
    if(/\.(jsx|js)$/.test(entry.name)){
      const result=ts.transpileModule(await fs.readFile(a,'utf8'),{fileName:a,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React}});
      const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
      if(errors.length)throw new Error(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
      let text=result.outputText.replace(/\.jsx(['"])/g,'.js');
      text=text.replace(/^import ['"]\.\/styles\.css['"];?\s*$/m,'');
      await fs.writeFile(b,text);count++;
    }else await fs.copyFile(a,b);
  }
}
await walk(path.join(root,'src'),path.join(dest,'src'));
await fs.cp(path.join(root,'public/data'),path.join(dest,'data'),{recursive:true});
await fs.cp(path.join(root,'vendor'),path.join(dest,'vendor'),{recursive:true});
let html=await fs.readFile(path.join(root,'index.html'),'utf8');
const map={imports:{react:'./vendor/react.mjs','react-dom/client':'./vendor/react-dom-client.mjs',three:'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js','three/addons/':'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/'}};
html=html.replace('</head>',`<link rel="stylesheet" href="./src/styles.css"/><script type="importmap">${JSON.stringify(map)}</script></head>`).replace('src="/src/main.jsx"','src="./src/main.js"');
await fs.writeFile(path.join(dest,'index.html'),html);
console.log(`Portable ESM build: ${count} modules. Data copied. Three.js requires CDN connectivity.`);
