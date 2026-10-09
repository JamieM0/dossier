import { createReadStream, createWriteStream, readFileSync, writeFileSync } from 'node:fs';
import { createGzip, createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { basename, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

export async function writeCorroborationReport(report, output) {
  const archive=output.replace(/\.json$/,'.jsonl.gz');
  const summary={...report,viewerResults:[],failures:[]};
  const shards=[];
  for(let i=0;i<report.viewerResults.length;i+=32){
    const viewers=report.viewerResults.slice(i,i+32),path=output.replace(/\.json$/,`-traces-${i/32+1}.jsonl.gz`);
    await pipeline(Readable.from(viewers.map(viewer=>JSON.stringify({type:'viewer',viewer})+'\n')),createGzip({level:9}),createWriteStream(path));
    shards.push({type:'shard',path:basename(path),viewers:viewers.length,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
  }
  function* records(){
    yield JSON.stringify({type:'summary',report:summary})+'\n';
    for(const shard of shards)yield JSON.stringify(shard)+'\n';
    for(const failure of report.failures)yield JSON.stringify({type:'failure',failure})+'\n';
  }
  await pipeline(Readable.from(records()),createGzip({level:9}),createWriteStream(archive));
  const manifest={...summary,traceArchive:basename(archive),traceFormat:'ndjson-v1',
    failures:report.failures.map(({viewer,seed,arms})=>({viewer,seed,arms}))};
  writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
}

export async function readCorroborationReport(path){
  if(!path.endsWith('.jsonl.gz')){
    const report=JSON.parse(readFileSync(path));
    return report.traceArchive?readCorroborationReport(join(dirname(path),report.traceArchive)):report;
  }
  const reader=createInterface({input:createReadStream(path).pipe(createGunzip()),crlfDelay:Infinity});
  let report;
  for await(const line of reader){
    const record=JSON.parse(line);
    if(record.type==='summary')report=record.report;
    else if(record.type==='shard'){
      const shardPath=join(dirname(path),record.path);
      if(createHash('sha256').update(readFileSync(shardPath)).digest('hex')!==record.sha256)throw new Error('Corroboration trace shard changed');
      const shard=createInterface({input:createReadStream(shardPath).pipe(createGunzip()),crlfDelay:Infinity});
      let count=0;
      for await(const row of shard){const entry=JSON.parse(row);if(entry.type!=='viewer')throw new Error('Invalid corroboration shard record');report.viewerResults.push(entry.viewer);count++;}
      if(count!==record.viewers)throw new Error('Corroboration trace shard is incomplete');
    }
    else if(record.type==='viewer')report.viewerResults.push(record.viewer);
    else if(record.type==='failure')report.failures.push(record.failure);
    else throw new Error('Unknown corroboration trace record');
  }
  return report;
}
