import mux from 'mux.js';
/** Validate passthrough initialization before labeling a fragmented stream as supported MP4. */
export function validateMp4Init(data:Uint8Array) {
  let offset=0;const boxes:string[]=[];const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  while(offset<data.length) {
    if(offset+8>data.length)throw new Error('视频初始化信息不完整');
    const size=view.getUint32(offset);const type=new TextDecoder().decode(data.subarray(offset+4,offset+8));
    if(size<8||offset+size>data.length)throw new Error('视频初始化结构暂不支持');
    boxes.push(type);offset+=size;
  }
  if(!boxes.includes('ftyp')||!boxes.includes('moov'))throw new Error('初始化信息缺少 MP4 视频结构');
  const tracks=mux.mp4.probe.tracks(data);
  if(!tracks.some(t=>t.type==='video'))throw new Error('没有找到视频轨道');
  if(tracks.some(t=>t.type==='video'&&!/^avc1\./i.test(t.codec)||t.type==='audio'&&!/^mp4a\./i.test(t.codec)))throw new Error('此视频编码暂不支持，请尝试 H.264 / AAC 清晰度');
}
