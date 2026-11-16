// Flow specifications and portable test cases are separate from execution history.
const exportCasePrefix='flujo-casos-especificacion-v1:';
let editingExportCase=null,lastVerification=null;
function exportCases(){const stored=readLocal(exportCasePrefix+activeTemplate,[]);return Array.isArray(stored)?stored:[]}
function storeExportCases(cases){
 if(cases.length>MAX_SPEC_CASES)throw Error('Cada flujo admite hasta '+MAX_SPEC_CASES+' casos.');
 localStorage.setItem(exportCasePrefix+activeTemplate,JSON.stringify(cases));
 lastVerification=null;
}
function defaultCaseInput(){const start=rootState.nodes.find(n=>n.type==='input');try{const parsed=JSON.parse(start?.data||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return {}}}
function resetCaseEditor(){editingExportCase=null;$('#exportCaseName').value='';$('#exportCasePath').value='';$('#exportCaseExpected').value='';$('#exportCaseInput').value=JSON.stringify(defaultCaseInput(),null,2);$('#exportCaseToday').value=localDate(new Date());$('#exportCaseAppointments').value='[]';$('#addExportCase').textContent='Guardar caso';$('#cancelEditCase').classList.add('hidden');renderGuidedInputs();setExpected('')}
function caseSnapshot(){return JSON.stringify({flow:rootState,cases:exportCases()})}
function compareScenario(test,graph){
 try{validateCase(test)}
 catch(error){return {id:test.id,name:test.name,pass:false,reason:error.message,actual:null,
  found:false,error:null,completed:false,output:null,steps:{}}}
 const fixture={appointments:test.fixture.appointments,today:test.fixture.today,
  catalogGraph:graph,idFactory:()=>'CITA-PRUEBA'};
 const result=flowRuntime.run(graph,test.input,fixture);
 const actual=caseValue(result.output,result.error,test.expected.path);
 let reason='';
 if(result.error&&test.expected.path!=='$error')reason='Error de ejecución: '+result.error;
 else if(!result.completed&&!result.error)reason='El flujo no llegó a una salida.';
 else if(!actual.found)reason='No se encontró el campo solicitado.';
 else if(!jsonEqual(actual.value,test.expected.value))reason='El valor obtenido es distinto del esperado.';
 return {id:test.id,name:test.name,pass:!reason,reason,actual:actual.found?actual.value:null,
  found:actual.found,error:result.error,completed:result.completed,output:result.output,steps:result.results};
}
function showCaseList(){const cases=exportCases();$('#exportCaseCount').textContent=`${cases.length} ${cases.length===1?'caso':'casos'}`;$('#exportCaseList').innerHTML=cases.length?cases.map(t=>{const result=lastVerification?.snapshot===caseSnapshot()?lastVerification.results.find(r=>r.id===t.id):null;return `<div class="export-case-row"><div><b>${esc(t.name)}</b><span>${esc(t.expected.path)} = ${esc(JSON.stringify(t.expected.value))}${t.proposed?' · Propuesto, por validar':''}</span>${result?`<span class="case-result ${result.pass?'ok':'fail'}">${result.pass?'✓ Coincide':'✕ '+esc(result.reason)}</span><span>Obtenido: ${esc(result.found?JSON.stringify(result.actual):'campo no encontrado')}</span>`:''}</div><div class="export-case-buttons">${t.proposed?`<button data-confirm="${esc(t.id)}">Confirmar</button>`:''}<button data-edit="${esc(t.id)}">Editar</button><button data-delete="${esc(t.id)}">Eliminar</button></div></div>`}).join(''):'<div class="history-empty">Agrega casos o carga los ejemplos propuestos para este flujo.</div>';if(!lastVerification||lastVerification.snapshot!==caseSnapshot())$('#verificationSummary').textContent='Aún no se han verificado casos para esta versión.';else{const passed=lastVerification.results.filter(x=>x.pass).length;$('#verificationSummary').textContent=`${passed} de ${lastVerification.results.length} coinciden.`}}
$('#openExport').onclick=()=>{lastVerification=null;resetCaseEditor();showCaseList();$('#exportCaseStatus').textContent='Los casos se guardan con este flujo en el navegador.';$('#exportModal').classList.remove('hidden')};
$('#closeExport').onclick=()=>$('#exportModal').classList.add('hidden');$('#exportModal').onclick=e=>{if(e.target.id==='exportModal')e.currentTarget.classList.add('hidden')};
$('#cancelEditCase').onclick=()=>{resetCaseEditor();$('#exportCaseStatus').textContent='Edición cancelada.'};
$('#addExportCase').onclick=()=>{
 try{
  const name=$('#exportCaseName').value.trim(),path=$('#exportCasePath').value.trim()||'$';
  const raw=$('#exportCaseExpected').value.trim(),today=$('#exportCaseToday').value;
  if(!name)throw Error('Escribe el nombre del caso.');
  if(!raw&&$('#exportExpectedType').value!=='text')throw Error('Escribe el resultado esperado.');
  let input,appointments;
  try{input=JSON.parse($('#exportCaseInput').value)}catch{throw Error('La entrada debe ser JSON válido.')}
  const expected=readExpected();
  try{appointments=JSON.parse($('#exportCaseAppointments').value)}
  catch{throw Error('Las citas simuladas deben ser JSON válido.')}
  const cases=exportCases(),existing=cases.find(c=>c.id===editingExportCase);
  const item={
   id:editingExportCase||'caso-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),
   name,input,expected:{path,value:expected},fixture:{today,appointments},proposed:existing?.proposed||false
  };
  validateCase(item);
  if(existing)cases[cases.indexOf(existing)]=item;else cases.push(item);
  storeExportCases(cases);resetCaseEditor();showCaseList();
  $('#exportCaseStatus').textContent='Caso guardado.';
 }catch(e){$('#exportCaseStatus').textContent=e.message}
};
$('#exportCaseList').onclick=e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit){const t=exportCases().find(c=>c.id===edit.dataset.edit);if(!t)return;editingExportCase=t.id;$('#exportCaseName').value=t.name;$('#exportCasePath').value=t.expected.path;setExpected(t.expected.value);$('#exportCaseInput').value=JSON.stringify(t.input,null,2);$('#exportCaseToday').value=t.fixture.today;$('#exportCaseAppointments').value=JSON.stringify(t.fixture.appointments,null,2);$('#addExportCase').textContent='Actualizar caso';$('#cancelEditCase').classList.remove('hidden');renderGuidedInputs();$('#exportCaseStatus').textContent='Editando caso.'}else if(del){storeExportCases(exportCases().filter(c=>c.id!==del.dataset.delete));if(editingExportCase===del.dataset.delete)resetCaseEditor();showCaseList();$('#exportCaseStatus').textContent='Caso eliminado.'}};
function exampleCases(){const today='2030-01-01',date='2030-01-02',base={propiedad:'',fecha:date,hora:'10:00',cliente:'Cliente de prueba',accion:'mensaje'};const build=(id,name,message,path,value,appointments=[])=>({id:'ejemplo-'+id,name,input:{...base,mensaje:message},expected:{path,value},fixture:{today,appointments},proposed:true});return [build('info','Información de una propiedad','Quiero información de Casa Arboleda','intencion','informacion'),build('sin-propiedad','Visita sin propiedad','Quiero agendar una visita','respuesta','¿Qué propiedad te interesa? Indica el nombre o identificador.'),build('otro','Mensaje fuera de alcance','¿Cómo estará el clima?','intencion','otro'),build('cita','Agendar horario disponible','Quiero agendar una visita a Casa Arboleda','cita.propiedad','CASA-01'),build('ocupada','Evitar cita en horario ocupado','Quiero agendar una visita a Casa Arboleda','disponible',false,[{propiedad:'CASA-01',fecha:date,hora:'10:00'}]),build('cancelacion','Cancelación no debe agendar (propuesto)','Quiero cancelar mi cita de Casa Arboleda','intencion','otro')]}
$('#seedCases').onclick=()=>{if(activeTemplate!=='new'){ $('#exportCaseStatus').textContent='Los ejemplos propuestos corresponden al flujo con subflujos.';return}const cases=exportCases(),ids=new Set(cases.map(c=>c.id)),addition=exampleCases().filter(c=>!ids.has(c.id));try{storeExportCases(cases.concat(addition))}catch(e){$('#exportCaseStatus').textContent=e.message;return}showCaseList();$('#exportCaseStatus').textContent=addition.length?`${addition.length} casos propuestos agregados; revisa sus expectativas.`:'Los ejemplos ya están cargados.'};
$('#verifyCases').onclick=()=>{const cases=exportCases();if(!cases.length){$('#verificationSummary').textContent='Agrega al menos un caso para verificar.';return}const graph=structuredClone(rootState);lastVerification={snapshot:caseSnapshot(),time:new Date().toISOString(),results:cases.map(t=>compareScenario(t,graph))};showCaseList()};
function flowWarnings(graph,label='Principal'){let warnings=[];if(!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))return [`${label}: estructura inválida.`];const nodes=graph.nodes,edges=graph.edges,ids=new Set(nodes.map(n=>n.id)),starts=nodes.filter(n=>n.type==='input');if(starts.length!==1)warnings.push(`${label}: debe existir exactamente una entrada.`);for(const e of edges)if(!ids.has(e.from)||!ids.has(e.to))warnings.push(`${label}: conexión con bloque inexistente (${e.from} → ${e.to}).`);for(const n of nodes){const branches=n.type==='output'?[]:n.type==='router'?['info','visita','falta','otro']:n.type==='condition'?['yes','no']:['next'];for(const branch of branches)if(!edges.some(e=>e.from===n.id&&e.branch===branch))warnings.push(`${label}: ${n.title} no tiene conectada la salida ${branch}.`);if(n.type==='subflow'&&n.flow)warnings.push(...flowWarnings(n.flow,label+' / '+n.title));else if(n.type==='subflow')warnings.push(`${label}: el subflujo ${n.title} no está definido.`)}return warnings}
function markdownSpec(contract){const lines=['# Especificación del flujo: '+contract.name,'','- Generado: '+contract.generatedAt,'- Formato: '+contract.formatVersion,'- Modo: simulación de comportamiento; no ejecuta integraciones productivas.','- Estado guardado: local en el navegador; no se incluye el historial. Las fechas y citas de los casos son datos simulados.','','## Estructura'];function fence(value){const content=JSON.stringify(value,null,2);let n=3;while(content.includes('`'.repeat(n)))n++;return '`'.repeat(n)+'json\n'+content+'\n'+'`'.repeat(n)}function graph(g,title,depth){lines.push('', '#'.repeat(Math.min(6,depth))+' '+title,'');for(const note of g.notes||[])lines.push('> Nota: '+String(note.title||'')+' — '+String(note.comment||'').replace(/\n/g,' '));lines.push('','| ID | Bloque | Tipo |','| --- | --- | --- |');for(const n of g.nodes||[])lines.push(`| ${String(n.id).replace(/\|/g,'\\|')} | ${String(n.title||'').replace(/\|/g,'\\|')} | ${n.type} |`);lines.push('','Conexiones:');if(!g.edges?.length)lines.push('- Sin conexiones.');for(const e of g.edges||[]){const from=g.nodes.find(x=>x.id===e.from),to=g.nodes.find(x=>x.id===e.to);lines.push(`- ${from?.title||e.from} [${e.branch}] → ${to?.title||e.to}`)}for(const n of g.nodes||[]){const config={...n};delete config.flow;delete config.id;delete config.type;delete config.title;delete config.x;delete config.y;if(Object.keys(config).length)lines.push('','**Configuración — '+n.title+'**','',fence(config));if(n.type==='subflow'&&n.flow)graph(n.flow,n.title,depth+1)}}graph(contract.flow,'Flujo principal',3);lines.push('','## Casos de prueba','');if(!contract.cases.length)lines.push('No hay casos definidos. Agrega casos para ejecutar pruebas significativas.');for(const t of contract.cases){lines.push('','### '+t.name,t.proposed?'Estado: propuesto; requiere validación.':'Estado: definido por el usuario.','','Entrada:',fence(t.input),'','Campo esperado: `'+t.expected.path+'`','',fence(t.expected.value),'','Fecha simulada: '+t.fixture.today,'','Citas simuladas:',fence(t.fixture.appointments));const result=contract.verification?.results?.find(r=>r.id===t.id);if(result)lines.push('','Última verificación: '+(result.pass?'COINCIDE':'NO COINCIDE — '+result.reason),'','Obtenido:',fence(result.found?result.actual:'Campo no encontrado'))}lines.push('','## Revisión estructural','');if(contract.warnings.length)contract.warnings.forEach(w=>lines.push('- '+w));else lines.push('No se detectaron conexiones faltantes en la revisión estructural básica.');lines.push('','## Cómo ejecutar los tests','','Descarga el archivo de pruebas para Node.js y ejecuta `node --test flujo.test.cjs`. Las pruebas utilizan datos aislados y el motor incluido en el archivo.','');return lines.join('\n')}
function createContract(){const snapshot=caseSnapshot();return {formatVersion:'flujo-spec/1.0',name:activeTemplate==='new'?'Chatbot inmobiliario con subflujos':'Chatbot inmobiliario — flujo anterior',generatedAt:new Date().toISOString(),simulation:{only:true,integrations:false,persistence:'browser-local'},flow:structuredClone(rootState),cases:structuredClone(exportCases()),warnings:flowWarnings(rootState),verification:lastVerification?.snapshot===snapshot?{time:lastVerification.time,results:lastVerification.results}:null}}
function portableTestFile(contract){const encoded=JSON.stringify(JSON.stringify(contract));return `'use strict';\n// Generado por Flujo. Ejecutar: node --test flujo.test.cjs\nconst { test } = require('node:test');\nconst assert = require('node:assert/strict');\nconst contract = JSON.parse(${encoded});\n${createFlowRuntime.toString()}\nconst runtime = createFlowRuntime();\n${caseValue.toString()}\n${jsonEqual.toString()}\nif(!contract.cases.length)test('La especificación debe contener casos de prueba',()=>assert.fail('No hay casos definidos. Agrega al menos uno en Flujo y vuelve a exportar.'));\nfor(const scenario of contract.cases)test(scenario.name,()=>{const run=runtime.run(contract.flow,scenario.input,{catalogGraph:contract.flow,appointments:scenario.fixture.appointments,today:scenario.fixture.today,idFactory:()=> 'CITA-PRUEBA'});if(run.error&&scenario.expected.path!=='$error')assert.fail('Error de ejecución: '+run.error);if(!run.completed&&!run.error)assert.fail('El flujo no llegó a una salida.');const actual=caseValue(run.output,run.error,scenario.expected.path);assert.ok(actual.found,'No se encontró el campo '+scenario.expected.path);assert.ok(jsonEqual(actual.value,scenario.expected.value),'Esperado: '+JSON.stringify(scenario.expected.value)+'; obtenido: '+JSON.stringify(actual.value))});\n`}
function downloadText(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#downloadMarkdown').onclick=()=>downloadText('especificacion-flujo.md',markdownSpec(createContract()),'text/markdown;charset=utf-8');
function serializeSpec(contract){
 parseImportedSpec(contract);
 const text=JSON.stringify(contract,null,2);
 if(new TextEncoder().encode(text).length>MAX_SPEC_BYTES){
  throw Error('La especificación supera 5 MB. Reduce los datos del modelo, la referencia o los casos.');
 }
 return text;
}

$('#downloadJson').onclick=()=>{
 try{const json=serializeSpec(createContract());$('#specTransferStatus').textContent='';downloadText('flujo-especificacion.json',json,'application/json;charset=utf-8')}
 catch(e){$('#specTransferStatus').textContent='No se puede exportar el JSON. '+e.message}
};
function downloadTestArtifact(name,generate,filter=()=>true){
 try{
  const contract=createContract();
  contract.cases.filter(filter).forEach(validateCase);
  $('#specTransferStatus').textContent='';
  downloadText(name,generate(contract),'text/javascript;charset=utf-8');
 }catch(error){$('#specTransferStatus').textContent='No se pueden exportar las pruebas. '+error.message}
}
$('#downloadTests').onclick=()=>downloadTestArtifact('flujo.test.cjs',portableTestFile);

