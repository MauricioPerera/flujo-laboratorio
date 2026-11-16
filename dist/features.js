// Notes and execution history are stored alongside the current browser-local flow.
if (!Array.isArray(state.notes)) state.notes = [];
let noteDrag = null;
function drawNotes(){
 const layer=$('#notes');
 layer.innerHTML=state.notes.map(note=>`<section class="sticky-note" data-note="${esc(note.id)}" style="left:${Number(note.x)}px;top:${Number(note.y)}px;width:${Number(note.width)}px;height:${Number(note.height)}px"><div class="sticky-header"><button class="note-move" title="Mover nota y bloques contenidos" aria-label="Mover nota y bloques contenidos">⠿</button><input class="note-title" aria-label="Título de la nota" value="${esc(note.title)}"><button class="note-delete" title="Eliminar nota" aria-label="Eliminar nota">×</button></div><textarea class="note-comment" aria-label="Comentario de la nota" placeholder="Añade un comentario...">${esc(note.comment)}</textarea><button class="note-resize" title="Cambiar tamaño" aria-label="Cambiar tamaño de la nota">◢</button></section>`).join('');
}
const drawNodesAndEdges=draw;
draw=function(){drawNodesAndEdges();drawNotes()};
$('#addNote').onclick=()=>{const viewport=$('#viewport');const note={id:'nota-'+Date.now(),x:Math.max(0,Math.min(1100,Math.round(viewport.scrollLeft/zoom)+35)),y:Math.max(0,Math.min(390,Math.round(viewport.scrollTop/zoom)+30)),width:470,height:280,title:'Nueva sección',comment:''};state.notes.push(note);persist();drawNotes();toast('Arrastra la nota sobre los bloques que quieras agrupar.')};
$('#notes').addEventListener('input',e=>{const element=e.target.closest('[data-note]');if(!element)return;const note=state.notes.find(n=>n.id===element.dataset.note);if(!note)return;if(e.target.classList.contains('note-title'))note.title=e.target.value;if(e.target.classList.contains('note-comment'))note.comment=e.target.value;persist()});
$('#notes').addEventListener('click',e=>{const element=e.target.closest('[data-note]');if(!element)return;if(e.target.closest('.note-delete')){state.notes=state.notes.filter(n=>n.id!==element.dataset.note);persist();drawNotes();toast('Nota eliminada')}});
$('#notes').addEventListener('pointerdown',e=>{const element=e.target.closest('[data-note]');if(!element)return;const move=e.target.closest('.note-move'),resize=e.target.closest('.note-resize');if(!move&&!resize)return;const note=state.notes.find(n=>n.id===element.dataset.note);if(!note)return;const members=move?state.nodes.filter(n=>{const el=document.querySelector(`.node[data-id="${n.id}"]`);const cx=n.x+95,cy=n.y+(el?.offsetHeight||120)/2;return cx>=note.x&&cx<=note.x+note.width&&cy>=note.y&&cy<=note.y+note.height}).map(n=>({id:n.id,x:n.x,y:n.y})):[];noteDrag={id:note.id,mode:move?'move':'resize',startX:e.clientX,startY:e.clientY,x:note.x,y:note.y,width:note.width,height:note.height,members};e.preventDefault()});
window.addEventListener('pointermove',e=>{if(!noteDrag)return;const n=state.notes.find(x=>x.id===noteDrag.id);if(!n)return;const dx=(e.clientX-noteDrag.startX)/zoom,dy=(e.clientY-noteDrag.startY)/zoom,el=document.querySelector(`.sticky-note[data-note="${n.id}"]`);if(noteDrag.mode==='move'){let minX=-noteDrag.x,maxX=1630-noteDrag.width-noteDrag.x,minY=-noteDrag.y,maxY=700-noteDrag.height-noteDrag.y;for(const member of noteDrag.members){minX=Math.max(minX,-member.x);maxX=Math.min(maxX,1430-member.x);minY=Math.max(minY,-member.y);maxY=Math.min(maxY,560-member.y)}const mx=Math.max(minX,Math.min(maxX,dx)),my=Math.max(minY,Math.min(maxY,dy));n.x=noteDrag.x+mx;n.y=noteDrag.y+my;el.style.left=n.x+'px';el.style.top=n.y+'px';for(const member of noteDrag.members){const node=state.nodes.find(x=>x.id===member.id);if(!node)continue;node.x=member.x+mx;node.y=member.y+my;const nodeEl=document.querySelector(`.node[data-id="${node.id}"]`);if(nodeEl){nodeEl.style.left=node.x+'px';nodeEl.style.top=node.y+'px'}}drawEdges()}else{n.width=Math.max(230,Math.min(1630-n.x,noteDrag.width+dx));n.height=Math.max(145,Math.min(700-n.y,noteDrag.height+dy));el.style.width=n.width+'px';el.style.height=n.height+'px'}});
window.addEventListener('pointerup',()=>{if(noteDrag){persist();noteDrag=null}});

$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.canvas-wrap').requestFullscreen()}catch{toast('La pantalla completa no está disponible en este navegador.')}};
document.addEventListener('fullscreenchange',()=>{const active=!!document.fullscreenElement;$('#fullscreen').title=active?'Salir de pantalla completa':'Pantalla completa';$('#fullscreen').setAttribute('aria-label',$('#fullscreen').title)});
$('#runCanvas').onclick=()=>execute();
const historyKey=()=>'flujo-historial-v1:'+flowStorageScope();
const caseKey=()=>'flujo-caso-v1:'+flowStorageScope();

function readLocal(key,fallback){
 try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}
}

function caseConfig(){return readLocal(caseKey(),{name:'',path:'$',expected:''})}

function recordExecution(run){
 try{
  const config=caseConfig(),path=config.path||'$';
  const hasExpected=typeof config.expected==='string'&&config.expected.trim()!=='';
  let expected=null,obtained=null,verdict='Sin comparar';
  if(hasExpected){
   try{
    expected=JSON.parse(config.expected);
    obtained=caseValue(run.output,run.error,path);
    if(run.error&&path!=='$error')verdict='Error';
    else if(!run.completed&&!run.error)verdict='Incompleto';
    else verdict=obtained.found&&jsonEqual(expected,obtained.value)?'Coincide':'No coincide';
   }catch{verdict='Expectativa inválida'}
  }
  const entry={
   id:Date.now()+'-'+Math.random().toString(36).slice(2),time:new Date().toISOString(),simulationOnly:true,
   flowScope:flowStorageScope(),revision:run.revision,canvas:run.canvas,
   today:run.today,initialAppointments:run.initialAppointments,
   name:config.name?.trim()||'Sin nombre',path,hasExpected,expected,obtained,verdict,
   error:run.error,completed:run.completed,input:run.input,output:run.output,steps:run.steps
  };
  const history=readLocal(historyKey(),[]);
  const entries=Array.isArray(history)?history:[];
  localStorage.setItem(historyKey(),JSON.stringify([entry,...entries].slice(0,100)));
 }catch{toast('No se pudo guardar la ejecución en el historial.')}
}

function renderLegacyRecords(){
 const history=readLocal('flujo-historial-v1',[]);
 const appointments=readLocal('flujo-citas-demo',[]);
 const previousCase=readLocal('flujo-caso-v1',null);
 const archive=$('#legacyRecords');
 archive.hidden=!(history.length||appointments.length||previousCase);
 archive.querySelector('pre').textContent=archive.hidden?'':printable({
  ejecuciones:history,citas:appointments,casoConfigurado:previousCase
 });
}
function printable(v){return JSON.stringify(v,null,2)??'Sin dato'}
function renderHistory(){renderLegacyRecords();let history=readLocal(historyKey(),[]);if(!Array.isArray(history))history=[];$('#historyCount').textContent=`${history.length} ${history.length===1?'registro':'registros'}`;$('#historyList').innerHTML=history.length?history.map(item=>{const result=item.hasExpected?(item.obtained?.found?printable(item.obtained.value):'Campo no encontrado'):(item.error||printable(item.output));const cls=item.verdict==='Coincide'?'match':item.verdict==='No coincide'?'mismatch':'';return `<details class="history-row"><summary><div><b>${esc(item.name)}</b><span>Simulación · ${esc(new Date(item.time).toLocaleString('es-MX'))} · ${item.error?'Error':item.completed?'Completado':'Incompleto'}</span></div><span class="verdict ${cls}">${esc(item.verdict)}</span></summary><div class="history-detail"><div><b>Modo</b><code>Simulación · datos locales</code></div><div><b>Campo</b><code>${esc(item.hasExpected?item.path:'Sin comparación')}</code></div><div><b>Esperado</b><pre>${esc(item.hasExpected?printable(item.expected):'No definido')}</pre></div><div><b>Obtenido</b><pre>${esc(result)}</pre></div><details><summary>Ver entrada, salida y pasos</summary><pre>${esc(printable({simulacion:true,entrada:item.input,salida:item.output,error:item.error,flujo:item.flowScope,revision:item.revision,lienzo:item.canvas,fechaActual:item.today,citasIniciales:item.initialAppointments,pasos:item.steps}))}</pre></details></div></details>`}).join(''):'<div class="history-empty">Todavía no hay ejecuciones. Configura un caso y ejecuta el flujo para comenzar.</div>'}
$('#openHistory').onclick=()=>{const config=caseConfig();$('#caseName').value=config.name||'';$('#casePath').value=config.path||'$';$('#caseExpected').value=config.expected||'';$('#caseStatus').textContent='Se aplica a las siguientes ejecuciones.';renderHistory();$('#historyModal').classList.remove('hidden')};
$('#closeHistory').onclick=()=>$('#historyModal').classList.add('hidden');$('#historyModal').onclick=e=>{if(e.target.id==='historyModal')e.currentTarget.classList.add('hidden')};
$('#saveCase').onclick=()=>{const expected=$('#caseExpected').value.trim(),path=$('#casePath').value.trim()||'$';if(expected){try{JSON.parse(expected)}catch{$('#caseStatus').textContent='El resultado esperado debe ser JSON válido.';return}}if(!validCasePath(path)){$('#caseStatus').textContent='El campo debe ser una ruta como cita.cliente, $ o $error.';return}try{localStorage.setItem(caseKey(),JSON.stringify({name:$('#caseName').value.trim(),path,expected}));$('#caseStatus').textContent='Caso guardado para las siguientes ejecuciones.'}catch{$('#caseStatus').textContent='No se pudo guardar el caso.'}};
$('#clearHistory').onclick=()=>{const history=readLocal(historyKey(),[]);if(!history.length)return;if(confirm('¿Borrar las ejecuciones guardadas de este flujo?')){localStorage.removeItem(historyKey());renderHistory()}};
drawNotes();
