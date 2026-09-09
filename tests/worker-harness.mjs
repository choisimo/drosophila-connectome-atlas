import {parentPort} from 'node:worker_threads';
globalThis.self=globalThis;
globalThis.postMessage=data=>parentPort.postMessage(data);
await import('../src/workers/data.worker.js');
parentPort.on('message',data=>globalThis.onmessage({data}));
