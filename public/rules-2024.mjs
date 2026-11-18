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

export const SKILLS_2024=[
 ['Acrobacia','dex'],['Adestrar Animais','wis'],['Arcanismo','int'],['Atletismo','str'],['Atuação','cha'],
 ['Enganação','cha'],['Furtividade','dex'],['História','int'],['Intimidação','cha'],['Intuição','wis'],
 ['Investigação','int'],['Medicina','wis'],['Natureza','int'],['Perceção','wis'],['Persuasão','cha'],
 ['Prestidigitação','dex'],['Religião','int'],['Sobrevivência','wis']
];
const HD={Barbarian:12,Bard:8,Cleric:8,Druid:8,Fighter:10,Monk:8,Paladin:10,Ranger:10,Rogue:8,Sorcerer:6,Warlock:8,Wizard:6,Guerreiro:10,Clériga:8,Ladina:8};
export function classHitDie(character){return HD[character?.classe]||8}
export function spellAbility(character){
 const cls=String(character?.classe||'');
 if(['Wizard','Mago'].includes(cls))return 'int';
 if(['Cleric','Clériga','Druid','Druida','Ranger'].includes(cls))return 'wis';
 if(['Bard','Sorcerer','Warlock','Paladin'].includes(cls))return 'cha';
 return null;
}
export function skillBonus(character,skill){
 const ability=SKILLS_2024.find(([name])=>name===skill)?.[1]||'int';
 const prof=Array.isArray(character?.periciasProficientes)&&character.periciasProficientes.includes(skill);
 const exp=Array.isArray(character?.periciasEspecialistas)&&character.periciasEspecialistas.includes(skill);
 return modifier(character?.atributos?.[ability]??10)+(exp?2:prof?1:0)*proficiencyBonus(character?.nivel||1);
}
export function savingThrowBonus(character,ability){
 const proficient=Array.isArray(character?.salvaguardasProficientes)&&character.salvaguardasProficientes.includes(ability);
 return modifier(character?.atributos?.[ability]??10)+(proficient?proficiencyBonus(character?.nivel||1):0);
}
export function rollDice(count=1,sides=20,bonus=0){
 const n=Math.max(1,Math.min(20,Math.trunc(Number(count)||1)));
 const allowed=[4,6,8,10,12,20,100];
 if(!allowed.includes(Number(sides)))throw Error('Dado inválido');
 const rolls=Array.from({length:n},()=>rollDie(Number(sides)));
 return {dice:`${n}d${sides}`,rolls,bonus:Math.max(-99,Math.min(99,Math.trunc(Number(bonus)||0))),total:rolls.reduce((a,b)=>a+b,0)+Math.max(-99,Math.min(99,Math.trunc(Number(bonus)||0)))};
}

export function initialSavingThrows(className){
 const list={
  Barbarian:['str','con'],Bard:['dex','cha'],Cleric:['wis','cha'],
  Druid:['int','wis'],Fighter:['str','con'],Monk:['str','dex'],
  Paladin:['wis','cha'],Ranger:['str','dex'],Rogue:['dex','int'],
  Sorcerer:['con','cha'],Warlock:['wis','cha'],Wizard:['int','wis'],
  Mago:['int','wis'],Guerreiro:['str','con'],Clériga:['wis','cha'],Ladina:['dex','int']
 };
 return [...(list[String(className)||'']||[])];
}
