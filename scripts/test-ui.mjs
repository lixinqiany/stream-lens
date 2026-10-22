import {spawnSync} from 'node:child_process';
const checks=['content','overlay-visibility','bili-content','platform-content','autoplay-content','hls-content','access-content','auto-content','probe','ui-save','save-recovery','auto-ui','i18n'];
for(const check of checks){
  const result=spawnSync(process.execPath,['scripts/qa/'+check+'-qa.mjs'],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
