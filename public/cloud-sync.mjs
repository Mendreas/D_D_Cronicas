import {gameToken} from '/auth-client.mjs';
const pattern=/^(?:cv-save-|cv-party-|cv-character-)[A-Za-z0-9-]{8,110}$/;
const indexes=new Set(['cv-save-index','cv-character-index','cv-active-character']);
const isStateKey=k=>indexes.has(k)||pattern.test(k);
function collect(){
 const state={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(isStateKey(key))state[key]=localStorage.getItem(key)}
 return state;
}
function applyState(remote){
 let changed=false;
 if(!remote||typeof remote!=='object')return changed;
 for(const [key,value] of Object.entries(remote)){
  if(!isStateKey(key)||typeof value!=='string')continue;
  if(localStorage.getItem(key)!==value){localStorage.setItem(key,value);changed=true}
 }
 return changed;
}
async function requestState(method,state){
 const token=await gameToken();if(!token)throw Error('Sessão não iniciada');
 const response=await fetch('/.netlify/functions/player-sync',{method,
  headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})},
  body:method==='POST'?JSON.stringify({state}):undefined});
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(value.error||'Erro na sincronização');
 return value.state||{};
}
let inFlight=null;
export function syncPlayerState(){
 if(inFlight)return inFlight;
 inFlight=(async()=>{
  // Unir dados locais e cloud sem apagar as aventuras mais recentes.
  const state=await requestState('POST',collect());
  return applyState(state);
 })().finally(()=>{inFlight=null});
 return inFlight;
}
export async function restorePlayerState(){return syncPlayerState()}
export function queuePlayerSync(){
 // Garantir chamada serializada em cada separador, sem impedir a navegação.
 void syncPlayerState().catch(err=>{
  console.warn('A sincronização ficou pendente:',err.message);
 });
}
export function playerSyncNotice(root){
 const el=document.createElement('div');el.className='sync-status';
 el.textContent='A sincronizar progresso entre dispositivos…';
 root.prepend(el);
 restorePlayerState().then(changed=>{
  el.textContent='Progresso sincronizado com a tua conta.';
  if(changed)location.reload();
 }).catch(e=>{
  el.textContent='Progresso apenas neste dispositivo: '+e.message;
 });
}
