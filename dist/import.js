// A JSON artifact opens in its own slot.
let pendingImport=null;
let importAttempt=0;
const nodeTypes=new Set(['input','output','operation','condition','router','subflow','property','availability','booking']);
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);

function validGraph(graph,seen=new Set(),depth=0){
 if(depth>12||!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges)){
  throw Error('El flujo o sus subflujos tienen una estructura inválida.');
 }
 if(graph.nodes.length>500||graph.edges.length>1000)throw Error('El flujo excede el tamaño permitido.');
 for(const node of graph.nodes){
  if(!node||!validId(node.id)||seen.has(node.id)||!nodeTypes.has(node.type)
   ||typeof node.title!=='string'||!Number.isFinite(node.x)||!Number.isFinite(node.y)){
   throw Error('Hay un bloque inválido o un identificador repetido.');
  }
  seen.add(node.id);
  if(node.type==='subflow')validGraph(node.flow,seen,depth+1);
 }
 for(const edge of graph.edges){
  if(!edge||!validId(edge.from)||!validId(edge.to)||typeof edge.branch!=='string'){
   throw Error('Hay una conexión con formato inválido.');
  }
 }
 if(graph.notes!=null&&!Array.isArray(graph.notes))throw Error('Las notas tienen un formato inválido.');
 for(const note of graph.notes||[]){
  if(!note||!validId(note.id)||![note.x,note.y,note.width,note.height].every(Number.isFinite)){
   throw Error('Hay una nota con formato inválido.');
  }
 }
 graph.notes??=[];
}

function parseImportedSpec(data){
 if(!data||data.formatVersion!=='flujo-spec/1.0'){
  throw Error('El archivo no es una especificación compatible de Flujo.');
 }
 const flow=structuredClone(data.flow);
 validGraph(flow);
 if(!Array.isArray(data.cases)||data.cases.length>MAX_SPEC_CASES){
  throw Error('La especificación admite hasta '+MAX_SPEC_CASES+' casos.');
 }
 const cases=structuredClone(data.cases),ids=new Set();
 for(const [index,test] of cases.entries()){
  try{
   validateCase(test);
   if(ids.has(test.id))throw Error('Identificador de caso repetido.');
   ids.add(test.id);
  }catch(error){throw Error('Caso '+(index+1)+': '+error.message)}
 }
 const system=data.system||{};
 const lines=value=>Array.isArray(value)?value.filter(text=>typeof text==='string').join('\n'):'';
 let baseline=null;
 if(data.baseline?.flow){
  const graph=structuredClone(data.baseline.flow);
  validGraph(graph);
  if(!Number.isFinite(Date.parse(data.baseline.savedAt)))throw Error('La fecha de la referencia no es válida.');
  baseline={savedAt:data.baseline.savedAt,graph};
 }
 return {
  flow,cases,baseline,
  definition:{
   name:typeof data.name==='string'?data.name:'Flujo importado',
   purpose:typeof system.purpose==='string'?system.purpose:'',
   rules:lines(system.rules),questions:lines(system.openQuestions)
  }
 };
}

$('#importFile').onchange=async event=>{
 const attempt=++importAttempt;
 const file=event.target.files?.[0];
 pendingImport=null;
 $('#confirmImport').disabled=true;
 if(!file){$('#importStatus').textContent='Ningún archivo seleccionado.';return}
 try{
  if(file.size>MAX_SPEC_BYTES)throw Error('El archivo supera el límite de 5 MB.');
  const text=await file.text();
  if(attempt!==importAttempt)return;
  pendingImport=parseImportedSpec(JSON.parse(text));
  const {definition,flow,cases}=pendingImport;
  $('#importStatus').textContent=definition.name+': '+flow.nodes.length+' bloques principales y '
   +cases.length+' casos. Se abrirá en el espacio «Flujo importado».';
  $('#confirmImport').disabled=false;
 }catch(error){
  if(attempt===importAttempt)$('#importStatus').textContent='No se puede abrir: '+error.message;
 }
};

$('#confirmImport').onclick=()=>{
 if(!pendingImport)return;
 if(readFlow(importStorageKey,()=>null)
  &&!confirm('¿Reemplazar el flujo importado anterior? Los otros flujos no cambiarán.'))return;
 const {flow,cases,definition,baseline}=pendingImport;
 const keys=[importStorageKey,exportCasePrefix+'imported',specKeyPrefix+'imported',baselineKeyPrefix+'imported'];
 let previous;
 try{
  previous=keys.map(key=>localStorage.getItem(key));
  const localFlowId=crypto.randomUUID();
  localStorage.setItem(keys[0],JSON.stringify({...flow,localFlowId}));
  localStorage.setItem(keys[1],JSON.stringify(cases));
  localStorage.setItem(keys[2],JSON.stringify(definition));
  if(baseline)localStorage.setItem(keys[3],JSON.stringify(baseline));
  else localStorage.removeItem(keys[3]);
 }catch(error){
  if(previous)for(const [index,key] of keys.entries()){
   try{
    if(previous[index]===null)localStorage.removeItem(key);
    else localStorage.setItem(key,previous[index]);
   }catch{}
  }
  $('#importStatus').textContent='No se pudo guardar el flujo importado: '+error.message;
  return;
 }
 const option=$('#flowChoice').querySelector('option[value=imported]');
 option.hidden=option.disabled=false;
 loadTemplate('imported');
 lastVerification=lastImpact=pendingImport=null;
 $('#importFile').value='';
 $('#importStatus').textContent='Ningún archivo seleccionado.';
 $('#confirmImport').disabled=true;
 $('#exportModal').classList.add('hidden');
 toast('Flujo importado en un espacio separado.');
};
