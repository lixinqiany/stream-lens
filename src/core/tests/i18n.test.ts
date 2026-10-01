import {test} from 'node:test';import assert from 'node:assert/strict';
import {messages} from '../../i18n/messages';
import {browserLocale,setLanguage,currentLocale,t,localizeText,localizeQuality,watchLanguage} from '../../i18n';
import {safeFilename} from '../model';import {ResourceAccessError,PermissionError} from '../hls/fetch';import {parseHls} from '../hls/parser';
import {manifest} from '../../extension/manifest';
test('browser default, Chinese variants, English fallback and explicit language choice',()=>{
 assert.equal(browserLocale('zh-CN'),'zh_CN');assert.equal(browserLocale('zh-TW'),'zh_CN');assert.equal(browserLocale('en-US'),'en');assert.equal(browserLocale('fr-FR'),'en');
 Object.assign(globalThis,{chrome:{i18n:{getUILanguage:()=> 'en-US'}}});setLanguage('auto');assert.equal(currentLocale(),'en');assert.equal(t('download_video'),'Download video');
 setLanguage('zh_CN');assert.equal(t('download_video'),'下载视频');setLanguage('en');assert.equal(t('download_video'),'Download video');setLanguage('auto');
});
test('all translations have matching placeholders and manifest localization keys exist',()=>{
 for(const [key,entry] of Object.entries(messages)){
  assert(entry.zh.trim()&&entry.en.trim(),key);assert.deepEqual([...entry.zh.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort(),[...entry.en.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort(),key);
 }
 assert.equal(manifest.default_locale,'en');for(const value of [manifest.name,manifest.description,manifest.action.default_title])assert(value.match(/^__MSG_(.+)__$/)![1] in messages);
 assert(messages.app_desc.en.length<=132);assert(messages.app_desc.zh.length<=132);
});
test('engine errors and persisted messages translate with safe parameters; page content remains unchanged',()=>{
 setLanguage('en');const error=new ResourceAccessError(403,'https://cdn.example/v.mp4?token=secret');assert.equal(error.message,'Access denied (HTTP 403 · cdn.example). Check that the video plays on its page, then retry.');assert(!error.message.includes('secret'));
 assert.equal(new PermissionError([]).message,'Allow access to the video resource site');assert.throws(()=>parseHls('<html>','https://cdn.example/v.m3u8'),/valid video playlist/);
 const old='视频地址已过期（HTTP 410 · cdn.example），请重试。';assert.equal(localizeText(old),'Video URL expired (HTTP 410 · cdn.example). Please retry.');
 assert.equal(localizeText('记录会保留的示例视频.mp4'),'记录会保留的示例视频.mp4');assert.equal(localizeQuality('720p · 当前源'),'720p');
 assert.equal(safeFilename('课程视频','原始文件','mp4'),'课程视频.mp4');setLanguage('zh_CN');assert.equal(safeFilename('Tutorial','Original file','mp4'),'Tutorial.mp4');
 assert.equal(localizeText(error.message),'服务器拒绝访问（HTTP 403 · cdn.example），请在网页确认可播放后重试。');
});
test('language synchronization ignores a stale initial read after a storage event',async()=>{
 let release!:(value:any)=>void,listener:any,removed=false,calls=0;
 Object.assign(globalThis,{chrome:{storage:{local:{get:()=>new Promise(r=>{release=r;})},onChanged:{addListener:(fn:any)=>listener=fn,removeListener:()=>{removed=true;}}}}});
 const stop=watchLanguage(()=>calls++);listener({preferences:{newValue:{language:'en'}}},'local');release({preferences:{language:'zh_CN'}});await new Promise(r=>setTimeout(r,0));
 assert.equal(currentLocale(),'en');assert.equal(calls,1);stop();assert(removed);setLanguage('auto');
});
