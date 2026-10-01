import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output=resolve('dist-extension');
await import('./styles-extension.mjs');
await viteBuild({configFile:false,root:resolve('src/extension'),base:'./',plugins:[react()],publicDir:false,build:{outDir:output,emptyOutDir:true,rollupOptions:{input:{sidepanel:resolve('src/extension/sidepanel.html'),offscreen:resolve('src/extension/offscreen.html'),save:resolve('src/extension/save.html')}}}});
await build({entryPoints:{background:'src/extension/background/index.ts',content:'src/extension/content/index.ts',probe:'src/extension/page/index.ts'},bundle:true,outdir:output,format:'iife',target:'chrome116',minify:true,legalComments:'eof'});
const built=await build({entryPoints:['src/extension/manifest.ts'],bundle:true,write:false,format:'esm'});
const {manifest}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2));
const stringsBuild=await build({entryPoints:['src/i18n/messages.ts'],bundle:true,write:false,format:'esm'});
const {messages:strings}=await import('data:text/javascript;base64,'+Buffer.from(stringsBuild.outputFiles[0].text).toString('base64'));
for(const [locale,language] of [['en','en'],['zh_CN','zh']]){
  await mkdir(resolve(output,'_locales',locale),{recursive:true});
  const catalog=Object.fromEntries(['app_title','app_desc','action_title'].map(key=>[key,{message:strings[key][language]}]));
  await writeFile(resolve(output,'_locales',locale,'messages.json'),JSON.stringify(catalog,null,2));
}

await mkdir(resolve(output,'icons'),{recursive:true});
for(const size of [16,32,48,128])await copyFile(resolve('public/icons',size+'.png'),resolve(output,'icons',size+'.png'));
await copyFile(resolve('LICENSE'),resolve(output,'LICENSE'));
const licenses=[];
for(const pkg of ['react','react-dom','scheduler','lucide-react','mux.js','@babel/runtime','global','min-document','dom-walk','process']) {
  for(const filename of ['LICENSE','LICENSE.txt','LICENSE.md']) {
    try{licenses.push('\n'+pkg+'\n'+await readFile(resolve('node_modules',pkg,filename),'utf8'));break;}catch{}
  }
}
await writeFile(resolve(output,'THIRD-PARTY-NOTICES.txt'),'Third-party licenses for bundled code. Full dependency versions: package-lock.json.\n'+licenses.join('\n'));
console.log('Chrome extension: '+output);
