import {t} from '../../i18n';
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
      if(!tracks.some(t=>t.type==='video')) {this.error=new Error(t("no_video_track_available_to_merge"));return;}
      const signature=JSON.stringify(tracks.map(t=>({id:t.id,type:t.type,codec:t.codec,timescale:t.timescale})));
      if(this.trackSignature&&this.trackSignature!==signature){this.error=new Error(t("codec_changes_during_this_video_are_not_supported"));return;}
      this.trackSignature=signature;
      if(!this.initialized){this.output.push(segment.initSegment.slice());this.initialized=true;}
      this.output.push(segment.data.slice());
    });
  }
  push(data:Uint8Array):Uint8Array[] {
    this.output=[];this.transmuxer.push(data);this.transmuxer.flush();
    if(this.error)throw this.error;
    if(!this.output.length)throw new Error(t("segment_contains_no_media_data_to_remux"));
    return this.output;
  }
  dispose(){this.transmuxer.dispose();}
}
