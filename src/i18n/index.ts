import {messages,type MessageKey} from './messages';
export type LanguagePreference='auto'|'zh_CN'|'en';
export type Locale='zh_CN'|'en';
let preference:LanguagePreference='auto';
export function browserLocale(language?:string):Locale {
  const value=language??(typeof chrome!=='undefined'?chrome.i18n?.getUILanguage?.():undefined)??'zh-CN';
  return /^zh(?:-|_|$)/i.test(value)?'zh_CN':'en';
}
export function currentLocale():Locale{return preference==='auto'?browserLocale():preference;}
export function setLanguage(value?:LanguagePreference){preference=['auto','zh_CN','en'].includes(value||'')?value!:'auto';}
function render(template:string,args:readonly unknown[]=[]){return template.replace(/\{(\d+)\}/g,(_,index)=>String(args[Number(index)]??''));}
export function t(key:MessageKey,args:readonly unknown[]=[]):string{return render(messages[key][currentLocale()==='zh_CN'?'zh':'en'],args);}
// Persisted errors may have been produced in a different language or older
// version. Match only known extension messages, never page titles or filenames.
const matchers=Object.values(messages).flatMap(entry=>[entry.zh,entry.en].map(template=>{
 const parts=template.split(/\{\d+\}/);const pattern=parts.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('(.*?)');
 return {entry,pattern:new RegExp('^'+pattern+'$'),template};
}));
export function localizeText(value?:string):string {
  if(!value)return '';
  for(const {entry,pattern,template} of matchers){const match=pattern.exec(value);if(match){
    const args:unknown[]=[];let i=1;for(const slot of template.matchAll(/\{(\d+)\}/g))args[Number(slot[1])]=match[i++];
    return render(entry[currentLocale()==='zh_CN'?'zh':'en'],args);
  }}
  return value;
}
export function localizeQuality(value:string):string{return localizeText(value).replace(/ · (?:当前源|Current source)$/,'');}
export function applyDocumentLanguage(doc:Document=document){doc.documentElement.lang=currentLocale()==='zh_CN'?'zh-CN':'en';}
export function watchLanguage(onChange?:()=>void) {
  const apply=(prefs?:{language?:LanguagePreference})=>{setLanguage(prefs?.language);onChange?.();};
  if(typeof chrome==='undefined'||!chrome.storage?.local)return ()=>{};
  const changed=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&changes.preferences)apply(changes.preferences.newValue);};
  let generation=0;const event=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&changes.preferences){generation++;changed(changes,area);}};
  const start=generation;void chrome.storage.local.get('preferences').then(result=>{if(start===generation)apply(result.preferences);}).catch(()=>{});
  chrome.storage.onChanged?.addListener(event);return()=>{generation++;chrome.storage.onChanged?.removeListener(event);};
}
