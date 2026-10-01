import mux from 'mux.js';
/** Incremental TS → fragmented MP4. No video frames are decoded or re-encoded. */
export class TsTransmuxer {
  private transmuxer=new mux.mp4.Transmuxer({remux:true,keepOriginalTimestamps:false});
  private output:Uint8Array[]=[];
  private initialized=false;
  private trackSignature='';
  private error:Error|undefined;
  constructor() {
    this.transmuxer.on('data',segment=>{
      const tracks=mux.mp4.probe.tracks(segment.initSegment);
      if(!tracks.some(t=>t.type==='video')) {this.error=new Error('没有找到可合并的视频轨道');return;}
      const signature=JSON.stringify(tracks.map(t=>({id:t.id,type:t.type,codec:t.codec,timescale:t.timescale})));
      if(this.trackSignature&&this.trackSignature!==signature){this.error=new Error('视频中途改变编码，本版暂不支持合并');return;}
      this.trackSignature=signature;
      if(!this.initialized){this.output.push(segment.initSegment.slice());this.initialized=true;}
      this.output.push(segment.data.slice());
    });
  }
  push(data:Uint8Array):Uint8Array[] {
    this.output=[];this.transmuxer.push(data);this.transmuxer.flush();
    if(this.error)throw this.error;
    if(!this.output.length)throw new Error('分片中没有可转封装的视频数据');
    return this.output;
  }
  dispose(){this.transmuxer.dispose();}
}
