import postcss from 'postcss';
import { readFile,writeFile } from 'node:fs/promises';
const stylesheet=postcss.parse(await readFile('src/ui/styles.css','utf8'));
stylesheet.walkAtRules('import',rule=>rule.remove());
stylesheet.walkDecls(decl=>{if(decl.value.includes('/coast.svg'))decl.value='none';});
await writeFile('src/extension/ui/base.css',stylesheet.toString());
