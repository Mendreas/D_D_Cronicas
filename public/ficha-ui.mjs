import {SKILLS_2024,modifier,proficiencyBonus,skillBonus,savingThrowBonus,classHitDie,spellAbility,rollDie} from '/rules-2024.mjs';

const ABILITIES={str:'Força',dex:'Destreza',con:'Constituição',int:'Inteligência',wis:'Sabedoria',cha:'Carisma'};
const CONDITIONS=['Cego','Enfeitiçado','Surdo','Exausto','Amedrontado','Agarrado','Incapacitado','Invisível','Paralisado','Petrificado','Envenenado','Caído','Imobilizado','Atordoado','Inconsciente'];
const SIGN=n=>Number(n)>=0?'+'+Number(n):String(Number(n));
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined&&text!==null)e.textContent=String(text);return e};
const block=(parent,...children)=>{parent.append(...children);return parent};
const section=(parent,title)=>{const box=el('section','cs-section');box.append(el('h3','cs-section-title',title));parent.append(box);return box};
const lineStat=(name,value)=>{const e=el('div','cs-stat');e.append(el('span','cs-stat-name',name),el('strong','cs-stat-value',value));return e};
function field(parent,label,value,onChange,{rows=4}={}){
 const wrap=el('label','cs-field');wrap.append(el('span',null,label));
 const input=el('textarea','cs-textarea');input.rows=rows;input.value=String(value??'');
 input.addEventListener('change',()=>onChange(input.value));
 wrap.append(input);parent.append(wrap);return input;
}
function numeric(parent,label,value,onChange,{min=0,max=999}={}){
 const wrap=el('label','cs-field cs-number');wrap.append(el('span',null,label));
 const input=el('input');input.type='number';input.min=String(min);input.max=String(max);
 input.value=String(value??0);
 input.addEventListener('change',()=>{
  const v=Math.max(min,Math.min(max,Math.trunc(Number(input.value)||0)));
  input.value=String(v);onChange(v);
 });
 wrap.append(input);parent.append(wrap);return input;
}
function labelPill(text){return el('span','cs-pill',text)}
export function renderCharacterSheet(root,{character,onSave,editHref,onOpenDice}){
 const char=character;
 const save=()=>{if(typeof onSave==='function')onSave()};
 const prof=proficiencyBonus(char.nivel||1);
 const hd=classHitDie(char);
 const spell=spellAbility(char);
 const skills=Array.isArray(char.periciasProficientes)?char.periciasProficientes:[];
 const expertise=Array.isArray(char.periciasEspecialistas)?char.periciasEspecialistas:[];
 const saving=Array.isArray(char.salvaguardasProficientes)?char.salvaguardasProficientes:[];
 const sheet=el('div','cs-sheet');
 const hero=el('div','cs-hero');
 const ident=el('div','cs-identity');
 ident.append(el('div','cs-name',char.nome||'Personagem'));
 ident.append(el('div','cs-meta',[char.raca,char.classe,char.antecedente].filter(Boolean).join(' · ')));
 const badges=el('div','cs-badges');
 for(const [label,value] of [['Nível',char.nivel||1],['Experiência',(char.experiencia||0)+' XP'],['Proficiência',SIGN(prof)]])badges.append(lineStat(label,value));
 const edit=el('a','cs-edit','Rever criação da personagem');
 edit.href=editHref||'/personagens.html';
 const inspiration=el('button','cs-inspiration',char.inspiracao?'Inspiração ativa':'Inspiração');
 inspiration.type='button';inspiration.setAttribute('aria-pressed',String(!!char.inspiracao));
 inspiration.addEventListener('click',()=>{char.inspiracao=!char.inspiracao;inspiration.textContent=char.inspiracao?'Inspiração ativa':'Inspiração';inspiration.setAttribute('aria-pressed',String(!!char.inspiracao));save()});
 badges.append(inspiration,edit);
 hero.append(ident,badges);sheet.append(hero);

 const status=el('section','cs-status');
 status.append(lineStat('Classe de armadura',char.classeArmadura??(10+modifier(char.atributos?.dex??10))));
 status.append(lineStat('Iniciativa',SIGN(modifier(char.atributos?.dex??10))));
 status.append(lineStat('Deslocação',char.deslocacao||'—'));
 status.append(lineStat('Dado de vida','d'+hd));
 const hp=el('div','cs-hp');
 const curr=numeric(hp,'PV atuais',char.pv??1,v=>{char.pv=Math.min(v,Number(char.pvMax)||v);save()});
 const maximum=lineStat('PV máximos',char.pvMax??1);maximum.classList.add('cs-hp-max');hp.append(maximum);
 numeric(hp,'PV temporários',char.pvTemporarios||0,v=>{char.pvTemporarios=v;save()});
 status.append(hp);sheet.append(status);

 const rollMessage=el('div','cs-roll-message','Clica num atributo, salvaguarda ou perícia para lançar 1d20. Os resultados não avançam automaticamente a narrativa.');
 rollMessage.setAttribute('aria-live','polite');sheet.append(rollMessage);
 const roll=(what,bonus)=>{
  const die=rollDie(20),total=die+bonus;
  rollMessage.textContent=what+': d20 ('+die+') '+SIGN(bonus)+' = '+total+
    '. Este lançamento é informativo e não altera a aventura.';
 };
 const abilities=el('section','cs-abilities');
 for(const [key,name] of Object.entries(ABILITIES)){
  const score=Number(char.atributos?.[key]??10),mod=modifier(score);
  const b=el('button','cs-ability');b.type='button';
  b.setAttribute('aria-label','Lançar teste de '+name);
  b.append(el('span','cs-ability-name',name),el('span','cs-ability-mod',SIGN(mod)),el('strong','cs-ability-score',score));
  b.addEventListener('click',()=>roll('Teste de '+name,mod));abilities.append(b);
 }
 sheet.append(abilities);

 const grid=el('div','cs-grid'),left=el('aside','cs-left'),center=el('div','cs-center'),right=el('aside','cs-right');
 const saves=section(left,'Salvaguardas');
 for(const [key,name] of Object.entries(ABILITIES)){
  const active=saving.includes(key),bonus=savingThrowBonus(char,key);
  const b=el('button','cs-skill');
  b.type='button';b.append(el('span','cs-proficiency',active?'●':'○'),el('span','cs-skill-name',name),el('strong',null,SIGN(bonus)));
  b.title=active?'Proficiência concedida':'Sem proficiência';
  b.addEventListener('click',()=>roll('Salvaguarda de '+name,bonus));saves.append(b);
 }
 const skillPanel=section(left,'Perícias');
 for(const [name,attr] of SKILLS_2024){
  const proficient=skills.includes(name),expert=expertise.includes(name),bonus=skillBonus(char,name);
  const b=el('button','cs-skill');b.type='button';
  b.append(el('span','cs-proficiency',expert?'◆':proficient?'●':'○'),el('span','cs-skill-name',name+' · '+attr.toUpperCase()),el('strong',null,SIGN(bonus)));
  b.title=expert?'Especialização':proficient?'Proficiência':'Sem proficiência';
  b.addEventListener('click',()=>roll('Perícia '+name,bonus));skillPanel.append(b);
 }
 left.append(el('p','cs-tip','● Proficiência  ◆ Especialização  ○ Sem proficiência'));

 const tabs=el('div','cs-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Secções da ficha');
 const panel=el('section','cs-tabpanel');panel.setAttribute('role','tabpanel');
 const configs=[
  ['combat','Combate'],['spells','Magias'],['inventory','Inventário'],
  ['features','Capacidades'],['notes','Notas'],['about','Sobre']
 ];
 const tabMap=new Map();
 const tabsMessage=el('p','cs-tip','Os recursos ainda não automatizados podem ser registados nas notas. A ficha não substitui um motor de combate SRD completo.');
 function renderTab(kind){
  panel.replaceChildren();
  if(kind==='combat'){
   panel.append(el('h3','cs-section-title','Combate'));
   const summary=el('div','cs-tab-stats');
   summary.append(lineStat('CA',char.classeArmadura??(10+modifier(char.atributos?.dex??10))),lineStat('Iniciativa',SIGN(modifier(char.atributos?.dex??10))),lineStat('Dado de vida','d'+hd));
   panel.append(summary);
   const actions=section(panel,'Ações de combate');
   actions.append(el('p','cs-tip','Opções gerais: Atacar, Correr, Desengajar, Esquivar, Ajudar, Esconder-se, Influenciar, Magia, Preparar, Procurar, Estudar e Utilizar. As consequências dependem do Mestre.'));
   const resources=section(panel,'Recuperação e salvaguardas contra a morte');
   const numbers=el('div','cs-form-grid');
   numeric(numbers,'Dados de vida gastos',char.dadosVidaGastos||0,v=>{char.dadosVidaGastos=Math.min(v,Number(char.nivel)||1);save()},{max:Number(char.nivel)||1});
   numeric(numbers,'Sucessos contra a morte',char.morteSucessos||0,v=>{char.morteSucessos=v;save()},{max:3});
   numeric(numbers,'Falhas contra a morte',char.morteFalhas||0,v=>{char.morteFalhas=v;save()},{max:3});
   resources.append(numbers);
   field(panel,'Ataques e equipamentos de combate (anotações)',char.ataques||'',v=>{char.ataques=v;save()});
  }else if(kind==='spells'){
   panel.append(el('h3','cs-section-title','Conjuração'));
   if(!spell)panel.append(el('p','cs-tip','Esta classe não dispõe de um atributo de conjuração básico nesta ficha. Capacidades especiais podem alterar isso.'));
   else{
    const mod=modifier(char.atributos?.[spell]??10),summary=el('div','cs-tab-stats');
    summary.append(lineStat('Atributo',ABILITIES[spell]),lineStat('CD de magia',8+mod+prof),lineStat('Ataque mágico',SIGN(mod+prof)));
    panel.append(summary);
   }
   field(panel,'Magias conhecidas ou preparadas',char.magias||'',v=>{char.magias=v;save()},{rows:8});
   field(panel,'Espaços de magia e outros recursos (registo manual)',char.espacosMagia||'',v=>{char.espacosMagia=v;save()});
  }else if(kind==='inventory'){
   panel.append(el('h3','cs-section-title','Inventário'));
   field(panel,'Equipamento',char.equipamento||'',v=>{char.equipamento=v;save()},{rows:8});
   field(panel,'Moedas e tesouros (registo manual)',char.moedas||'',v=>{char.moedas=v;save()});
  }else if(kind==='features'){
   panel.append(el('h3','cs-section-title','Capacidades e traços'));
   const feat=section(panel,'Talento de origem');
   feat.append(el('p',null,char.talentoOrigem||'Não definido'));
   field(panel,'Capacidades de classe, espécie e talentos',char.capacidades||'',v=>{char.capacidades=v;save()},{rows:8});
  }else if(kind==='notes'){
   panel.append(el('h3','cs-section-title','Notas da aventura'));
   field(panel,'Notas pessoais',char.notas||'',v=>{char.notas=v;save()},{rows:8});
   field(panel,'Personalidade',char.personalidade||'',v=>{char.personalidade=v;save()});
   field(panel,'História',char.historia||'',v=>{char.historia=v;save()});
  }else if(kind==='about'){
   panel.append(el('h3','cs-section-title','Informação da personagem'));
   const details=el('div','cs-tab-stats');
   for(const [name,value] of [['Espécie',char.raca||'—'],['Classe',char.classe||'—'],['Antecedente',char.antecedente||'—'],['Nível',char.nivel||1],['XP',char.experiencia||0],['Perceção passiva',10+skillBonus(char,'Perceção')]])details.append(lineStat(name,value));
   panel.append(details);
   const allies=section(panel,'Companheiros do grupo');
   for(const ally of char.companheiros||[])allies.append(el('p','cs-ally',(ally.nome||'Aliado')+' · '+(ally.classe||'')+' · Nível '+(ally.nivel||1)+' · '+(ally.experiencia||0)+' XP · PV '+(ally.pv??'?')+'/'+(ally.pvMax??'?')));
   if(!(char.companheiros||[]).length)allies.append(el('p','cs-tip','Ainda não há companheiros registados.'));
   panel.append(el('a','cs-edit cs-edit-bottom','Rever criação e atributos'));panel.lastChild.href=editHref||'/personagens.html';
  }
  panel.append(tabsMessage.cloneNode(true));
  for(const [id,button] of tabMap)button.setAttribute('aria-selected',String(id===kind));
 }
 for(const [id,name] of configs){
  const button=el('button','cs-tab',name);
  button.type='button';button.setAttribute('role','tab');
  button.addEventListener('click',()=>renderTab(id));
  tabMap.set(id,button);tabs.append(button);
 }
 center.append(tabs,panel);
 const senses=section(right,'Sentidos');
 senses.append(lineStat('Perceção passiva',10+skillBonus(char,'Perceção')));
 senses.append(lineStat('Intuição passiva',10+skillBonus(char,'Intuição')));
 senses.append(lineStat('Investigação passiva',10+skillBonus(char,'Investigação')));
 const defenses=section(right,'Defesas');
 field(defenses,'Resistências',char.resistencias||'',v=>{char.resistencias=v;save()},{rows:2});
 field(defenses,'Imunidades',char.imunidades||'',v=>{char.imunidades=v;save()},{rows:2});
 field(defenses,'Vulnerabilidades',char.vulnerabilidades||'',v=>{char.vulnerabilidades=v;save()},{rows:2});
 const conditions=section(right,'Condições');
 const condPanel=el('div','cs-conditions');
 char.condicoes=Array.isArray(char.condicoes)?char.condicoes:[];
 for(const name of CONDITIONS){
  const item=el('label','cs-condition'),input=el('input');
  input.type='checkbox';input.checked=char.condicoes.includes(name);
  input.addEventListener('change',()=>{
   char.condicoes=input.checked?[...new Set([...char.condicoes,name])]:char.condicoes.filter(v=>v!==name);save();
  });
  item.append(input,el('span',null,name));condPanel.append(item);
 }
 conditions.append(condPanel,el('p','cs-tip','Marcadores manuais: não aplicam automaticamente vantagens, desvantagens ou penalizações.'));
 const profs=section(right,'Proficiências e idiomas');
 field(profs,'Idiomas',char.idiomas||'',v=>{char.idiomas=v;save()},{rows:2});
 field(profs,'Armas e armaduras',char.proficienciasEquipamento||'',v=>{char.proficienciasEquipamento=v;save()},{rows:2});
 profs.append(el('p','cs-tip','Ferramenta do antecedente: '+(char.profFerramenta||'Não definida')));
 grid.append(left,center,right);sheet.append(grid);
 const foot=el('footer','cs-footer');
 foot.append(el('span',null,'Ficha de referência para D&D 2024 · Dados guardados com a tua personagem.'));
 if(typeof onOpenDice==='function'){const dice=el('button','cs-dice','🎲 Lançar outros dados');dice.type='button';dice.addEventListener('click',onOpenDice);foot.append(dice)}
 sheet.append(foot);root.replaceChildren(sheet);
 renderTab('combat');
}