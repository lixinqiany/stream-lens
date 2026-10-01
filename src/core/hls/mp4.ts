import {t} from '../../i18n';
import mux from 'mux.js';
/** Validate passthrough initialization before labeling a fragmented stream as supported MP4. */
export function validateMp4Init(data:Uint8Array) {
  let offset=0;const boxes:string[]=[];const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  while(offset<data.length) {
    if(offset+8>data.length)throw new Error(t("video_initialization_data_is_incomplete"));
    const size=view.getUint32(offset);const type=new TextDecoder().decode(data.subarray(offset+4,offset+8));
    if(size<8||offset+size>data.length)throw new Error(t("this_video_initialization_structure_is_not_supported"));
    boxes.push(type);offset+=size;
  }
  if(!boxes.includes('ftyp')||!boxes.includes('moov'))throw new Error(t("mp4_video_initialization_data_is_missing"));
  const tracks=mux.mp4.probe.tracks(data);
  if(!tracks.some(t=>t.type==='video'))throw new Error(t("no_video_track_found"));
  if(tracks.some(t=>t.type==='video'&&!/^avc1\./i.test(t.codec)||t.type==='audio'&&!/^mp4a\./i.test(t.codec)))throw new Error(t("this_codec_is_not_supported_try_h264_aac"));
}
