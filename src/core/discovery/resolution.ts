// Deduplicate metadata lookups across sidebar, overlay and automatic discovery.
// A document/source identity must be included in keys by the caller.
export class ResolutionCache<T> {
  private pending=new Map<string,Promise<T>>();
  private ready=new Map<string,{value:T;at:number}>();
  constructor(private ttl=60_000,private limit=100){}
  hasPending(key:string){return this.pending.has(key);}
  async get(key:string,resolve:()=>Promise<T>,force=false):Promise<T>{
    const current=this.pending.get(key);if(current)return current;
    const cached=this.ready.get(key);if(!force&&cached&&Date.now()-cached.at<this.ttl)return cached.value;
    const operation=Promise.resolve().then(resolve).then(value=>{
      this.ready.delete(key);this.ready.set(key,{value,at:Date.now()});
      if(this.ready.size>this.limit)this.ready.delete(this.ready.keys().next().value!);
      return value;
    }).finally(()=>this.pending.delete(key));
    this.pending.set(key,operation);return operation;
  }
}
