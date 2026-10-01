import {test} from 'node:test';
import assert from 'node:assert/strict';
import {douyinId,douyinEndpoint,parseDouyinPage,resolveDouyin} from '../sites/douyin';
const id='7677919026948967689';
const data=()=>({loaderData:{'video_(id)/page':{itemId:id,videoInfoRes:{status_code:0,item_list:[{aweme_id:id,video:{duration:1275496,height:2160,play_addr:{url_list:['https://v95.douyinvod.com/video.mp4?signed=exact']}}}]}}}});
const html=(p:any)=>'window._ROUTER_DATA = '+JSON.stringify(p)+';';
test('Douyin supports ordinary video and selected modal routes, rejecting unrelated hosts',()=>{
 for(const url of [`https://www.douyin.com/jingxuan?modal_id=${id}`,`https://www.douyin.com/video/${id}`,`https://www.iesdouyin.com/share/video/${id}/`])assert.equal(douyinId(url),id);
 assert.equal(douyinId(`https://www.douyin.com.evil.test/video/${id}`),undefined);assert.equal(douyinId('https://www.douyin.com/jingxuan'),undefined);
});
test('Douyin only saves exact selected work with muxed media from the official page',()=>{
 const parsed=parseDouyinPage(html(data()),id);assert.equal(parsed.duration,1275.496);assert.match(parsed.variants[0].url,/signed=exact/);
 assert.throws(()=>parseDouyinPage(html(data()),'7677919026948967690'));
 const external=data();external.loaderData['video_(id)/page'].videoInfoRes.item_list[0].video.play_addr.url_list[0]='https://evil.test/video.mp4';assert.throws(()=>parseDouyinPage(html(external),id));
 const restricted=data();restricted.loaderData['video_(id)/page'].videoInfoRes.status_code=11110;assert.throws(()=>parseDouyinPage(html(restricted),id));
 const drm=data();Object.assign(drm.loaderData['video_(id)/page'].videoInfoRes.item_list[0].video,{is_drm:1});assert.throws(()=>parseDouyinPage(html(drm),id));
});
test('Douyin resolves a normal share session then the rendered metadata, with permissions on both requests',async()=>{
 const previous=globalThis.fetch;const calls:string[]=[],origins:string[]=[];Object.assign(globalThis,{chrome:{permissions:{contains:async(o:any)=>{origins.push(...o.origins);return true;}}}});
 globalThis.fetch=async(url)=>{calls.push(String(url));return new Response(calls.length===1?'<html>session</html>':html(data()));};
 try{await resolveDouyin(`https://www.douyin.com/jingxuan?modal_id=${id}`);assert.equal(calls.length,2);assert(!calls[0].includes('?'));assert.equal(calls[1],douyinEndpoint(`https://www.douyin.com/video/${id}`));assert.equal(origins.length,2);}finally{globalThis.fetch=previous;}
});
