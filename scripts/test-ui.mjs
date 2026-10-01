import {spawnSync} from 'node:child_process';
const checks=['content','bili-content','access-content','auto-content','probe','ui-save','save-recovery','auto-ui'];
for(const check of checks){
  const result=spawnSync(process.execPath,['scripts/qa/'+check+'-qa.mjs'],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
