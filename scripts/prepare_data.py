#!/usr/bin/env python3
"""Convert the six original FlyWire CSV.gz files to a versioned static dataset.

Never converts root IDs to float. Every connection row is retained, including
parallel neuropils and self-loops. A manifest is written last, atomically.
Dependencies: Python 3.10+, numpy, pandas. No network requests.
"""
from __future__ import annotations
import argparse, gzip, hashlib, json, os, shutil, sys, tempfile, time
from pathlib import Path
import numpy as np
import pandas as pd

FILES = ['neurons.csv.gz', 'names.csv.gz', 'classification.csv.gz',
         'connectivity_tags.csv.gz', 'consolidated_cell_types.csv.gz',
         'connections_princeton.csv.gz']
FIELDS = ['id','name','nt','confidence','superClass','cellClass','subClass','cellType',
          'group','side','flow','tags','additionalTypes','hemilineage','nerve','predictions']
SCHEMA = 1
SHARD_SIZE = 512

def write_gz(path: Path, payload: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, compresslevel=1, mtime=0) as f:
            f.write(payload)

def write_json_gz(path: Path, value):
    write_gz(path,json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode())

def hash01(values: np.ndarray, salt: int) -> np.ndarray:
    with np.errstate(over='ignore'):
        z = values.astype(np.uint64) + np.uint64(salt)
        z = (z ^ (z >> np.uint64(30))) * np.uint64(0xbf58476d1ce4e5b9)
        z = (z ^ (z >> np.uint64(27))) * np.uint64(0x94d049bb133111eb)
        z = z ^ (z >> np.uint64(31))
    return (z >> np.uint64(11)).astype(float) / 2**53

def sphere(values, salt):
    a = hash01(values,salt)*np.pi*2
    z = hash01(values,salt+53)*2-1
    r = np.cbrt(hash01(values,salt+107))
    xy = np.sqrt(np.maximum(0,1-z*z))
    return np.column_stack([r*xy*np.cos(a),r*xy*np.sin(a),r*z])

def schematic_positions(nodes: pd.DataFrame) -> np.ndarray:
    """Bilateral, class/type-based 3D packing. NOT measured brain coordinates."""
    roots = np.array([int(x) for x in nodes.root_id], dtype=np.uint64)
    side = nodes.side.map({'left':-1,'right':1,'center':0}).fillna(0).to_numpy(float)
    pos = np.empty((len(nodes),3),dtype=np.float64)
    centers = {
        'optic':(151,10,0,61), 'central':(44,18,0,53),
        'sensory':(124,-44,-69,45), 'visual_projection':(95,54,18,34),
        'visual_centrifugal':(83,32,57,23), 'ascending':(26,-90,20,25),
        'descending':(21,-108,-24,25), 'sensory_ascending':(58,-81,-49,21),
        'motor':(15,-135,12,15), 'endocrine':(12,75,-3,12)
    }
    type_keys = (nodes.super_class+'|'+nodes.primary_type+'|'+nodes['class']).to_numpy()
    type_hash = np.array([int.from_bytes(hashlib.blake2b(str(x).encode(),digest_size=8).digest(),'little') for x in type_keys],dtype=np.uint64)
    micro = sphere(roots,7891)
    cluster = sphere(type_hash,2317)
    for c,(x,y,z,r) in centers.items():
        mask=nodes.super_class.to_numpy()==c
        pos[mask]=np.column_stack([side[mask]*x,np.full(mask.sum(),y),np.full(mask.sum(),z)]) + cluster[mask]*r*.72 + micro[mask]*r*.37
    other=~nodes.super_class.isin(centers).to_numpy()
    pos[other]=micro[other]*55
    return pos.astype('<f4')

def require(frame,cols,name):
    missing=set(cols)-set(frame.columns)
    if missing: raise ValueError(f'{name}: missing columns: {sorted(missing)}')

def build(source: Path, output: Path):
    started=time.time()
    for name in FILES:
        if not (source/name).is_file(): raise FileNotFoundError(source/name)
    output.parent.mkdir(parents=True,exist_ok=True)
    staging=Path(tempfile.mkdtemp(prefix='.atlas-build-',dir=output.parent))
    try:
        frames={}
        for name in FILES[:-1]:
            frame=pd.read_csv(source/name,dtype=str,keep_default_na=False)
            require(frame,['root_id'],name)
            if frame.root_id.duplicated().any(): raise ValueError(f'{name}: duplicate root_id')
            if not frame.root_id.str.fullmatch(r'\d+').all(): raise ValueError(f'{name}: invalid root_id')
            frames[name]=frame.set_index('root_id')
        base=frames['neurons.csv.gz'].copy()
        for name in FILES[1:-1]:
            incoming=frames[name]
            unknown=incoming.index.difference(base.index)
            if len(unknown): raise ValueError(f'{name}: {len(unknown)} unrecognized root IDs')
            for col in incoming.columns:
                if col=='group' and col in base:
                    mismatch=(base[col]!='') & incoming[col].reindex(base.index).fillna('').ne(base[col])
                    if mismatch.any(): raise ValueError('group mismatch between neurons and names')
                else: base[col]=incoming[col].reindex(base.index).fillna('')
        base=base.reset_index().fillna(''); n=len(base)
        id_to_index={r:i for i,r in enumerate(base.root_id)}
        regions=[]; region_index={}; pre=[];post=[];weight=[];region=[]; nts=[]
        nt_names=['ACH','GABA','GLUT','DA','SER','OCT','UNKNOWN']
        nt_index={name:i for i,name in enumerate(nt_names)}
        n_rows=0; total_syn=0; self_loops=0
        print(f'Metadata: {n:,} neurons',flush=True)
        for chunk in pd.read_csv(source/FILES[-1],dtype={'pre_root_id':str,'post_root_id':str,'neuropil':str,'nt_type':str},keep_default_na=False,chunksize=500000):
            require(chunk,['pre_root_id','post_root_id','syn_count','neuropil','nt_type'],FILES[-1])
            a=chunk.pre_root_id.map(id_to_index); b=chunk.post_root_id.map(id_to_index)
            if a.isna().any() or b.isna().any(): raise ValueError('Connections refer to unknown neurons; nothing was silently discarded')
            w=pd.to_numeric(chunk.syn_count,errors='raise').to_numpy()
            if not np.isfinite(w).all() or np.any(w<1) or np.any(w!=np.floor(w)) or np.any(w>2**32-1):raise ValueError('Invalid syn_count')
            for r in chunk.neuropil.unique():
                if r not in region_index:region_index[r]=len(regions);regions.append(r)
            if not chunk.nt_type.isin(nt_names+['']).all():raise ValueError('Unknown neurotransmitter label')
            pa=a.to_numpy(dtype='<u4');pb=b.to_numpy(dtype='<u4')
            pre.append(pa);post.append(pb);weight.append(w.astype('<u4'))
            region.append(chunk.neuropil.map(region_index).to_numpy(dtype='<u4'))
            nts.append(chunk.nt_type.replace('','UNKNOWN').map(nt_index).to_numpy(dtype='<u4'))
            n_rows+=len(chunk);total_syn+=int(w.sum());self_loops+=int(np.sum(pa==pb))
        pre=np.concatenate(pre); post=np.concatenate(post);weight=np.concatenate(weight);region=np.concatenate(region);nts=np.concatenate(nts)
        print(f'Connections: {n_rows:,} rows / {total_syn:,} synapses',flush=True)
        R=len(regions)
        in_syn=np.bincount(post,weights=weight,minlength=n).astype('<u4')
        out_syn=np.bincount(pre,weights=weight,minlength=n).astype('<u4')
        in_rows=np.bincount(post,minlength=n).astype('<u4');out_rows=np.bincount(pre,minlength=n).astype('<u4')
        # Both endpoints count as participating in a neuropil; self-loops are counted once for membership.
        per_region=np.zeros((n,R),dtype=np.uint32)
        np.add.at(per_region,(pre,region),weight)
        np.add.at(per_region,(post,region),weight)
        dominant=np.argmax(per_region,axis=1).astype('<u4')
        masks=np.zeros((n,(R+31)//32),dtype='<u4')
        for r in range(R):masks[:,r//32]|=((per_region[:,r]>0).astype(np.uint32)<<np.uint32(r%32))
        metrics=np.column_stack([in_syn,out_syn,in_rows,out_rows,dominant,masks]).astype('<u4')
        write_gz(staging/'metrics.bin.gz',metrics.tobytes())
        write_gz(staging/'positions.bin.gz',schematic_positions(base).tobytes())
        predictions=['ach_avg','gaba_avg','glut_avg','da_avg','ser_avg','oct_avg']
        records=[]
        for row in base.to_dict('records'):
            records.append([row['root_id'],row['name'],row['nt_type'] or 'UNKNOWN',float(row['nt_type_score'] or 0),
              row['super_class'],row['class'],row['sub_class'],row['primary_type'],row['group'],row['side'],row['flow'],
              row['connectivity_tag'],row['additional_type(s)'],row['hemilineage'],row['nerve'],
              [float(row.get(p,0) or 0) for p in predictions]])
        write_json_gz(staging/'nodes.json.gz',records)
        out_order=np.lexsort((region,post,pre))
        sp=pre[out_order];st=post[out_order]
        pair_starts=np.r_[0,np.flatnonzero((sp[1:]!=sp[:-1])|(st[1:]!=st[:-1]))+1]
        pair_weights=np.add.reduceat(weight[out_order].astype(np.uint64),pair_starts)
        unique_pairs=len(pair_starts)
        unique_out=np.bincount(sp[pair_starts],minlength=n)
        unique_in=np.bincount(st[pair_starts],minlength=n)
        write_gz(staging/'partners.bin.gz',np.column_stack([unique_in,unique_out]).astype('<u4').tobytes())
        top_count=min(26000,len(pair_starts))
        top=np.argpartition(pair_weights,-top_count)[-top_count:]
        top=top[np.argsort(-pair_weights[top].astype(np.int64),kind='stable')]
        ends=np.r_[pair_starts[1:],n_rows]
        overview=[]
        for p in top:
            lo,hi=pair_starts[p],ends[p];idx=out_order[lo:hi]
            overview.append([int(pre[idx[0]]),int(post[idx[0]]),int(pair_weights[p]),
                             np.column_stack([region[idx],weight[idx],nts[idx]]).tolist()])
        write_json_gz(staging/'overview.json.gz',overview)
        for direction,key,peer,order in [('out',pre,post,out_order),('in',post,pre,None)]:
            if order is None:order=np.lexsort((region,pre,post))
            counts=np.bincount(key,minlength=n)
            offsets=np.r_[0,np.cumsum(counts,dtype=np.uint64)]
            rec=np.column_stack([peer[order],weight[order],region[order],nts[order]]).astype('<u4')
            directory=staging/direction;directory.mkdir()
            for shard,start in enumerate(range(0,n,SHARD_SIZE)):
                end=min(n,start+SHARD_SIZE);lo=int(offsets[start]);hi=int(offsets[end])
                local=(offsets[start:end+1]-lo).astype('<u4')
                # 5 uint32 header: magic/version, start index, node count, row count, record width.
                head=np.array([0x4e415431,start,end-start,hi-lo,4],dtype='<u4')
                write_gz(directory/f'{shard:04}.bin.gz',head.tobytes()+local.tobytes()+rec[lo:hi].tobytes())
            print(f'{direction}: {(n+SHARD_SIZE-1)//SHARD_SIZE} indexed shards',flush=True)
        featured=[]
        for keyword in ['MBON','DAN','T4','KC','DN','PN']:
            candidates=base.index[base.primary_type.str.startswith(keyword)].to_numpy()
            if len(candidates): featured.append(int(candidates[np.argmax(out_syn[candidates]+in_syn[candidates])]))
        hashes={name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in FILES}
        facets={k:base[col].replace('','UNKNOWN').value_counts().to_dict() for k,col in [('nt','nt_type'),('superClass','super_class'),('side','side'),('flow','flow')]}
        region_counts=np.bincount(region,weights=weight,minlength=R).astype(np.int64)
        audit={'neurons':n,'connectionRows':n_rows,'directedPairs':unique_pairs,'synapses':total_syn,
               'selfLoopRows':self_loops,'unknownEndpoints':0,'duplicateNeuronIds':0,
               'inputSynapseTotal':int(in_syn.astype(np.uint64).sum()),'outputSynapseTotal':int(out_syn.astype(np.uint64).sum()),
               'inputRows':int(in_rows.astype(np.uint64).sum()),'outputRows':int(out_rows.astype(np.uint64).sum()),
               'coordinatesPresent':False,'sourceSha256':hashes}
        assert audit['inputSynapseTotal']==audit['outputSynapseTotal']==total_syn
        assert audit['inputRows']==audit['outputRows']==n_rows
        files={}
        for asset in sorted(staging.rglob('*.gz')):
            raw=asset.read_bytes();payload=gzip.decompress(raw)
            files[asset.relative_to(staging).as_posix()]={
                'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                'payloadBytes':len(payload),'payloadSha256':hashlib.sha256(payload).hexdigest(),
            }
        integrity='gzip-dual-sha256-v1'
        version_seed={'sources':hashes,'schema':SCHEMA,'integrity':integrity}
        version=hashlib.sha256(json.dumps(version_seed,sort_keys=True).encode()).hexdigest()[:16]
        manifest={'schema':SCHEMA,'dataset':'FlyWire FAFB · uploaded CSVs','version':version,'integrity':integrity,
             'release':'Not encoded in the uploaded files; not inferred from counts',
             'fields':FIELDS,'neurons':n,'connectionRows':n_rows,'directedPairs':unique_pairs,'synapses':total_syn,
             'regions':regions,'regionSynapses':region_counts.tolist(),'ntNames':nt_names,'facets':facets,
             'shardSize':SHARD_SIZE,'metricsWidth':5+masks.shape[1],'featured':featured,
             'overviewPairs':top_count,'layout':{'type':'schematic-class-type','anatomical':False,'units':'arbitrary'},
             'audit':audit,'files':files,'builtSeconds':round(time.time()-started,2)}
        (staging/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        if output.exists():
            if any(output.iterdir()):
                backup=output.with_name(output.name+'.previous')
                if backup.exists():shutil.rmtree(backup)
                output.rename(backup)
                try:staging.rename(output)
                except BaseException:backup.rename(output);raise
                shutil.rmtree(backup)
            else:output.rmdir();staging.rename(output)
        else:staging.rename(output)
        print(json.dumps(audit,indent=2),flush=True)
        print(f'Built {sum(p.stat().st_size for p in output.rglob("* ".strip()) if p.is_file())/1e6:.1f} MB in {time.time()-started:.1f}s',flush=True)
    except BaseException:
        shutil.rmtree(staging,ignore_errors=True);raise

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',type=Path,required=True,help='Directory with all six original CSV.gz files')
    p.add_argument('--output',type=Path,default=Path('public/data'))
    args=p.parse_args()
    try:build(args.input.resolve(),args.output.resolve())
    except Exception as exc:print(f'Build failed: {exc}',file=sys.stderr);sys.exit(1)
