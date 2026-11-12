import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const excluded=new Set(['node_modules','dist','test-results','.git','__pycache__','.pytest_cache','results']);
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){
  if(excluded.has(entry.name)||entry.name.endsWith('.tsbuildinfo'))continue;
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())files.push(...await walk(full));else files.push(full);
}return files;}
const entries=[];
for(const full of (await walk(root)).sort()){
  const bytes=await readFile(full);const relative=path.relative(root,full).replaceAll('\\','/');
  entries.push({path:relative,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
    ...(full.endsWith('.png')?{}:{content:bytes.toString('utf8')})});
}
await mkdir(path.join(root,'docs/results'),{recursive:true});
if(process.argv.includes('--final')){
  const before=JSON.parse(await readFile(path.join(root,'docs/results/baseline.json'),'utf8'));
  const old=new Map(before.files.map(f=>[f.path,f]));
  const changes=entries.filter(f=>old.get(f.path)?.sha256!==f.sha256).map(f=>({path:f.path,status:old.has(f.path)?'modified':'created',sha256:f.sha256}));
  const removed=before.files.filter(f=>!entries.some(e=>e.path===f.path)).map(f=>f.path);
  await writeFile(path.join(root,'docs/results/changes.json'),JSON.stringify({timestamp:new Date().toISOString(),git:'NO VERIFICADO: no existe .git',changes,removed},null,2));
  console.log(JSON.stringify({changes,removed},null,2));
}else{
  await writeFile(path.join(root,'docs/results/baseline.json'),JSON.stringify({timestamp:new Date().toISOString(),node:process.version,git_status:'fatal: not a git repository',git_log:'fatal: not a git repository',preexisting_changes:'No determinables sin historial Git; se preserva contenido y SHA256 de todos los archivos de entrada.',files:entries},null,2),{flag:'wx'});
  console.log(`Línea base: ${entries.length} archivos; contenido y SHA256 preservados.`);
}
