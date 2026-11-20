import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

function javascriptFiles(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(['node_modules','.git'].includes(entry.name))return [];
    const path=join(dir,entry.name);
    return entry.isDirectory()?javascriptFiles(path):entry.name.endsWith('.js')?[path]:[];
  });
}

const files=javascriptFiles('src').concat(javascriptFiles('scripts'));
let failures=0;
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0){console.error('Syntax check failed:',file);failures++}
}
console.log('Syntax checked',files.length,'JavaScript files; failures:',failures);
if(failures)process.exitCode=1;
