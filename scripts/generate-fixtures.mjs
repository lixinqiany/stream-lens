// Regenerate synthetic test media; FFmpeg is only needed for this optional step.
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const destination='src/core/tests/fixtures';mkdirSync(destination,{recursive:true});
const ffmpeg=process.env.STREAM_LENS_FFMPEG||'ffmpeg';
const run=args=>{const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);};
const video=['-f','lavfi','-i','testsrc2=size=320x180:rate=30'];
const audio=['-f','lavfi','-i','sine=frequency=440:sample_rate=48000'];
const codec=['-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-g','30','-keyint_min','30','-sc_threshold','0'];
run([...video,...audio,'-t','3','-map','0:v','-map','1:a',...codec,'-c:a','aac','-b:a','96k','-f','mpegts',destination+'/hls-segment.bin']);
run([...video,'-t','3',...codec,'-an','-movflags','empty_moov+frag_keyframe+default_base_moof',destination+'/dash-video.mp4']);
run([...audio,'-t','3','-vn','-c:a','aac','-b:a','96k','-movflags','empty_moov+frag_keyframe+default_base_moof','-frag_duration','1000000',destination+'/dash-audio.mp4']);
