export const brandLogo='icons/128.png';

// Shared by the sidebar, player controls and save window.
const palettes={
  light:{
    page:'#f5f7f4',surface:'#ffffff',soft:'#edf2ed',line:'#dce5dd',
    text:'#24352b',subtle:'#526658',muted:'#5d7062',
    accent:'#426e55','accent-hover':'#345b44','accent-soft':'#e7f0e8','on-accent':'#ffffff',
    danger:'#b43e3e',success:'#33764d',shadow:'0 3px 12px #19372506',
  },
  dark:{
    page:'#151b18',surface:'#1d2520',soft:'#26312a',line:'#35433a',
    text:'#edf4ee',subtle:'#bacbbf',muted:'#94aa9b',
    accent:'#a6d8b9','accent-hover':'#bce5ca','accent-soft':'#293f31','on-accent':'#172c1f',
    danger:'#f1a3a0',success:'#a6d8b9',shadow:'0 3px 16px #0000000d',
  },
} as const;
export type Theme=keyof typeof palettes;
export function themeVariables(theme:Theme){return Object.fromEntries(Object.entries(palettes[theme]).map(([name,value])=>['--sl-'+name,value]));}
export function themeStyle(theme:Theme){return {...themeVariables(theme),colorScheme:theme};}
export function themeCss(theme:Theme){return Object.entries(themeVariables(theme)).map(([name,value])=>name+':'+value).join(';')+';color-scheme:'+theme+';';}

export function watchDocumentTheme(){
  const style=document.createElement('style');
  style.textContent=`:root{${themeCss('light')}}@media(prefers-color-scheme:dark){:root{${themeCss('dark')}}}:root[data-theme="light"]{${themeCss('light')}}:root[data-theme="dark"]{${themeCss('dark')}}`;
  document.head.append(style);
  if(typeof chrome==='undefined'||!chrome.storage?.local)return;
  let generation=0;
  const apply=(value?:{theme?:string})=>{
    if(value?.theme==='light'||value?.theme==='dark')document.documentElement.dataset.theme=value.theme;
    else delete document.documentElement.dataset.theme;
  };
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.preferences){generation++;apply(changes.preferences.newValue);}});
  const start=generation;void chrome.storage.local.get('preferences').then(value=>{if(start===generation)apply(value.preferences);}).catch(()=>{});
}
