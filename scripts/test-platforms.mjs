import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
await mkdir('work/platform-tests',{recursive:true});
await build({entryPoints:['scripts/qa/platform-download.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/platform-tests/live.mjs',external:['mux.js']});
const child=spawn(process.execPath,['work/platform-tests/live.mjs',...process.argv.slice(2)],{stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
