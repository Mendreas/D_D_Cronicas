// Crónicas do Véu — progressão persistente do grupo (neste navegador).
// Fichas partilhadas entre aventuras; cada campanha conserva o seu próprio enredo.
export const XP_LEVELS=[0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
export const DEFAULT_ALLIES=[
 {id:'kael',nome:'Kael',classe:'Guerreiro',papel:'Proteção e combate',nivel:1,pv:12,pvMax:12,experiencia:0},
 {id:'lyra',nome:'Lyra',classe:'Clériga',papel:'Cura e conhecimento',nivel:1,pv:10,pvMax:10,experiencia:0},
 {id:'neris',nome:'Neris',classe:'Ladina',papel:'Exploração e armadilhas',nivel:1,pv:9,pvMax:9,experiencia:0}
];
const hitDice={barbarian:12,barbaro:12,fighter:10,guerreiro:10,paladin:10,paladino:10,ranger:10,patrulheiro:10,bard:8,bardo:8,cleric:8,cleriga:8,clériga:8,druid:8,druida:8,monk:8,monge:8,rogue:8,ladina:8,ladino:8,warlock:8,bruxo:8,sorcerer:6,feiticeiro:6,wizard:6,mago:6};
export function levelForXP(xp){const value=Math.max(0,Number(xp)||0);let level=1;for(let i=0;i<XP_LEVELS.length;i++)if(value>=XP_LEVELS[i])level=i+1;return level}
export function advanceMember(member,award){
 const next={...member};
 const oldXP=Math.max(0,Number(next.experiencia)||0);
 const gain=Math.max(0,Math.min(150,Math.trunc(Number(award)||0)));
 next.experiencia=oldXP+gain;
 const previous=Math.max(1,Math.min(20,Math.trunc(Number(next.nivel)||1)));
 const goal=Math.max(previous,levelForXP(next.experiencia));
 const hd=hitDice[String(next.classe||'').toLowerCase()]||8;
 const con=Math.floor(((Number(next.atributos?.con)||10)-10)/2);
 const hpPerLevel=Math.max(1,Math.floor(hd/2)+1+con);
 next.nivel=goal;
 if(goal>previous){
  next.pvMax=Math.max(1,Number(next.pvMax??next.pv??1))+(goal-previous)*hpPerLevel;
  next.pv=Math.max(1,Number(next.pv??1))+(goal-previous)*hpPerLevel;
 }
 return next;
}
export function sharedPartyKey(characterId){return 'cv-party-'+characterId}
export function readParty(characterId){
 if(!characterId)return null;
 try{return JSON.parse(localStorage.getItem(sharedPartyKey(characterId))||'null')}catch{return null}
}
export function saveParty(characterId,party){
 if(characterId&&Array.isArray(party))localStorage.setItem(sharedPartyKey(characterId),JSON.stringify(party));
}
export function mergeParty(stored){
 const byId=new Map((Array.isArray(stored)?stored:[]).map(x=>[String(x.id||x.nome||'').toLowerCase(),x]));
 return DEFAULT_ALLIES.map(ally=>{
  const prior=byId.get(ally.id)||byId.get(ally.nome.toLowerCase())||{};
  const level=Math.max(Number(prior.nivel)||1,levelForXP(prior.experiencia||0));
  return {...ally,...prior,id:ally.id,nivel:level,experiencia:Number(prior.experiencia)||0,pvMax:prior.pvMax??prior.pv??ally.pvMax};
 });
}
