// SRD 5.2.1 (2024) — primitive mechanics for the rebuilding prototype.
// Original implementation. Not a complete rules engine.
// CC BY 4.0 attribution: https://www.dndbeyond.com/srd
export const ABILITIES={str:'Força',dex:'Destreza',con:'Constituição',int:'Inteligência',wis:'Sabedoria',cha:'Carisma'};
export function modifier(score){return Math.floor((Number(score)-10)/2)}
export function proficiencyBonus(level){return 2+Math.floor((Math.max(1,Math.min(20,Number(level)))-1)/4)}
export function rollDie(sides=20){const max=Math.max(2,Math.min(100,Math.trunc(sides)));const bytes=new Uint32Array(1);const maxUint=0x100000000;const maxAccept=Math.floor(maxUint/max)*max;let n;do{crypto.getRandomValues(bytes);n=bytes[0]}while(n>=maxAccept);return 1+n%max}
export function abilityCheck(character,ability,{proficient=false,advantage=false,disadvantage=false,dc=null}={}){
 const score=character?.atributos?.[ability]??10;
 const first=rollDie(20);const second=advantage!==disadvantage?rollDie(20):null;
 const die=second==null?first:(advantage?Math.max(first,second):Math.min(first,second));
 const bonus=modifier(score)+(proficient?proficiencyBonus(character.nivel||1):0);
 const total=die+bonus;
 return {ability,first,second,die,bonus,total,dc:dc==null?null:Number(dc),success:dc==null?null:total>=Number(dc)};
}
export function initiative(character){return abilityCheck(character,'dex',{dc:null})}
export function armorClass({armor='none',dexterity=10,shield=false}={}){
 const mod=modifier(dexterity);
 let ac=10+mod;
 if(armor==='leather')ac=11+mod;
 if(armor==='studded')ac=12+mod;
 if(armor==='chainmail')ac=16;
 if(armor==='plate')ac=18;
 return ac+(shield?2:0);
}
export function damageRoll(diceCount=1,dieSides=6,bonus=0){
 const rolls=Array.from({length:Math.min(30,Math.max(1,Math.trunc(diceCount)))},()=>rollDie(dieSides));
 return {rolls,total:rolls.reduce((a,b)=>a+b,0)+Math.trunc(bonus)};
}
