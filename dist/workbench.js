// Shared system definition, guided cases, change comparison and implementation contracts.
const specKeyPrefix='flujo-definicion-v1:',baselineKeyPrefix='flujo-referencia-v1:';
let lastImpact=null;
function readDefinition(){const saved=readLocal(specKeyPrefix+activeTemplate,{});return {name:saved.name||(activeTemplate==='legacy'?'Flujo original recuperado':activeTemplate==='imported'?'Flujo importado':'Chatbot inmobiliario'),purpose:saved.purpose||'',rules:saved.rules||'',questions:saved.questions||''}}
function persistDefinition(){const data={name:$('#specName').value.trim(),purpose:$('#specPurpose').value.trim(),rules:$('#specRules').value,questions:$('#specQuestions').value};try{localStorage.setItem(specKeyPrefix+activeTemplate,JSON.stringify(data));$('#specStatus').textContent='Definición guardada en este navegador.'}catch{$('#specStatus').textContent='No se pudo guardar la definición.'}}
for(const id of ['specName','specPurpose','specRules','specQuestions'])$('#'+id).addEventListener('input',persistDefinition);
$('#saveSpec').onclick=persistDefinition;
function readExpected(){const raw=$('#exportCaseExpected').value.trim(),type=$('#exportExpectedType').value;if(type==='text')return $('#exportCaseExpected').value;if(type==='boolean'){const val=raw.toLowerCase();if(['true','sí','si','yes'].includes(val))return true;if(['false','no'].includes(val))return false;throw Error('Escribe sí o no para el resultado esperado.')}if(type==='number'){if(!raw||!Number.isFinite(Number(raw)))throw Error('Escribe un número válido.');return Number(raw)}try{return JSON.parse(raw)}catch{throw Error('El resultado avanzado debe ser JSON válido.')}}
function setExpected(value){let type='text',display=String(value??'');if(typeof value==='boolean'){type='boolean';display=value?'sí':'no'}else if(typeof value==='number'){type='number';display=String(value)}else if(typeof value!=='string'){type='json';display=JSON.stringify(value)}$('#exportExpectedType').value=type;$('#exportCaseExpected').value=display;updateExpectedPlaceholder()}
function updateExpectedPlaceholder(){const type=$('#exportExpectedType').value;$('#exportCaseExpected').placeholder=type==='text'?'Ej. visita':type==='boolean'?'sí o no':type==='number'?'Ej. 240':'Ej. {"valor": 10}'}
$('#exportExpectedType').onchange=updateExpectedPlaceholder;
const fieldLabels={mensaje:'Mensaje del cliente',propiedad:'Propiedad',fecha:'Fecha de visita',hora:'Hora',cliente:'Nombre del cliente',accion:'Acción',intencion_pendiente:'Intención pendiente',propiedad_pendiente:'Propiedad pendiente'};
function renderGuidedInputs(){let value;try{value=JSON.parse($('#exportCaseInput').value)}catch{$('#guidedInputs').innerHTML='<p class="muted">Corrige la entrada avanzada para mostrar los campos.</p>';return}if(!value||typeof value!=='object'||Array.isArray(value)){$('#guidedInputs').innerHTML='<p class="muted">La entrada debe ser un objeto.</p>';return}const fields=Object.entries(value).filter(([,v])=>['string','number','boolean'].includes(typeof v));$('#guidedInputs').innerHTML=fields.length?fields.map(([key,v])=>{const type=typeof v;let control=type==='boolean'?`<select data-key="${esc(key)}" data-type="boolean"><option value="true" ${v?'selected':''}>Sí</option><option value="false" ${!v?'selected':''}>No</option></select>`:`<input data-key="${esc(key)}" data-type="${type}" ${key==='fecha'?'type="date"':type==='number'?'type="number"':'type="text"'} value="${esc(v)}">`;return `<label class="field"><span>${esc(fieldLabels[key]||key)}</span>${control}</label>`}).join(''):'<p class="muted">La entrada no contiene campos simples. Puedes editar el JSON avanzado.</p>';if(Object.values(value).some(v=>v===null||typeof v==='object'))$('#guidedInputs').insertAdjacentHTML('beforeend','<p class="muted">Los datos compuestos se editan en la entrada avanzada.</p>')}
$('#guidedInputs').addEventListener('input',e=>{const control=e.target.closest('[data-key]');if(!control)return;try{const input=JSON.parse($('#exportCaseInput').value);let value=control.value;if(control.dataset.type==='boolean')value=value==='true';if(control.dataset.type==='number'){if(value===''||!Number.isFinite(Number(value))){$('#exportCaseStatus').textContent='Escribe un número válido.';return}value=Number(value)}input[control.dataset.key]=value;$('#exportCaseInput').value=JSON.stringify(input,null,2);$('#exportCaseStatus').textContent='Datos del caso actualizados.'}catch{$('#exportCaseStatus').textContent='Corrige la entrada avanzada antes de editar estos campos.'}});
$('#exportCaseInput').addEventListener('change',renderGuidedInputs);
$('#exportCaseList').addEventListener('click',e=>{const button=e.target.closest('[data-confirm]');if(!button)return;const cases=exportCases(),item=cases.find(c=>c.id===button.dataset.confirm);if(item){item.proposed=false;storeExportCases(cases);showCaseList();$('#exportCaseStatus').textContent='Caso confirmado para el contrato.'}});
function getBaseline(){const b=readLocal(baselineKeyPrefix+activeTemplate,null);return b&&b.graph&&Array.isArray(b.graph.nodes)&&Array.isArray(b.graph.edges)?b:null}
function impactFingerprint(){return JSON.stringify({baseline:getBaseline(),flow:rootState,cases:exportCases()})}
function displayImpact(){const baseline=getBaseline();$('#baselineStatus').textContent=baseline?'Referencia guardada: '+new Date(baseline.savedAt).toLocaleString('es-MX'):'Aún no hay una referencia guardada.';const target=$('#impactResults');if(!lastImpact||lastImpact.fingerprint!==impactFingerprint()){target.innerHTML='<p class="muted">Guarda una referencia y ejecuta la comparación para ver el efecto por caso.</p>';return}const changed=lastImpact.results.filter(r=>r.changed).length;target.innerHTML=`<p class="impact-summary">${changed} de ${lastImpact.results.length} casos muestran cambios.</p>`+lastImpact.results.map(row=>`<div class="impact-row"><b>${esc(row.name)}</b><span class="verdict ${row.changed?'mismatch':'match'}">${row.changed?'Cambió':'Sin cambios'}</span><p>Antes: ${esc(row.before.pass?'coincide':'no coincide')} · ${esc(row.before.found?JSON.stringify(row.before.actual):'sin valor')}<br>Ahora: ${esc(row.after.pass?'coincide':'no coincide')} · ${esc(row.after.found?JSON.stringify(row.after.actual):'sin valor')}</p>${row.routeChanged?'<small>Cambió la ruta recorrida.</small>':row.outputChanged?'<small>Cambiaron datos de la salida.</small>':''}</div>`).join('')}
$('#saveBaseline').onclick=()=>{const previous=getBaseline();if(previous&&!confirm('¿Reemplazar la referencia guardada para este flujo?'))return;try{localStorage.setItem(baselineKeyPrefix+activeTemplate,JSON.stringify({savedAt:new Date().toISOString(),graph:structuredClone(rootState)}));lastImpact=null;displayImpact()}catch{$('#baselineStatus').textContent='No se pudo guardar la referencia.'}};
$('#compareBaseline').onclick=()=>{const baseline=getBaseline(),cases=exportCases();if(!baseline){$('#impactResults').innerHTML='<p class="muted">Primero guarda una referencia del flujo.</p>';return}if(!cases.length){$('#impactResults').innerHTML='<p class="muted">Agrega casos para comparar las dos versiones.</p>';return}const results=cases.map(t=>{const before=compareScenario(t,baseline.graph),after=compareScenario(t,rootState);const routeChanged=!jsonEqual(Object.keys(before.steps),Object.keys(after.steps))||!jsonEqual(before.visitedEdges,after.visitedEdges);const outputChanged=!jsonEqual(before.output,after.output);const changed=before.pass!==after.pass||before.error!==after.error||before.found!==after.found||!jsonEqual(before.actual,after.actual)||routeChanged||outputChanged;return {id:t.id,name:t.name,changed,routeChanged,outputChanged,before,after}});lastImpact={fingerprint:impactFingerprint(),baselineSavedAt:baseline.savedAt,time:new Date().toISOString(),results};displayImpact()};
const baseOpenExport=$('#openExport').onclick;
$('#openExport').onclick=()=>{baseOpenExport();const spec=readDefinition();$('#specName').value=spec.name;$('#specPurpose').value=spec.purpose;$('#specRules').value=spec.rules;$('#specQuestions').value=spec.questions;$('#specStatus').textContent='Estas decisiones se incluyen al exportar.';displayImpact()};
$('#openImpact').onclick=()=>{$('#openExport').click();$('#impactPanel').scrollIntoView({block:'start',behavior:'smooth'})};
const baseCreateContract=createContract;
createContract=function(){const contract=baseCreateContract(),definition=readDefinition(),lines=s=>s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);contract.name=definition.name;contract.system={purpose:definition.purpose,rules:lines(definition.rules),openQuestions:lines(definition.questions)};const baseline=getBaseline();contract.baseline=baseline?{savedAt:baseline.savedAt,flow:structuredClone(baseline.graph)}:null;contract.impact=lastImpact&&lastImpact.fingerprint===impactFingerprint()?{baselineSavedAt:lastImpact.baselineSavedAt,time:lastImpact.time,results:lastImpact.results}:null;return contract};
const baseMarkdownSpec=markdownSpec;
markdownSpec=function(contract){let text=baseMarkdownSpec(contract);const list=items=>items.length?items.map(x=>'- '+x).join('\n'):'- Pendiente de definir.';text+='\n## Definición y decisiones\n\n### Propósito\n\n'+(contract.system.purpose||'Pendiente de definir.')+'\n\n### Reglas acordadas\n\n'+list(contract.system.rules)+'\n\n### Preguntas pendientes\n\n'+list(contract.system.openQuestions)+'\n\nLas reglas en texto son decisiones documentadas; los casos confirmados son las comprobaciones del contrato. Los casos propuestos requieren validación.\n';if(contract.baseline){text+='\n## Impacto de los cambios\n\nReferencia guardada: '+contract.baseline.savedAt+'. Se comparan los mismos casos con el motor actual.\n';if(contract.impact){for(const row of contract.impact.results)text+='\n- '+row.name+': '+(row.changed?'cambió':'sin cambios')+'; antes '+(row.before.pass?'coincide':'no coincide')+', ahora '+(row.after.pass?'coincide':'no coincide')+'.';text+='\n'}else text+='\nLa referencia está guardada; no hay una comparación vigente en esta sesión.\n'}text+='\n## Contrato para la implementación\n\nDescarga los tests del sistema y la plantilla de adaptador. Implementa `ejecutarCaso({entrada, contexto})` en el adaptador; para cada caso debe preparar datos aislados y devolver `{salida, error, completado}`. Las pruebas ejecutan solo los casos confirmados contra el adaptador indicado por `FLUJO_ADAPTER`. El adaptador es una plantilla que debe conectarse al sistema desarrollado.\n';return text};
function validateAdapterResponse(response){
 if(!response||typeof response!=='object'||Array.isArray(response))throw Error('El adaptador debe devolver un objeto.');
 for(const key of ['salida','error','completado']){
  if(!Object.hasOwn(response,key))throw Error('Falta el campo '+key);
 }
 if(response.salida!==null&&(!response.salida||typeof response.salida!=='object'||Array.isArray(response.salida))){
  throw Error('salida debe ser un objeto JSON o null.');
 }
 assertJsonValue(response.salida);
 if(typeof response.completado!=='boolean')throw Error('completado debe ser booleano.');
 if(response.error!==null&&typeof response.error!=='string')throw Error('error debe ser null o texto.');
}
function systemTestFile(contract){
 const encoded=encodeTestContract({cases:contract.cases.filter(scenario=>!scenario.proposed)});
 return `'use strict';
// Ejecutar con FLUJO_ADAPTER=./adaptador.flujo.cjs node --test contrato.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const contract=JSON.parse(${encoded});
let adapter=null,loadError=null;
try{
 if(!process.env.FLUJO_ADAPTER)throw Error('Define FLUJO_ADAPTER con la ruta del adaptador del sistema.');
 adapter=require(path.resolve(process.env.FLUJO_ADAPTER));
 if(typeof adapter.ejecutarCaso!=='function')throw Error('El adaptador debe exportar ejecutarCaso.');
}catch(error){loadError=error}
test('Adaptador del sistema configurado',()=>{if(loadError)assert.fail(loadError.message)});
if(!contract.cases.length)test('El contrato debe contener casos confirmados',()=>assert.fail('No hay casos confirmados. Confirma o agrega al menos uno en Flujo.'));
${caseValue.toString()}
${jsonEqual.toString()}
${assertJsonValue.toString()}
${validateAdapterResponse.toString()}
for(const scenario of contract.cases)test(scenario.name,async()=>{
 if(loadError)assert.fail(loadError.message);
 const response=await adapter.ejecutarCaso({entrada:structuredClone(scenario.input),
  contexto:{fechaActual:scenario.fixture.today,citas:structuredClone(scenario.fixture.appointments),aislado:true}});
 validateAdapterResponse(response);
 if(response.error&&scenario.expected.path!=='$error')assert.fail('Error de ejecución: '+response.error);
 if(!response.completado&&!response.error)assert.fail('El sistema no completó el caso.');
 const actual=caseValue(response.salida,response.error,scenario.expected.path);
 assert.ok(actual.found,'No se encontró el campo '+scenario.expected.path);
 assert.ok(jsonEqual(actual.value,scenario.expected.value),'Esperado: '+JSON.stringify(scenario.expected.value)+'; obtenido: '+JSON.stringify(actual.value));
});
`;
}
const adapterTemplate=`'use strict';\n// Sustituye este ejemplo por una llamada al sistema bajo prueba.\n// Cada caso debe empezar en un entorno aislado con contexto.fechaActual y contexto.citas.\n// Devuelve { salida: objeto_o_null, error: texto_o_null, completado: booleano }.\nasync function ejecutarCaso({entrada,contexto}) {\n  throw new Error('Implementa el adaptador y conecta un entorno de pruebas aislado.');\n}\nmodule.exports = { ejecutarCaso };\n`;
$('#downloadContractTests').onclick=()=>downloadTestArtifact('contrato.test.cjs',systemTestFile);
$('#downloadAdapter').onclick=()=>downloadText('adaptador.flujo.cjs',adapterTemplate,'text/javascript;charset=utf-8');
