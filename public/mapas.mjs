// Mapas exploráveis do Crónicas do Véu.
// Posições cartográficas esquemáticas: não representam distâncias reais do mundo de jogo.
const locations={
 veu:{
  title:'O Limiar do Véu',
  outdoors:[
   {id:'aldeia-blackwood',label:'Aldeia de Blackwood',x:170,y:510},
   {id:'trilha-sombria',label:'Trilha Sombria',x:385,y:360},
   {id:'circulo-pedras',label:'Círculo de Pedras',x:640,y:455},
   {id:'blackwood-ruinas',label:'Ruínas da Torre',x:800,y:260}
  ],
  interiors:[
   {id:'sala-ruinas',label:'Salão das Ruínas',x:275,y:205},
   {id:'escadaria-torre',label:'Escadaria da Torre',x:710,y:205},
   {id:'cripta-subterranea',label:'Cripta Subterrânea',x:710,y:505},
   {id:'camara-ritual',label:'Câmara do Artefacto',x:275,y:505}
  ],
  roads:[['aldeia-blackwood','trilha-sombria'],['trilha-sombria','circulo-pedras'],['trilha-sombria','blackwood-ruinas'],['circulo-pedras','blackwood-ruinas']],
  passage:[['sala-ruinas','escadaria-torre'],['escadaria-torre','cripta-subterranea'],['cripta-subterranea','camara-ritual']]
 },
 farol:{
  title:'O Farol de Cinzabruma',
  outdoors:[
   {id:'porto-cinzabruma',label:'Porto de Cinzabruma',x:170,y:260},
   {id:'vila-cinzabruma',label:'Vila de Cinzabruma',x:390,y:330},
   {id:'falesia-tempestuosa',label:'Falésia Tempestuosa',x:600,y:440},
   {id:'exterior-farol',label:'Exterior do Farol',x:805,y:255}
  ],
  interiors:[
   {id:'interior-farol',label:'Interior do Farol',x:275,y:205},
   {id:'tunel-contrabandistas',label:'Túnel dos Contrabandistas',x:710,y:505},
   {id:'sala-da-lanterna',label:'Sala da Lanterna',x:710,y:205},
   {id:'gruta-oculta',label:'Gruta Oculta',x:275,y:505}
  ],
  roads:[['porto-cinzabruma','vila-cinzabruma'],['vila-cinzabruma','falesia-tempestuosa'],['falesia-tempestuosa','exterior-farol']],
  passage:[['interior-farol','sala-da-lanterna'],['interior-farol','tunel-contrabandistas'],['tunel-contrabandistas','gruta-oculta']]
 },
 estrelas:{
  title:'As Chaves das Estrelas',
  outdoors:[
   {id:'observatorio-exterior',label:'Observatório de Serath',x:240,y:360},
   {id:'observatorio-cupula',label:'Cúpula do Observatório',x:680,y:270},
   {id:'jardim-constelacao',label:'Jardim das Constelações',x:800,y:530}
  ],
  interiors:[
   {id:'sala-dos-mapas',label:'Sala dos Mapas',x:245,y:180},
   {id:'corredor-celeste',label:'Corredor Celeste',x:535,y:180},
   {id:'camara-astral',label:'Câmara Astral',x:850,y:180},
   {id:'biblioteca-estelar',label:'Biblioteca Estelar',x:250,y:505},
   {id:'portal-estelar',label:'Portal das Estrelas',x:830,y:505}
  ],
  roads:[['observatorio-exterior','observatorio-cupula'],['observatorio-exterior','jardim-constelacao'],['observatorio-cupula','jardim-constelacao']],
  passage:[['sala-dos-mapas','corredor-celeste'],['corredor-celeste','camara-astral'],['sala-dos-mapas','biblioteca-estelar'],['camara-astral','portal-estelar'],['biblioteca-estelar','portal-estelar']]
 }
};
const NS='http://www.w3.org/2000/svg';
const sEl=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const [name,value] of Object.entries(attrs))el.setAttribute(name,String(value));return el};
function addText(parent,tag,text,attrs={}){const el=sEl(tag,attrs);el.textContent=text;parent.append(el);return el}
function interiorBackdrop(svg,campaign){
 const palette={veu:['#171c1a','#344438'],farol:['#14242b','#2d4754'],estrelas:['#19192c','#38365b']}[campaign];
 const defs=sEl('defs'),grad=sEl('linearGradient',{id:'floor-gradient',x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
 grad.append(sEl('stop',{offset:'0%','stop-color':palette[1]}),sEl('stop',{offset:'100%','stop-color':palette[0]}));defs.append(grad);svg.append(defs);
 svg.append(sEl('rect',{width:1100,height:720,fill:'url(#floor-gradient)'}));
 for(let x=70;x<1050;x+=70)svg.append(sEl('path',{d:`M${x} 75V645`,stroke:'#90a4a9','stroke-width':1,opacity:'.09'}));
 for(let y=75;y<650;y+=70)svg.append(sEl('path',{d:`M70 ${y}H1030`,stroke:'#90a4a9','stroke-width':1,opacity:'.09'}));
 svg.append(sEl('rect',{x:55,y:70,width:990,height:585,rx:18,fill:'none',stroke:'#ad9e7c','stroke-width':5,opacity:'.57'}));
 svg.append(sEl('rect',{x:90,y:102,width:920,height:520,rx:11,fill:'none',stroke:'#8e8d7e','stroke-width':2,opacity:'.33','stroke-dasharray':'8 12'}));
 addText(svg,'text','PLANTA DE EXPLORAÇÃO',{x:550,y:54,'text-anchor':'middle',fill:'#ead6ae','font-family':'Georgia,serif','font-size':29,'letter-spacing':4});
 addText(svg,'text','Esquema dos espaços conhecidos, sem escala',{x:550,y:687,'text-anchor':'middle',fill:'#b7bea9','font-family':'Georgia,serif','font-size':17});
}
function drawMap(svg,config,campaign,mode,current,known,history,details,showUnknown){
 const items=mode==='interior'?config.interiors:config.outdoors;
 const paths=mode==='interior'?config.passage:config.roads;
 const locMap=new Map(items.map(x=>[x.id,x]));
 if(mode==='interior')interiorBackdrop(svg,campaign);
 else svg.append(sEl('image',{href:'/assets/mapa-'+campaign+'.svg',x:0,y:0,width:1100,height:720,preserveAspectRatio:'xMidYMid meet'}));
 for(const [start,end] of paths){
  const a=locMap.get(start),b=locMap.get(end);if(!a||!b)continue;
  const knownBoth=known.has(start)&&known.has(end);
  const path=sEl('path',{d:`M${a.x} ${a.y} Q${(a.x+b.x)/2} ${(a.y+b.y)/2-40} ${b.x} ${b.y}`,
   fill:'none',stroke:mode==='interior'?'#bdad87':'#65563d','stroke-width':knownBoth?5:3,
   'stroke-linecap':'round','stroke-dasharray':knownBoth?'9 10':'4 16',opacity:knownBoth?.95:.3});
  svg.append(path);
 }
 // Percurso efetivo da equipa, obtido do histórico de deslocações do save.
 // Uma mudança de mapa interrompe a linha, evitando saltos inventados.
 const trace=Array.isArray(history)?history:[];
 for(let i=1;i<trace.length;i++){
  const a=locMap.get(trace[i-1]),b=locMap.get(trace[i]);
  if(!a||!b||a.id===b.id)continue;
  const travelled=sEl('path',{d:`M${a.x} ${a.y} L${b.x} ${b.y}`,
   fill:'none',stroke:'#e3ac58','stroke-width':8,'stroke-linecap':'round',opacity:'.85'});
  svg.append(travelled);
 }
 for(const loc of items){
  const seen=known.has(loc.id)||loc.id===current;
  if(!seen&&!showUnknown)continue;
  const currentNode=loc.id===current;
  const g=sEl('g',{'data-map-location':loc.id,role:'button',tabindex:0,'aria-label':seen?loc.label:'Local ainda por descobrir',style:'cursor:pointer'});
  if(currentNode){
   const halo=sEl('circle',{cx:loc.x,cy:loc.y,r:29,fill:'#ffd78b',opacity:'.2',class:'map-pulse'});
   g.append(halo);
  }
  g.append(sEl('circle',{cx:loc.x,cy:loc.y,r:currentNode?20:seen?17:13,fill:currentNode?'#d5a551':seen?'#43524a':'#6a7475',stroke:currentNode?'#fff4cf':'#e8d3a2','stroke-width':currentNode?4:2.5}));
  if(currentNode)addText(g,'text','◆',{x:loc.x,y:loc.y+7,'text-anchor':'middle',fill:'#24190d','font-size':21});
  else addText(g,'text',seen?'✓':'?',{x:loc.x,y:loc.y+6,'text-anchor':'middle',fill:seen?'#ffe9a8':'#dce1df','font-size':18,'font-weight':'bold'});
  const width=Math.min(270,Math.max(155,loc.label.length*10.3+26));
  const textY=loc.y+36,anchor=loc.x>920?'end':loc.x<140?'start':'middle';
  const rectX=anchor==='middle'?loc.x-width/2:anchor==='end'?loc.x-width:loc.x;
  const label=seen?loc.label:'Por descobrir';
  g.append(sEl('rect',{x:rectX,y:textY-20,width,height:28,rx:7,fill:mode==='interior'?'#101a22':'#25251f',opacity:'.88'}));
  addText(g,'text',label,{x:anchor==='middle'?loc.x:anchor==='end'?loc.x:loc.x,y:textY,'text-anchor':anchor,fill:currentNode?'#ffdc93':'#f9efd5','font-family':'Georgia,serif','font-size':16,'font-weight':currentNode?'bold':'normal'});
  const onPick=()=>{details.textContent=(seen?loc.label:'Local por descobrir')+(currentNode?' — localização atual.':seen?' — local já visitado.':' — ainda não visitado.')+' Os marcadores são informativos e não deslocam o grupo.'};
  g.addEventListener('click',onPick);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick()}});
  svg.append(g);
 }
}
export function renderCampaignMap(target,{campaignId,currentLocation='',visited=[],history=[],mode='auto'}={}){
 const campaign=locations[campaignId]||locations.veu;
 target.replaceChildren();
 const known=new Set([...(visited||[]),currentLocation].filter(Boolean));
 const inside=new Set(campaign.interiors.map(x=>x.id));
 let activeMode=mode==='auto'?(inside.has(currentLocation)?'interior':'global'):(mode==='interior'?'interior':'global');
 let showUnknown=true;
 const wrapper=document.createElement('div');wrapper.className='cv-map-ui';
 const tools=document.createElement('div');tools.className='cv-map-tools';
 const overview=document.createElement('button'),rooms=document.createElement('button'),toggle=document.createElement('button'),save=document.createElement('button');
 overview.textContent='Mapa geral';rooms.textContent='Mapa local / interiores';toggle.textContent='Ocultar locais desconhecidos';save.textContent='Guardar PNG';
 for(const b of [overview,rooms,toggle,save]){b.type='button';b.className='secondary';tools.append(b)}
 const notice=document.createElement('p');notice.className='cv-map-status';
 const frame=document.createElement('div');frame.className='cv-map-frame';
 const svg=sEl('svg',{viewBox:'0 0 1100 720',role:'img','aria-label':'Mapa de '+campaign.title});
 frame.append(svg);
 const legend=document.createElement('div');legend.className='cv-map-legend';
 legend.textContent='◆ Posição atual    ✓ Visitado    ? Não descoberto    Dourado: percurso realizado    ··· Ligações possíveis';
 const intro=document.createElement('p');intro.className='helper';
 intro.textContent='Posições ilustrativas, não representam distâncias ou rotas exatas. O mapa muda quando a aventura regista uma nova localização.';
 wrapper.append(tools,frame,legend,notice,intro);target.append(wrapper);
 function paint(){
  svg.replaceChildren();
  drawMap(svg,campaign,campaignId,activeMode,currentLocation,known,history,notice,showUnknown);
  overview.setAttribute('aria-pressed',String(activeMode==='global'));
  rooms.setAttribute('aria-pressed',String(activeMode==='interior'));
  const shown=activeMode==='global'?campaign.outdoors:campaign.interiors;
  notice.textContent=shown.filter(x=>known.has(x.id)).length+' de '+shown.length+' locais desta área descobertos.';
  toggle.textContent=showUnknown?'Ocultar locais desconhecidos':'Mostrar locais desconhecidos';
 }
 overview.onclick=()=>{activeMode='global';paint()};
 rooms.onclick=()=>{activeMode='interior';paint()};
 toggle.onclick=()=>{showUnknown=!showUnknown;paint()};
 save.onclick=async()=>{
  // Transformar o SVG visualizado num PNG autónomo (inclui fundo e marcadores).
  try{
   const copy=svg.cloneNode(true);
   const image=copy.querySelector('image');
   if(image){const response=await fetch(image.getAttribute('href'));if(!response.ok)throw Error('Fundo indisponível');
    const source=await response.text();
    image.setAttribute('href','data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(source))));
   }
   const serialized=new XMLSerializer().serializeToString(copy);
   const blob=new Blob([serialized],{type:'image/svg+xml;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const img=new Image();
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
   const canvas=document.createElement('canvas');canvas.width=2200;canvas.height=1440;
   canvas.getContext('2d').drawImage(img,0,0,2200,1440);URL.revokeObjectURL(url);
   const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!png)throw Error('Exportação indisponível');
   const out=URL.createObjectURL(png),a=document.createElement('a');a.href=out;a.download='mapa-'+campaignId+'-'+activeMode+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(out),1500);
  }catch(err){notice.textContent='Não foi possível guardar o PNG: '+(err?.message||err)}
 };
 paint();
}
