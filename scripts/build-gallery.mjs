import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import postcss from 'postcss';

const outputPath = process.argv[2];
if (!outputPath) throw new Error('Provide an absolute output path');
const result = await build({
  entryPoints: ['src/ui/Gallery.tsx'], bundle: true, minify: true, write: false,
  format: 'iife', target: 'es2022', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'host-lucide-icons',
    setup(plugin) {
      plugin.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'icons', namespace: 'host-icons' }));
      plugin.onLoad({ filter: /.*/, namespace: 'host-icons' }, () => ({
        contents: `import React from 'react';
          const names = ['ArrowDown','ArrowDownToLine','ArrowLeft','ArrowRight','Check','ChevronDown','ChevronRight','CircleHelp','Copy','Download','Ellipsis','ExternalLink','FileVideo','FolderOpen','Globe','Info','Link2','LoaderCircle','LockKeyhole','Maximize2','PanelRight','Pause','Play','Radio','RefreshCw','ScanLine','Settings2','ShieldCheck','Sparkles','Square','X'];
          const icon = name => ({ size=16, className='', ...props }) => React.createElement('span', { ...props, 'aria-hidden':'true', className, style:{width:size,height:size,display:'inline-flex',flexShrink:0}, dangerouslySetInnerHTML:{__html:'<i data-lucide="'+name+'" aria-hidden="true"></i>'} });
          ${['ArrowDown','ArrowDownToLine','ArrowLeft','ArrowRight','Check','ChevronDown','ChevronRight','CircleHelp','Copy','Download','Ellipsis','ExternalLink','FileVideo','FolderOpen','Globe','Info','Link2','LoaderCircle','LockKeyhole','Maximize2','PanelRight','Pause','Play','Radio','RefreshCw','ScanLine','Settings2','ShieldCheck','Sparkles','Square','X'].map(name=>`export const ${name} = icon('${name.replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase()}');`).join('\n')}`,
        loader: 'js', resolveDir: process.cwd(),
      }));
    },
  }],
});
const rawCss = (await readFile('src/ui/styles.css','utf8'))
  .replace(/^@import[^\n]+\n/,'')
  .replace(/\*\{box-sizing:border-box\}body\{margin:0\}/,'#stream-lens-gallery *{box-sizing:border-box}')
  .replace(/(?<=\}|^)button,select,input\{/g,'#stream-lens-gallery button,#stream-lens-gallery select,#stream-lens-gallery input{')
  .replace(/(?<=\}|^)button\{/g,'#stream-lens-gallery button{')
  .replace(/(?<=\}|^)button:disabled\{/g,'#stream-lens-gallery button:disabled{')
  .replace(/(?<=\}|^)button,a,input,select\{/g,'#stream-lens-gallery button,#stream-lens-gallery a,#stream-lens-gallery input,#stream-lens-gallery select{')
  .replace(/(?<=\}|^)svg\{/g,'#stream-lens-gallery svg{')
  .replace(/(?<=\}|^)button svg\{/g,'#stream-lens-gallery button svg{')
  .replace('[hidden]{display:none!important}','#stream-lens-gallery [hidden]{display:none!important}')
  .replaceAll('cursor:pointer','cursor:var(--cursor-interaction, pointer)');
const stylesheet = postcss.parse(rawCss);
stylesheet.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && rule.parent.name.includes('keyframes')) return;
  rule.selectors = rule.selectors.map(selector => selector.includes('#stream-lens-gallery') ? selector : '#stream-lens-gallery ' + selector);
});
const css = stylesheet.toString();
const artwork = 'data:image/svg+xml;base64,' + Buffer.from(await readFile('public/coast.svg')).toString('base64');
const shell = await readFile('scripts/gallery-shell.html','utf8');
const html = shell.replace('/* __PRODUCT_CSS__ */', () => css).replace('__COAST_DATA__', () => artwork).replace('/* __PRODUCT_BUNDLE__ */', () => result.outputFiles[0].text.replaceAll('</script','<\\/script'));
await mkdir(resolve(outputPath,'..'), {recursive:true});
await writeFile(outputPath,html);
console.log(`Generated ${Buffer.byteLength(html)} bytes: ${outputPath}`);
