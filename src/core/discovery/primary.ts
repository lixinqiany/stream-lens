export type PlayerCandidate<T>={player:T;visible:boolean;ready:boolean;playing:boolean;main:boolean;ad:boolean;area:number};
// A known main player is enough. Otherwise require one unambiguous, playing
// player. Comparable players on a feed must wait for the user's choice.
export function primaryPlayer<T>(players:PlayerCandidate<T>[]):T|undefined {
  const visible=players.filter(p=>p.visible&&p.ready&&!p.ad);
  const main=visible.filter(p=>p.main);
  if(main.length===1)return main[0].player;
  if(main.length>1)return;
  const sorted=visible.sort((a,b)=>b.area-a.area);
  const first=sorted[0];if(!first?.playing)return;
  if(sorted.length===1||first.area>=sorted[1].area*4)return first.player;
}
