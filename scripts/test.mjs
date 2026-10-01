import { build } from 'esbuild';
import { readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const tests=['src/domain/task.test.ts',...(await readdir('src/core/tests')).filter(f=>f.endsWith('.test.ts')).map(f=>'src/core/tests/'+f)];
await mkdir('work/tests',{recursive:true});
await build({entryPoints:tests,bundle:true,platform:'node',format:'esm',outdir:'work/tests',entryNames:'[name]',outExtension:{'.js':'.mjs'},external:['mux.js'],target:'node24'});
const result=spawnSync(process.execPath,['--test',...tests.map(f=>'work/tests/'+f.split('/').at(-1).replace('.ts','.mjs'))],{stdio:'inherit'});
process.exit(result.status??1);
