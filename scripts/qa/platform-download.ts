// Opt-in network smoke test. Chrome APIs are adapted; all media requests and the
// production offscreen runner are real. Files stay in ignored work/platform-tests.
import {mkdir,open,rename,rm,writeFile,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {destinationDatabase} from '../../src/core/tests/support/destinations';
import {rememberDestination,type DestinationHandle} from '../../src/platform/destination';
import {resolveYoutube} from '../../src/core/sites/youtube';
import {parseBiliPlayResponse,biliPlayEndpoint} from '../../src/core/sites/bilibili';
import {resolveDouyin,douyinMobileAgent} from '../../src/core/sites/douyin';
import {allowedFetch} from '../../src/core/hls/fetch';
import type {DownloadRecord} from '../../src/core/model';
import {setLanguage} from '../../src/i18n';
await mkdir('work/platform-tests',{recursive:true});destinationDatabase();setLanguage('en');
let listener:any;const events:any[]=[];
Object.assign(globalThis,{chrome:{permissions:{contains:async()=>true},runtime:{id:'live-test',onMessage:{addListener:(fn:any)=>listener=fn},sendMessage:async(m:any)=>{events.push(m);return m.type==='CHECK_ORIGIN'?{ok:true,allowed:true}:m.type==='PREPARE_SAVE'?{ok:true,accepted:true}:{ok:true};}}}});
// urllib carries the machine's HTTP proxy configuration. Its response is wrapped
// as Fetch without altering status, ranges or bytes. Signed URLs are not logged.
globalThis.fetch=async(input:any,options:any={})=>{
 const script=`import sys,json,urllib.request,urllib.error,base64,http.cookiejar,os\np=json.load(sys.stdin)\nh=p['headers'];h['User-Agent']=p.get('agent','Mozilla/5.0');\nif 'bilibili.com' in p['url'] or 'bilivideo.com' in p['url']:h['Referer']='https://www.bilibili.com/'\nif 'douyinvod.com' in p['url'] or 'iesdouyin.com' in p['url']:h['Referer']='https://www.douyin.com/'\njar=http.cookiejar.LWPCookieJar('work/platform-tests/http-cookies.txt')\nif 'iesdouyin.com/share/video/' in p['url'] and os.path.exists(jar.filename):jar.load(ignore_discard=True,ignore_expires=True)\nop=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))\ntry:\n r=op.open(urllib.request.Request(p['url'],data=p.get('body',None).encode() if p.get('body') else None,headers=h,method=p.get('method','GET')),timeout=45)\nexcept urllib.error.HTTPError as e:r=e\nif 'iesdouyin.com/share/video/' in p['url']:jar.save(ignore_discard=True,ignore_expires=True)\nsys.stdout.buffer.write(json.dumps({'status':r.status,'url':r.url,'headers':dict(r.headers)}).encode()+b'\\n');sys.stdout.buffer.flush()\nwhile True:\n b=r.read(65536)\n if not b:break\n sys.stdout.buffer.write(b);sys.stdout.buffer.flush()`;
 const {spawn}=await import('node:child_process');const p=spawn('python3',['-c',script],{stdio:['pipe','pipe','pipe'],signal:options.signal});
 p.stdin.end(JSON.stringify({url:String(input),method:options.method,headers:options.headers||{},body:options.body,agent:String(input).includes('iesdouyin.com/share/video/')?douyinMobileAgent:'Mozilla/5.0'}));
 let error='';p.stderr.on('data',c=>error+=c);const reader=(Readable.toWeb(p.stdout) as ReadableStream<Uint8Array>).getReader();
 const completion=new Promise<void>((resolve,reject)=>{p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(error.replace(/https?:\/\/[^\s]+/g,'[redacted URL]'))));});completion.catch(()=>{});
 let header=Buffer.alloc(0),initial:Uint8Array|undefined,meta:any;
 for(;;){const chunk=await reader.read();if(chunk.done)throw Error('HTTP bridge ended before response');header=Buffer.concat([header,chunk.value]);const newline=header.indexOf(10);if(newline<0)continue;meta=JSON.parse(header.subarray(0,newline).toString());initial=header.subarray(newline+1);break;}

 const headers=new Headers();for(const [k,v]of Object.entries(meta.headers))headers.set(k,String(v));
 const body=new ReadableStream<Uint8Array>({start(c){if(initial?.length)c.enqueue(initial);},async pull(c){try{const chunk=await reader.read();if(chunk.done){await completion;c.close();}else c.enqueue(chunk.value);}catch(e){c.error(e);}},async cancel(){p.kill();await reader.cancel();}});
 const response=new Response(body,{status:meta.status,headers});Object.defineProperty(response,'url',{value:meta.url});return response;
};
await import('../../src/extension/offscreen/index');
const command=(m:any)=>new Promise<any>(r=>listener({target:'runner',...m},{id:'live-test'},r));
const reports:any[]=[];
const allCases=[{site:'youtube',pageUrl:'https://www.youtube.com/watch?v=jNQXAC9IVRw'},{site:'bilibili',pageUrl:'https://www.bilibili.com/video/BV1GJ411x7h7'},{site:'douyin',pageUrl:'https://www.douyin.com/jingxuan?modal_id=7677919026948967689'}];
const cases=process.argv[2]?allCases.filter(c=>c.site===process.argv[2]):allCases;if(!cases.length)throw Error('Choose youtube, bilibili or douyin');
for(const item of cases){
 console.log(item.site,'resolving');let parsed;
 if(item.site.startsWith('youtube'))parsed=await resolveYoutube(item.pageUrl);
 else if(item.site==='douyin')parsed=await resolveDouyin(item.pageUrl);
 else {const bvid=item.pageUrl.split('/').at(-1)!;const json=async(url:string)=>JSON.parse(new TextDecoder().decode((await allowedFetch(url,{limit:5_000_000})).data));const view=await json(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);parsed=parseBiliPlayResponse(await json(biliPlayEndpoint(bvid,view.data.cid)));}

 const variant=parsed.variants[0],path=`work/platform-tests/${item.site}-complete.mp4`,temp=path+'.part';let writes=0;
 const handle={name:item.site+'.mp4',queryPermission:async()=> 'granted',createWritable:async()=>{const file=await open(temp,'w');return new WritableStream<Uint8Array>({async write(data){await file.write(data);writes++;},async close(){await file.close();await rename(temp,path);},async abort(){await file.close();await rm(temp,{force:true});}});}} as unknown as DestinationHandle;
 const task:DownloadRecord={id:crypto.randomUUID(),assetId:item.site,title:item.site,filename:handle.name,pageUrl:item.pageUrl,url:variant.url,protocol:item.site==='douyin'?'MP4':'DASH',dash:variant.dash,destinationId:await rememberDestination(handle),quality:variant.label,state:'resolving',createdAt:Date.now(),updatedAt:Date.now(),bytes:0,segments:0,speed:0};
 events.length=0;const start=Date.now();await command({type:'RUN',task,language:'en'});
 while(!events.some(e=>e.type==='SAVED'||e.task?.state==='failed')){if(Date.now()-start>600_000)throw Error('download timeout');await new Promise(r=>setTimeout(r,100));}
 const failed=events.find(e=>e.task?.state==='failed');if(failed)throw Error(failed.task.error);
 const ffmpeg=process.env.STREAM_LENS_FFMPEG||'ffmpeg';
 const info=spawnSync(ffmpeg,['-hide_banner','-i',path,'-t','0','-f','null','-'],{encoding:'utf8',maxBuffer:5_000_000});
 if(info.status!==0)throw Error(info.stderr);const duration=info.stderr.match(/Duration: ([\d:.]+)/)?.[1];
 const decode=spawnSync(ffmpeg,['-v','error','-i',path,'-map','0:v:0','-map','0:a:0','-f','null','-'],{encoding:'utf8'});
 if(decode.status!==0||decode.stderr.trim())throw Error('complete decode failed: '+decode.stderr);
 const report={site:item.site,pageUrl:item.pageUrl,quality:variant.label,sourceDuration:parsed.duration,outputDuration:duration,bytes:(await stat(path)).size,writes,decode:'complete video + audio; no errors',elapsedSeconds:Math.round((Date.now()-start)/1000)};reports.push(report);console.log(JSON.stringify(report));
 await writeFile(`work/platform-tests/report${process.argv[2]?'-'+process.argv[2]:''}.json`,JSON.stringify(reports,null,2));
}
await writeFile(`work/platform-tests/report${process.argv[2]?'-'+process.argv[2]:''}.json`,JSON.stringify(reports,null,2));
