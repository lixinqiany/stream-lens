declare module 'mux.js' {
  type Output = { initSegment: Uint8Array; data: Uint8Array; type: string };
  class Transmuxer {
    constructor(options?: { remux?: boolean; keepOriginalTimestamps?: boolean });
    on(event:'data',handler:(output:Output)=>void):void;
    push(data:Uint8Array):void;
    flush():void;
    dispose():void;
  }
  const mux: { mp4: { Transmuxer:typeof Transmuxer; probe:{tracks:(data:Uint8Array)=>{id:number;type:string;codec:string;timescale:number}[]} } };
  export default mux;
}
