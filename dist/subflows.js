// The original flow remains available under its existing storage key.
const oldStorageKey='flujo-inmobiliaria-v1',newStorageKey='flujo-subflujos-v1',importStorageKey='flujo-importado-v1';
const legacyStorageKey='flujo-v1';
const flowStorageKeys={old:oldStorageKey,new:newStorageKey,legacy:legacyStorageKey,imported:importStorageKey};
const sharedCatalog=JSON.stringify(catalog,null,2);
function createBlankSubflow(){const id='sf'+Date.now()+Math.floor(Math.random()*100000);return {nodes:[{id:id+'i',type:'input',x:45,y:190,title:'Entrada del subflujo',data:'{"valor": 10}'},{id:id+'o',type:'output',x:310,y:190,title:'Salida del subflujo',message:''}],edges:[{from:id+'i',to:id+'o',branch:'next'}],notes:[]}}
function newTemplate(){return {nodes:[
{id:'m1',type:'input',x:35,y:230,title:'Mensaje del cliente',data:JSON.stringify({mensaje:'Quiero información sobre Casa Arboleda',propiedad:'',fecha:nextDate(),hora:'10:00',cliente:'Ana García',accion:'mensaje'},null,2)},
{id:'m2',type:'router',x:270,y:220,title:'¿Qué necesita el cliente?'},
{id:'m3',type:'subflow',x:540,y:25,title:'Buscar propiedad',flow:{nodes:[
{id:'p1',type:'input',x:40,y:180,title:'Datos recibidos',data:JSON.stringify({propiedad:'CASA-01',accion:'informacion'},null,2)},
{id:'p2',type:'property',x:300,y:180,title:'Consultar catálogo',catalog:sharedCatalog,catalogRef:'shared'},
{id:'p3',type:'output',x:560,y:180,title:'Devolver información',message:''}],edges:[{from:'p1',to:'p2',branch:'next'},{from:'p2',to:'p3',branch:'next'}],notes:[]}},
{id:'m4',type:'subflow',x:540,y:175,title:'Gestionar visita',flow:{nodes:[
{id:'v1',type:'input',x:35,y:200,title:'Datos de la solicitud',data:JSON.stringify({propiedad:'CASA-01',fecha:nextDate(),hora:'10:00',cliente:'Ana García',accion:'consultar'},null,2)},
{id:'v2',type:'property',x:270,y:200,title:'Buscar propiedad',catalog:sharedCatalog,catalogRef:'shared'},
{id:'v3',type:'availability',x:505,y:200,title:'Revisar disponibilidad',hours:'10:00, 12:00, 16:00'},
{id:'v4',type:'condition',x:740,y:200,title:'¿Está disponible?',field:'disponible',comparison:'eq',value:'true'},
{id:'v5',type:'booking',x:975,y:85,title:'Agendar visita'},
{id:'v6',type:'output',x:1210,y:85,title:'Visita procesada',message:''},
{id:'v7',type:'output',x:975,y:340,title:'Horario no disponible',message:'La propiedad o el horario no está disponible.'}],edges:[{from:'v1',to:'v2',branch:'next'},{from:'v2',to:'v3',branch:'next'},{from:'v3',to:'v4',branch:'next'},{from:'v4',to:'v5',branch:'yes'},{from:'v5',to:'v6',branch:'next'},{from:'v4',to:'v7',branch:'no'}],notes:[]}},
{id:'m5',type:'output',x:805,y:25,title:'Responder consulta',message:''},
{id:'m6',type:'output',x:805,y:175,title:'Responder sobre visita',message:''},
{id:'m7',type:'output',x:540,y:360,title:'Pedir propiedad',message:'¿Qué propiedad te interesa? Indica el nombre o identificador.'},
{id:'m8',type:'output',x:540,y:500,title:'Solicitud fuera de alcance',message:'Puedo ayudarte con información de propiedades o a agendar una visita.'}
],edges:[{from:'m1',to:'m2',branch:'next'},{from:'m2',to:'m3',branch:'info'},{from:'m2',to:'m4',branch:'visita'},{from:'m2',to:'m7',branch:'falta'},{from:'m2',to:'m8',branch:'otro'},{from:'m3',to:'m5',branch:'next'},{from:'m4',to:'m6',branch:'next'}],notes:[]}}
let rootState=state,activeTemplate='new',graphStack=[],chatPending=null;
function readFlow(key,fallback){
 try{
  const value=JSON.parse(localStorage.getItem(key));
  return value&&Array.isArray(value.nodes)&&Array.isArray(value.edges)?value:fallback();
 }catch{return fallback()}
}

function flowStorageScope(){
 const id=rootState?.localFlowId;
 return activeTemplate==='imported'&&typeof id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(id)?'imported-'+id:activeTemplate;
}

function loadTemplate(which){
 const fallback=which==='old'?()=>structuredClone(example):which==='new'?newTemplate:()=>null;
 const next=readFlow(flowStorageKeys[which],fallback);
 if(!next){
  $('#flowChoice').value=activeTemplate;
  toast('El flujo guardado no está disponible.');
  return;
 }
 activeTemplate=which;
 rootState=state=next;
 if(!Array.isArray(state.notes))state.notes=[];
 graphStack=[];
 chatPending=null;
 selected=state.nodes[0]?.id||null;
 pending=null;
 results={};
 try{localStorage.setItem('flujo-template-activo',which)}catch{}
 $('#flowChoice').value=which;
 updateGraphView();draw();renderDetails();
}

persist=()=>{
 try{localStorage.setItem(flowStorageKeys[activeTemplate],JSON.stringify(rootState))}
 catch{toast('No se pudo guardar en este navegador.')}
};

function updateGraphView(){
 const custom=['imported','legacy'].includes(activeTemplate);
 const label=custom?readDefinitionName():'Chatbot inmobiliario';
 $('.project-heading h1').textContent=label;
 $('#reset').disabled=custom;
 $('#reset').title=custom?'Este flujo no tiene un ejemplo para restaurar':'Restaurar ejemplo';
 const current=graphStack.at(-1)?.label||'Lienzo principal';
 $('#canvasTitle').textContent=current.toUpperCase();
 $('#flowBreadcrumb').textContent=graphStack.length?label+' / '+current:label;
 $('#backFlow').classList.toggle('hidden',!graphStack.length);
}

function readDefinitionName(){
 return readLocal('flujo-definicion-v1:'+activeTemplate,{}).name
  ||(activeTemplate==='legacy'?'Flujo original recuperado':'Flujo importado');
}
function openSubflow(node){if(!node.flow||!Array.isArray(node.flow.nodes)||!Array.isArray(node.flow.edges))node.flow=createBlankSubflow();if(!Array.isArray(node.flow.notes))node.flow.notes=[];graphStack.push({graph:state,label:node.title,selected});state=node.flow;selected=state.nodes[0]?.id||null;pending=null;persist();updateGraphView();draw();renderDetails();$('#viewport').scrollTo({left:0,top:0})}
$('#nodes').addEventListener('pointerdown',e=>{const button=e.target.closest('.quick-open');if(!button)return;const card=button.closest('.node');const node=state.nodes.find(n=>n.id===card?.dataset.id);if(node?.type==='subflow'){e.stopImmediatePropagation();e.preventDefault();selected=node.id;openSubflow(node)}},true);
$('#backFlow').onclick=()=>{const parent=graphStack.pop();if(!parent)return;state=parent.graph;selected=parent.selected;pending=null;updateGraphView();draw();renderDetails();$('#viewport').scrollTo({left:0,top:0})};
const renderBasicDetails=renderDetails;
renderDetails=function(){renderBasicDetails();const n=state.nodes.find(x=>x.id===selected);if(!n)return;if(n.type==='subflow'){$('#details .section-label').insertAdjacentHTML('afterend','<button id="enterSubflow" class="open-subflow">↗ Abrir subflujo</button><p class="detail-note">Edita los bloques internos. La entrada recibe los datos del bloque anterior y la salida los devuelve al flujo principal.</p>');$('#enterSubflow').onclick=()=>openSubflow(n)}if(n.type==='router'){$('#details .section-label').insertAdjacentHTML('afterend','<p class="detail-note">Clasifica la solicitud en información, visita, falta de propiedad u otro. Usa reglas de palabras; no interpreta lenguaje con IA.</p>')}if(n.type==='property'&&n.catalogRef==='shared'){const field=$('#details [data-key="catalog"]');field?.addEventListener('input',()=>{for(const other of allNodes(rootState))if(other.type==='property'&&other.catalogRef==='shared')other.catalog=n.catalog;persist()})}};
$('#flowChoice').onchange=e=>loadTemplate(e.target.value);
$('#reset').onclick=()=>{if(['imported','legacy'].includes(activeTemplate))return;if(!confirm('¿Restaurar este ejemplo? Se reemplazará el flujo actual guardado en este navegador.'))return;rootState=activeTemplate==='old'?structuredClone(example):newTemplate();state=rootState;graphStack=[];chatPending=null;results={};selected=state.nodes[0]?.id||null;pending=null;persist();updateGraphView();draw();renderDetails();toast('Ejemplo restaurado')};
function allNodes(graph){let found=[];for(const n of graph.nodes||[]){found.push(n);if(n.type==='subflow'&&n.flow)found=found.concat(allNodes(n.flow))}return found}
currentCatalog=function(){const node=allNodes(rootState).find(n=>n.type==='property');if(!node)throw Error('Agrega un bloque de propiedades al flujo.');let list;try{list=JSON.parse(node.catalog)}catch{throw Error('El catálogo no es JSON válido.')}if(!Array.isArray(list))throw Error('El catálogo debe ser una lista.');return list};
const flowRuntime=createFlowRuntime();
function executionRevision(graph, catalogGraph){
 const model=JSON.stringify(graph===catalogGraph?[graph]:[graph,catalogGraph]);
 let hash=14695981039346656037n;
 for(let i=0;i<model.length;i++)hash=BigInt.asUintN(64,(hash^BigInt(model.charCodeAt(i)))*1099511628211n);
 return 'motor-2/'+hash.toString(16).padStart(16,'0');
}

function runFlow(graph,inputOverride=null){
 const previous=getAppointments(),today=localDate(new Date());
 const run=flowRuntime.run(graph,inputOverride,{appointments:previous,catalogGraph:rootState,today});
 results=run.results;
 if(run.completed&&!run.error&&previous.length!==run.appointments.length){
  try{saveAppointments(run.appointments)}
  catch(e){run.error='No se pudo guardar la cita: '+e.message;run.completed=false}
 }
 recordExecution({
  error:run.error,input:run.input,output:run.output,steps:run.results,completed:run.completed,
  revision:executionRevision(graph,rootState),today,initialAppointments:previous,
  canvas:graph===rootState?[]:graphStack.map(entry=>entry.label)
 });
 draw();renderDetails();
 toast(run.error?'No se pudo completar: '+run.error:run.completed
  ?'Ejecución terminada · '+Object.keys(run.results).length+' bloques recorridos'
  :'La ejecución terminó sin llegar a una salida.');
 return run;
}
execute=function(inputOverride=null,options={}){return runFlow(options.graph||state,inputOverride)};
function openSimulation(){
 const entry=state.nodes.find(n=>n.type==='input');
 let data={};
 try{data=JSON.parse(entry?.data||'{}')}catch{}
 $('#simulationTitle').textContent='Configurar ejecución · '+($('.project-heading h1').textContent||'Sistema');
 $('#simulationInput').value=JSON.stringify(data,null,2);
 $('#simulationResult').innerHTML='<span class="muted">El resultado y los bloques recorridos aparecerán aquí.</span>';
 $('#simulationModal').classList.remove('hidden');
}
$('#run').onclick=openSimulation;
$('#runCanvas').onclick=openSimulation;
$('#closeSimulation').onclick=()=>$('#simulationModal').classList.add('hidden');
$('#simulationModal').onclick=e=>{if(e.target.id==='simulationModal')e.currentTarget.classList.add('hidden')};
$('#runSimulation').onclick=()=>{
 let input;
 try{input=JSON.parse($('#simulationInput').value);if(!input||typeof input!=='object'||Array.isArray(input))throw Error('La entrada debe ser un objeto JSON.')}
 catch(error){$('#simulationResult').innerHTML='<div class="result-box error">'+esc(error.message==='La entrada debe ser un objeto JSON.'?error.message:'JSON inválido: '+error.message)+'</div>';return}
 const run=execute(input,{graph:rootState});
 const visited=Object.keys(run.results).map(id=>allNodes(rootState).find(n=>n.id===id)?.title||id);
 const output=run.output?JSON.stringify(run.output,null,2):(run.error||'El flujo no llegó a un bloque de salida.');
 $('#simulationResult').innerHTML=`<div class="simulation-route"><b>Bloques recorridos</b><span>${visited.length?visited.map(esc).join(' → '):'Ninguno'}</span></div><div class="simulation-output"><b>${run.error?'Error':'Resultado obtenido'}</b><pre>${esc(output)}</pre></div>`;
};
// The new example becomes the default, but changing the selector restores the previous flow.
for(const slot of ['legacy','imported']){
 const option=$('#flowChoice').querySelector('option[value='+slot+']');
 option.hidden=option.disabled=!readFlow(flowStorageKeys[slot],()=>null);
}
const savedTemplate=readLocalTemplate();
rootState=null;
loadTemplate(savedTemplate);

function readLocalTemplate(){
 try{
  const slot=localStorage.getItem('flujo-template-activo');
  if(slot==='old'||slot==='new')return slot;
  if(['legacy','imported'].includes(slot)&&readFlow(flowStorageKeys[slot],()=>null))return slot;
 }catch{}
 return 'new';
}
