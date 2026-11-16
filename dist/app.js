const $ = s => document.querySelector(s);
const types = {
 subflow:{label:'Subflujo',icon:'▤',description:'Desglosa un proceso',title:'Nuevo subflujo'},
 router:{label:'Intención',icon:'⇄',description:'Clasifica la solicitud',title:'Identificar intención'},
 input:{label:'Entrada',icon:'↘',description:'Datos para empezar',title:'Datos de entrada'},
 operation:{label:'Operación',icon:'✳',description:'Transforma los datos',title:'Calcular valor'},
 condition:{label:'Decisión',icon:'◇',description:'Divide el camino',title:'Evaluar condición'},
 property:{label:'Propiedades',icon:'⌂',description:'Consulta el catálogo',title:'Buscar propiedad'},
 availability:{label:'Disponibilidad',icon:'◷',description:'Revisa los horarios',title:'Verificar disponibilidad'},
 booking:{label:'Cita',icon:'▣',description:'Registra una visita',title:'Agendar visita'},
 output:{label:'Resultado',icon:'◎',description:'Muestra el resultado',title:'Mostrar resultado'}
};
const catalog = [
 {id:'CASA-01',nombre:'Casa Arboleda',zona:'Coyoacán, CDMX',precio:'$4,850,000 MXN',descripcion:'3 recámaras · 2 baños · 180 m²',estado:'disponible'},
 {id:'DEPTO-02',nombre:'Departamento Roma',zona:'Roma Norte, CDMX',precio:'$3,650,000 MXN',descripcion:'2 recámaras · 2 baños · 95 m²',estado:'disponible'},
 {id:'CASA-03',nombre:'Casa del Lago',zona:'Querétaro, Qro.',precio:'$5,200,000 MXN',descripcion:'4 recámaras · 3 baños · 240 m²',estado:'no disponible'}
];
function localDate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function nextDate(){const d=new Date();d.setDate(d.getDate()+1);return localDate(d)}
const example = {nodes:[
 {id:'n1',type:'input',x:40,y:190,title:'Solicitud del cliente',data:JSON.stringify({propiedad:'CASA-01',fecha:nextDate(),hora:'10:00',cliente:'Ana García',accion:'consultar'},null,2)},
 {id:'n2',type:'property',x:275,y:190,title:'Buscar propiedad',catalog:JSON.stringify(catalog,null,2)},
 {id:'n3',type:'availability',x:510,y:190,title:'Revisar disponibilidad',hours:'10:00, 12:00, 16:00'},
 {id:'n4',type:'condition',x:745,y:190,title:'¿Está disponible?',field:'disponible',comparison:'eq',value:'true'},
 {id:'n5',type:'booking',x:980,y:90,title:'Agendar visita'},
 {id:'n6',type:'output',x:1215,y:90,title:'Responder al cliente',message:'Consulta completada.'},
 {id:'n7',type:'output',x:980,y:330,title:'Ofrecer otro horario',message:'Esta propiedad o este horario no está disponible. Prueba otra opción.'}
],edges:[{from:'n1',to:'n2',branch:'next'},{from:'n2',to:'n3',branch:'next'},{from:'n3',to:'n4',branch:'next'},{from:'n4',to:'n5',branch:'yes'},{from:'n5',to:'n6',branch:'next'},{from:'n4',to:'n7',branch:'no'}]};
let state; try { state=JSON.parse(localStorage.getItem('flujo-inmobiliaria-v1')) || structuredClone(example); if(!Array.isArray(state.nodes)||!Array.isArray(state.edges)) throw 0; } catch {state=structuredClone(example)}
let selected=state.nodes[0]?.id||null, pending=null, results={}, zoom=1, drag=null;
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let persist=()=>{try{localStorage.setItem('flujo-inmobiliaria-v1',JSON.stringify(state))}catch{toast('No se pudo guardar en este navegador.')}};
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3000)}
function nodeSummary(n){if(n.type==='input')return n.data;if(n.type==='operation')return `${n.target||'resultado'} = ${n.field||'campo'} ${n.operator==='multiply'?'×':n.operator==='add'?'+':'−'} ${n.operand||'valor'}`;if(n.type==='subflow')return 'Abrir para ver el detalle del proceso';if(n.type==='router')return 'Información · visita · falta propiedad · otro';if(n.type==='property')return 'Busca la propiedad solicitada en el catálogo';if(n.type==='availability')return 'Horarios: '+n.hours;if(n.type==='booking')return 'Registra la visita si el cliente lo solicita';if(n.type==='condition')return `${n.field||'campo'} ${n.comparison==='gte'?'≥':n.comparison==='gt'?'>':n.comparison==='lt'?'<':'='} ${n.value}`;return n.message||'Muestra los datos finales'}
const branchLabels={info:'Información',visita:'Visita',falta:'Sin propiedad',otro:'Otro',yes:'Sí',no:'No'};
function renderOutputs(node){
 if(node.type==='output')return '';
 const branches=node.type==='router'?['info','visita','falta','otro']:node.type==='condition'?['yes','no']:[];
 if(!branches.length)return `<div class="port out ${pending?.id===node.id?'pending':''}" data-port="next" title="Salida"></div>`;
 return `<div class="route-rail">${branches.map(branch=>{
  const label=branchLabels[branch],active=pending?.id===node.id&&pending.branch===branch;
  return `<div class="route-row" data-branch="${branch}"><span class="port-tag">${label}</span><div class="port out ${active?'pending':''}" data-port="${branch}" title="Salida ${label}"></div></div>`;
 }).join('')}</div>`;
}
function draw(){
 $('#nodeCount').textContent=`${state.nodes.length} bloques`;
 $('#nodes').innerHTML=state.nodes.map(n=>{const t=types[n.type];if(!t)return '';return `<div class="node ${n.type} ${selected===n.id?'selected':''} ${results[n.id]?.ok?'running':''}" data-id="${esc(n.id)}" style="left:${Number(n.x)}px;top:${Number(n.y)}px"><div class="port in" data-port="in" title="Entrada"></div><div class="node-head"><span class="block-icon">${t.icon}</span><div><div class="node-type">${t.label}</div><div class="node-title">${esc(n.title)}</div></div></div><div class="node-body">${esc(nodeSummary(n))}</div><div class="node-footer">${results[n.id]?(results[n.id].ok?'✓ Ejecutado':'! Error'):'●  Listo para configurar'}${n.type==='subflow'?'<button class="quick-open" title="Abrir subflujo">Abrir ↗</button>':''}</div>${renderOutputs(n)}</div>`}).join('');
 drawEdges();
}
function drawEdges(){
 const svg=$('#edges');
 const status=$('#routingStatus');
 const nodes=new Map([...$('#nodes').querySelectorAll('.node')].map(element=>[element.dataset.id,element]));
 if(!nodes.size){svg.innerHTML='';status.hidden=true;return;}
 const frame=svg.getBoundingClientRect();
 const coordinate=(value,origin)=>Math.round((value-origin)/zoom*10)/10;
 const boxes=[...nodes].map(([id,node])=>{
  const rect=node.getBoundingClientRect();
  return {id,left:coordinate(rect.left,frame.left),right:coordinate(rect.right,frame.left),
   top:coordinate(rect.top,frame.top),bottom:coordinate(rect.bottom,frame.top)};
 });
 function portCenter(port){
  const rect=port.getBoundingClientRect();
  return [coordinate(rect.left+rect.width/2,frame.left),coordinate(rect.top+rect.height/2,frame.top)];
 }
 const connections=[];
 for(const [index,edge] of state.edges.entries()){
  const source=nodes.get(edge.from),target=nodes.get(edge.to);
  if(!source||!target)continue;
  const output=[...source.querySelectorAll('.port.out')].find(port=>port.dataset.port===edge.branch);
  const input=target.querySelector('.port.in');
  if(!output||!input)continue;
  const from=portCenter(output),to=portCenter(input);
  connections.push({...edge,index,ports:[from,to],terminals:[[from[0]+13,from[1]],[to[0]-13,to[1]]],returning:false});
 }
 const {routes,crossings,obstructed,conflicts}=flowRouting.routeConnections(boxes,connections);
 svg.innerHTML=routes.map(({index,branch,points})=>{
  const d=points.map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' ');
  const warning=conflicts.has(index)?' edge-conflict':'';
  return `<path class="edge-path${warning}" data-connection="${index}" data-branch="${esc(branch)}" d="${d}"/>`;
 }).join('');
 const warnings=[];
 if(crossings)warnings.push(`${crossings} ${crossings===1?'par de líneas se toca o se superpone':'pares de líneas se tocan o se superponen'}`);
 if(obstructed)warnings.push(`${obstructed} ${obstructed===1?'línea atraviesa':'líneas atraviesan'} bloques`);
 const message=warnings.join(' · ');
 if(status.textContent!==message)status.textContent=message;
 status.hidden=!message;
}
function field(label,key,value,options={}){const control=options.textarea?`<textarea data-key="${key}" spellcheck="false">${esc(value)}</textarea>`:options.choices?`<select data-key="${key}">${options.choices.map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('')}</select>`:`<input data-key="${key}" value="${esc(value)}">`;return `<label class="field"><span>${label}</span>${control}${options.hint?`<small>${options.hint}</small>`:''}</label>`}
function renderDetails(){const n=state.nodes.find(x=>x.id===selected);if(!n){$('#details').innerHTML='<div class="empty-details"><span>✳</span>Selecciona un bloque para ver sus detalles.</div>';return}const t=types[n.type];let fields=field('Nombre del bloque','title',n.title);
 if(n.type==='input')fields+=field('Datos de entrada (JSON)','data',n.data,{textarea:true,hint:'Introduce un objeto JSON. Sus campos estarán disponibles en los siguientes bloques.'});
 if(n.type==='operation')fields+=field('Campo de origen','field',n.field,{hint:'Nombre del campo que contiene el primer número.'})+field('Operación','operator',n.operator,{choices:[['multiply','Multiplicar ×'],['add','Sumar +'],['subtract','Restar −']]})+field('Segundo valor o campo','operand',n.operand,{hint:'Escribe un número o el nombre de otro campo.'})+field('Guardar resultado en','target',n.target);
 if(n.type==='condition')fields+=field('Campo a evaluar','field',n.field)+field('Condición','comparison',n.comparison,{choices:[['gte','Es mayor o igual que'],['gt','Es mayor que'],['lt','Es menor que'],['eq','Es igual a']]})+field('Valor de comparación','value',n.value,{hint:'El flujo seguirá la salida Sí o No según el resultado.'});
 if(n.type==='property')fields+=field('Catálogo de propiedades (JSON)','catalog',n.catalog,{textarea:true,hint:'Lista editable de propiedades de ejemplo. Cada una necesita id, nombre y estado.'});
 if(n.type==='availability')fields+=field('Horarios disponibles','hours',n.hours,{hint:'Horas en formato HH:MM separadas por comas. Las citas registradas ocupan su horario.'});
 if(n.type==='booking')fields+='<p class="detail-note">Las citas de prueba se guardan solo en este navegador. No se envían a un calendario real.</p>';
 if(n.type==='output')fields+=field('Mensaje','message',n.message,{textarea:true,hint:'Este mensaje aparecerá junto a los datos recibidos.'});
 const r=results[n.id];let result=r?`<div class="result-box ${r.ok?'success':'error'}">${esc(r.text)}</div>`:'<div class="result-box">Ejecuta el flujo para ver los datos de este bloque.</div>';
 $('#details').innerHTML=`<div class="details-inner"><div class="detail-title ${n.type}"><span class="block-icon">${t.icon}</span><div><h2>${esc(n.title)}</h2><p>${t.label} · Configuración</p></div></div><div class="detail-divider"></div><div class="section-label">CONFIGURACIÓN</div>${fields}<div class="detail-divider"></div><div class="section-label">RESULTADO DE EJECUCIÓN</div>${result}<button class="delete-button" id="deleteNode">Eliminar bloque</button></div>`;
 $('#details').querySelectorAll('[data-key]').forEach(el=>el.addEventListener('input',()=>{n[el.dataset.key]=el.value;results={};persist();draw()}));$('#deleteNode').onclick=()=>{state.nodes=state.nodes.filter(x=>x.id!==n.id);state.edges=state.edges.filter(e=>e.from!==n.id&&e.to!==n.id);selected=null;results={};pending=null;persist();draw();renderDetails();toast('Bloque eliminado')};
}
$('#palette').innerHTML=Object.entries(types).map(([id,t])=>`<button class="${id}" data-type="${id}"><span class="block-icon">${t.icon}</span><div><b>${t.label}</b><small>${t.description}</small></div></button>`).join('');
$('#palette').onclick=e=>{const b=e.target.closest('[data-type]');if(!b)return;const type=b.dataset.type,index=state.nodes.length,n={id:'n'+Date.now()+Math.floor(Math.random()*1000),type,x:Math.min(1350,80+(index%6)*210),y:100+(index%3)*140,title:types[type].title};Object.assign(n,type==='input'?{data:'{"valor": 10}'}:type==='operation'?{field:'valor',operator:'multiply',operand:'2',target:'resultado'}:type==='condition'?{field:'valor',comparison:'gte',value:'10'}:type==='property'?{catalog:JSON.stringify(catalog,null,2)}:type==='availability'?{hours:'10:00, 12:00, 16:00'}:type==='booking'?{}:type==='router'?{}:type==='subflow'?{flow:createBlankSubflow()}:{message:'Resultado del flujo'});state.nodes.push(n);selected=n.id;results={};persist();draw();renderDetails();$('#viewport').scrollTo({left:n.x*zoom-100,top:n.y*zoom-80,behavior:'smooth'});$('.inspector').classList.remove('collapsed');toast('Bloque agregado. Conecta los puntos para crear un recorrido.')};
$('#nodes').addEventListener('pointerdown',e=>{const node=e.target.closest('.node');if(!node)return;const n=state.nodes.find(x=>x.id===node.dataset.id);const port=e.target.closest('[data-port]');if(port){e.stopPropagation();if(port.dataset.port==='in'){if(!pending){toast('Primero selecciona un punto de salida.');return}if(pending.id===n.id){toast('Un bloque no puede conectarse consigo mismo.');return}if(n.type==='input'){toast('Los bloques de entrada inician el flujo y no reciben conexiones.');return}if(state.edges.some(x=>x.to===n.id&&x.from!==pending.id)){toast('Cada bloque admite una sola conexión de entrada.');return}state.edges=state.edges.filter(x=>!(x.from===pending.id&&x.branch===pending.branch)&&x.to!==n.id);state.edges.push({from:pending.id,to:n.id,branch:pending.branch});pending=null;results={};persist();draw();renderDetails();toast('Bloques conectados')}else{pending={id:n.id,branch:port.dataset.port};draw();toast('Ahora selecciona el punto de entrada de otro bloque.')}return}
 selected=n.id;$('.inspector').classList.remove('collapsed');draw();renderDetails();drag={id:n.id,startX:e.clientX,startY:e.clientY,x:n.x,y:n.y};e.preventDefault()});
window.addEventListener('pointermove',e=>{if(!drag)return;const n=state.nodes.find(x=>x.id===drag.id);if(!n)return;n.x=Math.max(0,Math.min(1430,drag.x+(e.clientX-drag.startX)/zoom));n.y=Math.max(0,Math.min(560,drag.y+(e.clientY-drag.startY)/zoom));const el=document.querySelector(`.node[data-id="${n.id}"]`);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px';drawEdges()}});window.addEventListener('pointerup',()=>{if(drag){persist();drag=null}});
function valueOf(input,data){const v=String(input??'').trim();if(Object.prototype.hasOwnProperty.call(data,v))return data[v];if(v!==''&&Number.isFinite(Number(v)))return Number(v);return v}
function getAppointments(){
 const list=readLocal('flujo-citas-demo:'+flowStorageScope(),[]);
 return Array.isArray(list)?list:[];
}
function saveAppointments(list){
 localStorage.setItem('flujo-citas-demo:'+flowStorageScope(),JSON.stringify(list));
}
function execute(inputOverride=null){results={};const starts=state.nodes.filter(n=>n.type==='input');if(starts.length!==1){const error='El flujo necesita exactamente un bloque de entrada.';toast(error);recordExecution({error,input:inputOverride,output:null,steps:{},completed:false});return {error,results}}let error=null,count=0,inputData=inputOverride,lastData=null,completed=false;function visit(n,data,stack){if(stack.includes(n.id)){throw new Error('Hay un ciclo en el flujo. Elimina una conexión para continuar.')}let out={...data},branch='next',note='';try{if(n.type==='input'){out=inputOverride ? {...inputOverride} : JSON.parse(n.data);if(!out||typeof out!=='object'||Array.isArray(out))throw Error('La entrada debe ser un objeto JSON.')}else if(n.type==='property'){let list;try{list=JSON.parse(n.catalog)}catch{throw Error('El catálogo de propiedades no es JSON válido.')}if(!Array.isArray(list))throw Error('El catálogo debe ser una lista.');const property=list.find(p=>String(p.id).toLowerCase()===String(out.propiedad||'').trim().toLowerCase());if(!property)throw Error('No se encontró la propiedad. Revisa su identificador.');out.detalle_propiedad=property;
 }else if(n.type==='availability'){if(!out.detalle_propiedad)throw Error('Conecta primero un bloque de propiedades.');const date=String(out.fecha||''),time=String(out.hora||''),hours=String(n.hours||'').split(',').map(x=>x.trim()).filter(Boolean);const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);const parsed=match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):null;const valid=parsed&&localDate(parsed)===date&&date>=localDate(new Date())&&hours.includes(time);const occupied=getAppointments().some(a=>a.propiedad===out.detalle_propiedad.id&&a.fecha===date&&a.hora===time);out.disponible=Boolean(valid&&String(out.detalle_propiedad.estado).toLowerCase()==='disponible'&&!occupied);out.motivo_disponibilidad=out.disponible?'Horario disponible':String(out.detalle_propiedad.estado).toLowerCase()!=='disponible'?'La propiedad no está disponible':!valid?'Fecha u horario no válido o anterior a hoy':'El horario ya está reservado';
 }else if(n.type==='booking'){if(out.accion==='agendar'){if(!out.disponible)throw Error('No se puede agendar un horario no disponible.');if(!String(out.cliente||'').trim())throw Error('Escribe el nombre del cliente para agendar.');const appointments=getAppointments();if(appointments.some(a=>a.propiedad===out.detalle_propiedad.id&&a.fecha===out.fecha&&a.hora===out.hora))throw Error('El horario ya fue reservado.');const appointment={id:'CITA-'+Date.now(),propiedad:out.detalle_propiedad.id,nombrePropiedad:out.detalle_propiedad.nombre,fecha:out.fecha,hora:out.hora,cliente:String(out.cliente).trim()};appointments.push(appointment);saveAppointments(appointments);out.cita=appointment;note='Cita de prueba registrada en este navegador.\n'}else note='Consulta realizada sin agendar.\n';
 }else if(n.type==='operation'){const a=Number(out[n.field]),b=Number(valueOf(n.operand,out));if(!n.field||!Object.prototype.hasOwnProperty.call(out,n.field)||!Number.isFinite(a)||!Number.isFinite(b)||!n.target.trim())throw Error('La operación necesita campos numéricos válidos y un nombre de resultado.');out[n.target]=n.operator==='multiply'?a*b:n.operator==='add'?a+b:a-b}else if(n.type==='condition'){if(!Object.prototype.hasOwnProperty.call(out,n.field))throw Error(`No existe el campo «${n.field}».`);const a=out[n.field],b=valueOf(n.value,out);let yes=n.comparison==='gte'?Number(a)>=Number(b):n.comparison==='gt'?Number(a)>Number(b):n.comparison==='lt'?Number(a)<Number(b):String(a)===String(b);if(n.comparison!=='eq'&&(!Number.isFinite(Number(a))||!Number.isFinite(Number(b))))throw Error('La comparación requiere valores numéricos.');branch=yes?'yes':'no';note=`Ruta: ${yes?'Sí':'No'}\n`}else if(n.type==='output')note=n.message+'\n\n';results[n.id]={ok:true,text:note+JSON.stringify(out,null,2)};if(n.type==='input')inputData=structuredClone(out);lastData=structuredClone(out);count++;if(n.type==='output'||(n.type==='property'&&out.accion==='informacion'))completed=true;if(n.type==='property'&&out.accion==='informacion')return;const edge=state.edges.find(e=>e.from===n.id&&e.branch===branch);if(edge){const next=state.nodes.find(x=>x.id===edge.to);if(next)visit(next,out,[...stack,n.id])}else if(n.type!=='output'){results[n.id].text+='\n\nNo hay un bloque conectado a esta salida.'}}catch(err){if(!results[n.id])results[n.id]={ok:false,text:err.message};throw err}}
 try{visit(starts[0],{},[])}catch(e){error=e.message}recordExecution({error,input:inputData??starts[0]?.data??null,output:lastData,steps:results,completed});draw();renderDetails();toast(error?`No se pudo completar: ${error}`:`Ejecución terminada · ${count} bloques recorridos`);return {error,results}}
$('#run').onclick=()=>execute();$('#reset').onclick=()=>{if(!confirm('¿Restaurar el ejemplo? Se reemplazará el flujo guardado en este navegador.'))return;state=structuredClone(example);results={};selected='n1';pending=null;persist();draw();renderDetails();toast('Ejemplo restaurado')};$('#clearResults').onclick=()=>{results={};draw();renderDetails();toast('Resultados limpiados')};
function setZoom(value){
 zoom=Math.max(.6,Math.min(1.3,value));
 $('#canvas').style.transform=`scale(${zoom})`;
 $('#zoomLevel').textContent=Math.round(zoom*100)+'%';
 drawEdges();
}
$('#zoomIn').onclick=()=>setZoom(zoom+.1);
$('#zoomOut').onclick=()=>setZoom(zoom-.1);
$('#fit').onclick=()=>{setZoom(1);$('#viewport').scrollTo({top:0,left:0,behavior:'smooth'})};
if(typeof ResizeObserver==='function'){
 const viewport=$('#viewport'),workarea=$('.workarea');
 const canvasResize=new ResizeObserver(()=>{
  workarea.style.setProperty('--inspector-top',`${viewport.offsetTop}px`);
  drawEdges();
 });
 canvasResize.observe(viewport);
 canvasResize.observe($('.canvas-toolbar'));
}
$('#help').onclick=()=>$('#modal').classList.remove('hidden');$('#closeModal').onclick=$('#gotIt').onclick=()=>$('#modal').classList.add('hidden');$('#modal').onclick=e=>{if(e.target.id==='modal')e.currentTarget.classList.add('hidden')};$('#closeInspector').onclick=()=>{selected=null;renderDetails();if(innerWidth<=760)$('.inspector').classList.add('collapsed');draw()};
function currentCatalog(){const node=state.nodes.find(n=>n.type==='property');if(!node)throw Error('Agrega un bloque de propiedades al flujo.');let list;try{list=JSON.parse(node.catalog)}catch{throw Error('El catálogo no es JSON válido.')}if(!Array.isArray(list))throw Error('El catálogo debe ser una lista.');return list}
draw();renderDetails();if (document.querySelector('#viewport').clientWidth < 700) setZoom(.7);

