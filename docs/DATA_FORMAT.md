# Dataset contract · schema 1

`manifest.json` is authoritative. All root IDs are decimal **strings**, including exports and bookmarks. Small dense node indices are separate unsigned integers; never convert a root ID to JavaScript `Number`.

## Compression and integrity

Each listed `.gz` asset is gzip-compressed once. The manifest records compressed byte length and SHA-256. The worker verifies bytes using Web Crypto, then decompresses with `DecompressionStream('gzip')`. Serve as raw bytes without `Content-Encoding: gzip`. Dataset version binds the six source-file hashes. Generated positions are synthetic, not physical coordinates.

## Node metadata

`nodes.json.gz`: an array of rows. Field order is declared by `manifest.fields`:

```
[id, name, nt, confidence, superClass, cellClass, subClass, cellType,
 group, side, flow, tags, additionalTypes, hemilineage, nerve, predictions]
```

NT values: `ACH`, `GABA`, `GLUT`, `DA`, `SER`, `OCT`, `UNKNOWN` (use manifest ordering for numeric connection NT indices). Prediction vector order is ACH,GABA,GLUT,DA,SER,OCT. These are source predictions, not observed activity or universal receptor effects.

## Node arrays

All binary integers are little-endian unsigned 32-bit values; positions are little-endian Float32.

- `positions.bin.gz`: 3 floats per node, synthetic x,y,z.
- `metrics.bin.gz`: 8 integers per node: inSyn,outSyn,inRows,outRows,dominantRegion,regionBits0,regionBits1,regionBits2.
- `partners.bin.gz`: 2 integers per node: unique incoming peers, unique outgoing peers.
- Region membership is a 3-word bitset. Region i is word floor(i/32), bit i%32. Unknown region is not fabricated.

Current schema has 96 region slots and uint32 metrics; a future dataset exceeding those capacities must use a new schema or explicitly fail validation. Individual pair sums are computed as JavaScript numbers after aggregation; the present dataset's entire 50,666,648 total is safely within exact integer range.

## Adjacency shards

Directories `out/` and `in/` contain one file per 512 nodes. Files are named zero-padded shard indices, e.g. `0000.bin.gz`. Both orientations preserve every original region-specific connection row, not just the strongest pairs.

```
Uint32 header[5]:
  magic = 0x4e415431
  startNode
  nodeCount
  rowCount
  recordWidth = 4
Uint32 offsets[nodeCount + 1]
Uint32 records[rowCount * 4]:
  [peerNodeIndex, synapseCount, regionIndex, ntIndex]
```

Offsets are record offsets, not byte offsets. Outgoing records store postsynaptic peers; incoming records store presynaptic peers. For incoming edges, the NT code belongs to the presynaptic/source side in the uploaded connection row.

Validate magic, width, exact byte length, monotonic offsets, last offset == rowCount, node bounds and peer/region/NT bounds before using a shard. The worker has an 18-shard LRU and deduplicates in-flight loads.

## Connection semantics

Filter by region first, aggregate parallel rows for one ordered pair second, apply minimum synapse count third. A→B and B→A are different edges. Pair records include regional breakdowns. Filtering endpoints by classification is distinct from filtering a pair by its synapse count.

## Overview and path scope

`overview.json.gz` contains the strongest 26,000 unique ordered pairs with their source-derived regional counts. It is a biased overview optimization, not the full graph. Node LOD must retain all endpoints of displayed edges.

Path search uses complete outgoing adjacency, not overview candidates. It finds a minimum-hop directed route with maxHops and maxVisited limits. It applies region/minSyn, not metadata-list filters. A cancelled or exhausted search must not become a false no-path claim.

## Export

Exports include string root IDs, metadata, displayed nodes/edges, filter snapshot, synthetic-coordinate notice and subset/truncation status. They are not whole-dataset exports and are not measured anatomical reconstruction files.
