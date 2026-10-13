export function isYfspPlaceholder(value:string):boolean {
  try {
    const url=new URL(value);
    return /(^|\.)yfsp\.tv$/i.test(url.hostname)&&/^\/assets\/javascript\/empty\d*\.mp4$/i.test(url.pathname);
  }catch{return false;}
}
