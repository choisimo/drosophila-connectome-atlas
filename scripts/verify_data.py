#!/usr/bin/env python3
"""Validate every compressed asset and adjacency shard, including full totals."""
import argparse,gzip,hashlib,json,time
from pathlib import Path
import numpy as np

def verify(root):
    started=time.time();m=json.loads((root/'manifest.json').read_text());N=m['neurons'];width=m['metricsWidth']
    checks={};metrics=np.frombuffer(gzip.decompress((root/'metrics.bin.gz').read_bytes()),dtype='<u4').reshape(N,width)
    positions=np.frombuffer(gzip.decompress((root/'positions.bin.gz').read_bytes()),dtype='<f4').reshape(N,3)
    nodes=json.loads(gzip.decompress((root/'nodes.json.gz').read_bytes()));ids=[n[0] for n in nodes]
    assert len(ids)==N==len(set(ids));assert all(isinstance(i,str) and i.isdigit() for i in ids);assert np.isfinite(positions).all()
    checks['root_ids_unique_strings']=True;checks['positions_finite_schematic']=True
    checked=0
    assert m.get('integrity')=='gzip-dual-sha256-v1'
    for name,entry in m['files'].items():
        b=(root/name).read_bytes();assert len(b)==entry['bytes'],name;assert hashlib.sha256(b).hexdigest()==entry['sha256'],name
        payload=gzip.decompress(b);assert len(payload)==entry['payloadBytes'],name;assert hashlib.sha256(payload).hexdigest()==entry['payloadSha256'],name;checked+=1
    checks['asset_checksums']=checked
    for direction,metricSyn,metricRows in [('in',0,2),('out',1,3)]:
        count=total=0;seen=np.zeros(N,dtype=bool);shards=0
        for p in sorted((root/direction).glob('*.gz')):
            u=np.frombuffer(gzip.decompress(p.read_bytes()),dtype='<u4');magic,start,n,rows,recordWidth=map(int,u[:5]);assert magic==0x4e415431 and recordWidth==4
            assert len(u)==5+n+1+rows*4;offset=u[5:5+n+1];r=u[5+n+1:].reshape(rows,4)
            assert offset[0]==0 and offset[-1]==rows and np.all(offset[1:]>=offset[:-1])
            assert not seen[start:start+n].any();seen[start:start+n]=True
            assert np.all(r[:,0]<N);assert np.all(r[:,1]>0);assert np.all(r[:,2]<len(m['regions']));assert np.all(r[:,3]<len(m['ntNames']))
            prefix=np.r_[np.uint64(0),np.cumsum(r[:,1],dtype=np.uint64)];node_sum=prefix[offset[1:]]-prefix[offset[:-1]]
            assert np.array_equal(node_sum,metrics[start:start+n,metricSyn]);assert np.array_equal(offset[1:]-offset[:-1],metrics[start:start+n,metricRows])
            count+=rows;total+=int(r[:,1].astype(np.uint64).sum());shards+=1
        assert seen.all();assert count==m['connectionRows'];assert total==m['synapses']
        checks[direction]={'shards':shards,'connectionRows':count,'synapses':total,'everyNeuronMatched':True}
    pairs=json.loads(gzip.decompress((root/'overview.json.gz').read_bytes()))
    assert len(pairs)==m['overviewPairs'];last=10**15
    for pre,post,w,rs in pairs:
        assert 0<=pre<N and 0<=post<N;assert sum(r[1] for r in rs)==w;assert w<=last;last=w
    checks['overview_aggregates']=len(pairs)
    return {'passed':True,'datasetVersion':m['version'],'checks':checks,'seconds':round(time.time()-started,3),'audit':m['audit']}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--data',type=Path,default=Path('public/data'));p.add_argument('--output',type=Path);args=p.parse_args()
    result=verify(args.data);text=json.dumps(result,ensure_ascii=False,indent=2);print(text)
    if args.output:args.output.write_text(text+'\n')
