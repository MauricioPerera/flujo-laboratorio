// Shared deterministic interpreter: browser execution and exported tests use this exact function.
function createFlowRuntime(){
let catalogGraph=null;
function allNodes(g){let found=[];for(const n of g?.nodes||[]){found.push(n);if(n.type==='subflow'&&n.flow)found=found.concat(allNodes(n.flow))}return found}
function currentCatalog(){const node=allNodes(catalogGraph).find(n=>n.type==='property');if(!node)throw Error('Agrega un bloque de propiedades al flujo.');const list=JSON.parse(node.catalog);if(!Array.isArray(list))throw Error('El catálogo debe ser una lista.');return list}
function localDate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function valueOf(input,data){const v=String(input??'').trim();if(Object.prototype.hasOwnProperty.call(data,v))return data[v];if(v!==''&&Number.isFinite(Number(v)))return Number(v);return v}
function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function numeric(value){
 const number=typeof value==='string'&&value.trim()!==''?Number(value):value;
 return Number.isFinite(number)?number:NaN;
}
function classify(data){
 const text=normalize(data.mensaje), action=data.accion;
 let catalog=[];
 try{catalog=currentCatalog()}catch{}
 const found=text?catalog.find(p=>p&&[p.id,p.nombre].some(v=>v&&text.includes(normalize(v)))):null;
 const pendingIntent=['visita','informacion'].includes(data.intencion_pendiente)?data.intencion_pendiente:null;
 const confirmation=/^(?:si|listo|confirmo|de acuerdo|correcto|adelante|ok|esta bien)[.!¡!¿?\s]*$/.test(text.trim());
 const followUp=pendingIntent&&(found||confirmation);
 let intent='otro';
 if(action==='informacion')intent='informacion';
 else if(action==='consultar'||action==='agendar')intent='visita';
 else if(/\b(cancel\w*|anul\w*|reprogram\w*)\b/.test(text))intent='otro';
 else if(/\b(agend\w*|reserv\w*|cita\w*|visit\w*|recorrido\w*)\b/.test(text))intent='visita';
 else if(/\b(informacion|inform\w*|detall\w*|precio\w*|costo\w*|cuanto\w*|caracteristic\w*)\b/.test(text))intent='informacion';
 else if(followUp)intent=pendingIntent;
 else if(/\b(propiedad\w*|casa\w*|departamento\w*|inmueble\w*)\b/.test(text))intent='informacion';
 const property=String(data.propiedad||(found&&found.id)||(intent!=='otro'&&intent===pendingIntent&&data.propiedad_pendiente)||'').trim();
 return {intent,property,branch:intent==='otro'?'otro':!property?'falta':intent==='informacion'?'info':'visita'};
}
function run(graph,inputOverride=null,options={}){catalogGraph=options.catalogGraph||graph;const results=Object.create(null);const initialAppointments=structuredClone(options.appointments||[]);const appointments=initialAppointments.slice();const today=options.today||localDate(new Date());const starts=graph.nodes.filter(n=>n.type==='input');let error=null,count=0,inputData=inputOverride,lastData=null,completed=false;
function visit(n,data,path,flow,depth,rootInput){if(depth>12)throw Error('Se excedió el límite de subflujos anidados.');if(path.includes(n.id))throw Error('Hay un ciclo en el flujo. Elimina una conexión para continuar.');let out={...data},branch='next',note='';try{
 if(n.type==='input'){out=rootInput?(inputOverride?{...inputOverride}:JSON.parse(n.data)):{...data};if(!out||typeof out!=='object'||Array.isArray(out))throw Error('La entrada debe ser un objeto JSON.');if(rootInput)inputData=structuredClone(out)}
 else if(n.type==='router'){const result=classify(out);out.intencion=result.intent;out.propiedad=result.property;branch=result.branch;note='Ruta: '+({info:'Información',visita:'Visita',falta:'Falta propiedad',otro:'Otro'}[branch])+'\n'}
 else if(n.type==='subflow'){if(!n.flow||!Array.isArray(n.flow.nodes)||!Array.isArray(n.flow.edges))throw Error('El subflujo no tiene un contenido válido.');const entries=n.flow.nodes.filter(x=>x.type==='input');if(entries.length!==1)throw Error('El subflujo necesita exactamente un bloque de entrada.');const sub=visit(entries[0],out,[],n.flow,depth+1,false);if(!sub.complete)throw Error('El subflujo no llegó a un bloque de salida.');out=sub.data;note='Subflujo completado.\n'}
 else if(n.type==='property'){let list;try{list=JSON.parse(n.catalog)}catch{throw Error('El catálogo de propiedades no es JSON válido.')}if(!Array.isArray(list))throw Error('El catálogo debe ser una lista.');const property=list.find(p=>String(p.id).toLowerCase()===String(out.propiedad||'').trim().toLowerCase());if(!property)throw Error('No se encontró la propiedad. Revisa su identificador.');out.detalle_propiedad=property}
 else if(n.type==='availability'){if(!out.detalle_propiedad)throw Error('Conecta primero un bloque de propiedades.');const date=String(out.fecha||''),time=String(out.hora||''),hours=String(n.hours||'').split(',').map(x=>x.trim()).filter(Boolean);const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);const parsed=match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):null;const valid=parsed&&localDate(parsed)===date&&date>=today&&hours.includes(time);const occupied=appointments.some(a=>a.propiedad===out.detalle_propiedad.id&&a.fecha===date&&a.hora===time);out.disponible=Boolean(valid&&String(out.detalle_propiedad.estado).toLowerCase()==='disponible'&&!occupied);out.motivo_disponibilidad=out.disponible?'Horario disponible':String(out.detalle_propiedad.estado).toLowerCase()!=='disponible'?'La propiedad no está disponible':!date||!time?'Falta indicar fecha y hora':!valid?'Fecha u horario no válido o anterior a hoy':'El horario ya está reservado'}
 else if(n.type==='booking'){if(out.accion==='agendar'||(out.accion==='mensaje'&&out.intencion==='visita')){if(!out.disponible)throw Error('No se puede agendar un horario no disponible.');if(!String(out.cliente||'').trim())throw Error('Escribe el nombre del cliente para agendar.');const existingAppointments=appointments;if(existingAppointments.some(a=>a.propiedad===out.detalle_propiedad.id&&a.fecha===out.fecha&&a.hora===out.hora))throw Error('El horario ya fue reservado.');const appointment={id:options.idFactory?options.idFactory():'CITA-'+Date.now(),propiedad:out.detalle_propiedad.id,nombrePropiedad:out.detalle_propiedad.nombre,fecha:out.fecha,hora:out.hora,cliente:String(out.cliente).trim()};appointments.push(appointment);out.cita=appointment;note='Cita de prueba calculada.\n'}else note='Consulta realizada sin agendar.\n'}
 else if(n.type==='operation'){
  const a=numeric(out[n.field]), b=numeric(valueOf(n.operand,out));
  if(!n.field||!Object.hasOwn(out,n.field)||!Number.isFinite(a)||!Number.isFinite(b)||!n.target?.trim()){
   throw Error('La operación necesita campos numéricos válidos y un nombre de resultado.');
  }
  const value=n.operator==='multiply'?a*b:n.operator==='add'?a+b:a-b;
  if(!Number.isFinite(value))throw Error('El resultado de la operación excede el rango numérico.');
  Object.defineProperty(out,n.target,{value,enumerable:true,configurable:true,writable:true});
 }
 else if(n.type==='condition'){
  if(!Object.hasOwn(out,n.field))throw Error('No existe el campo «'+n.field+'».');
  const a=out[n.field], b=valueOf(n.value,out);
  let yes=String(a)===String(b);
  if(n.comparison!=='eq'){
   const left=numeric(a),right=numeric(b);
   if(!Number.isFinite(left)||!Number.isFinite(right))throw Error('La comparación requiere valores numéricos.');
   yes=n.comparison==='gte'?left>=right:n.comparison==='gt'?left>right:left<right;
  }
  branch=yes?'yes':'no';note='Ruta: '+(yes?'Sí':'No')+'\n';
 }
 else if(n.type==='output'){if(n.message)out.respuesta=n.message;note=(n.message||'')+'\n'}
 results[n.id]={ok:true,text:note+JSON.stringify(out,null,2)};lastData=structuredClone(out);count++;if(n.type==='output')return {data:out,complete:true};const edge=flow.edges.find(e=>e.from===n.id&&e.branch===branch);if(!edge){results[n.id].text+='\n\nNo hay un bloque conectado a esta salida.';return {data:out,complete:false}}const next=flow.nodes.find(x=>x.id===edge.to);if(!next)throw Error('La conexión apunta a un bloque que ya no existe.');return visit(next,out,[...path,n.id],flow,depth,false)
 }catch(err){if(!results[n.id])results[n.id]={ok:false,text:err.message};throw err}}
 try{if(starts.length!==1)throw Error('El flujo necesita exactamente un bloque de entrada.');const run=visit(starts[0],{},[],graph,0,true);lastData=run.data;completed=run.complete}catch(e){error=e.message}return {error,results,output:lastData,completed,input:inputData??starts[0]?.data??null,appointments:completed&&!error?appointments:initialAppointments}}

return {run};
}
