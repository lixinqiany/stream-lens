import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DemoDownloads } from '../adapters/demo-downloads';
import { scenes, type Scene } from '../domain/media';
import { ExtensionPanel, type Layout } from './App';

declare global {
  interface Window {
    openai?: {
      widgetState?: { modelContent?: Record<string, unknown> };
      setWidgetState?: (state: { modelContent: Record<string, unknown>; privateContent?: unknown }) => Promise<void>;
    };
  }
  var lucide: { createIcons: (options?: unknown) => void } | undefined;
  var Tweak: (new (options: { container: HTMLElement; onChange: () => void }) => {
    addSlider: (state: object, key: string, options: object) => void;
    addColorPicker: (state: object, key: string, options: object) => void;
    dispose: () => void;
  }) | undefined;
}
function Design({ layout, dark = false }: { layout: Layout; dark?: boolean }) {
  const [scene, setScene] = useState<Scene>(() => {
    const saved = window.openai?.widgetState?.modelContent?.[layout];
    return scenes.some(s => s.id === saved) ? saved as Scene : 'found';
  });
  const [mode, setMode] = useState<'popup' | 'sidebar'>(layout === 'studio' ? 'sidebar' : 'popup');
  const [port] = useState(() => new DemoDownloads());
  const product = useRef<HTMLDivElement>(null);
  function changeScene(next: Scene) {
    setScene(next);
    window.openai?.setWidgetState?.({ modelContent: { ...window.openai.widgetState?.modelContent, [layout]: next } }).catch(() => {});
  }
  useEffect(() => {
    function restore(event: Event) {
      const saved = (event as CustomEvent).detail?.globals?.widgetState?.modelContent?.[layout];
      if (scenes.some(s => s.id === saved)) setScene(saved);
    }
    window.addEventListener('openai:set_globals', restore);
    return () => window.removeEventListener('openai:set_globals', restore);
  }, [layout]);
  useEffect(() => {
    const element = product.current!;
    const state = { radius: 12, accent: dark ? '#8bae87' : '#426b50' };
    const render = () => {
      element.style.setProperty('--sl-accent', state.accent);
      element.style.setProperty('--sl-accent-hover', state.accent);
      element.querySelector<HTMLElement>('.sl-extension')!.style.borderRadius = `${state.radius}px`;
    };
    const TweakClass = globalThis.Tweak;
    if (!TweakClass) return;
    const tweak = new TweakClass({ container: element, onChange: render });
    tweak.addSlider(state, 'radius', { label: '圆角', min: 0, max: 20, unit: 'px' });
    tweak.addColorPicker(state, 'accent', { label: '强调色', reference: '--sl-accent' });
    return () => tweak.dispose();
  }, []);
  return <div className={`sl-preview sl-gallery-design ${dark ? 'sl-dark' : ''}`} ref={product} aria-label={layout === 'focus' ? '聚焦视频设计' : layout === 'compact' ? '紧凑列表设计' : '专业侧栏设计'}>
    <div className="sl-gallery-context"><span>{mode === 'popup' ? 'Chrome 弹窗' : 'Chrome 侧栏'}</span><select value={scene} aria-label="体验状态" onChange={e => changeScene(e.target.value as Scene)}>{scenes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
    <ExtensionPanel scene={scene} onScene={changeScene} onMode={setMode} mode={mode} layout={layout} port={port}/>
  </div>;
}
function Gallery() {
  useEffect(() => {
    const root = document.getElementById('stream-lens-gallery')!;
    const icons = () => { if (root.querySelector('i[data-lucide]')) globalThis.lucide?.createIcons({ attrs: { width: 16, height: 16 } }); };
    icons();
    const observer = new MutationObserver(icons);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <div className="viz-carousel viz-dotted-background" aria-label="拾影的三种交互方案" data-previous-label="上一个方案" data-next-label="下一个方案">
    <section data-variant="聚焦视频" aria-label="聚焦视频方案"><Design layout="focus"/></section>
    <section data-variant="紧凑列表" aria-label="紧凑列表方案" hidden><Design layout="compact"/></section>
    <section data-variant="专业侧栏" aria-label="专业侧栏方案" hidden><Design layout="studio" dark/></section>
  </div>;
}
flushSync(() => createRoot(document.getElementById('stream-lens-gallery')!).render(<Gallery/>));
