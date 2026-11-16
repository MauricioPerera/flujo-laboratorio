// Shared by case editing, imports, history and the generated test files.
function validCasePath(path){
 return typeof path==='string'&&(path==='$'||path==='$error'||/^[\w-]+(\.[\w-]+)*$/.test(path));
}

function caseValue(output,error,path){
 if(path==='$error')return {found:true,value:error};
 if(path==='$')return {found:true,value:output};
 let value=output;
 for(const part of path.split('.')){
  if(value===null||typeof value!=='object'||!Object.hasOwn(value,part))return {found:false};
  value=value[part];
 }
 return {found:true,value};
}

function jsonEqual(left,right){
 if(Object.is(left,right))return true;
 if(left===null||right===null||typeof left!=='object'||typeof right!=='object')return false;
 if(Array.isArray(left)!==Array.isArray(right))return false;
 if(!Array.isArray(left)&&(Object.prototype.toString.call(left)!=='[object Object]'
  ||Object.prototype.toString.call(right)!=='[object Object]'))return false;
 if(Array.isArray(left)&&left.length!==right.length)return false;
 const keys=Object.keys(left);
 return keys.length===Object.keys(right).length
  &&keys.every(key=>Object.hasOwn(right,key)&&jsonEqual(left[key],right[key]));
}

function assertJsonValue(value){
 const ancestors=new Set();
 function inspect(item){
  if(item===null||typeof item!=='object')return;
  if(ancestors.has(item))throw Error('El dato JSON contiene una referencia circular.');
  ancestors.add(item);
  for(const key of Reflect.ownKeys(item)){
   if(Array.isArray(item)&&key==='length')continue;
   const descriptor=Object.getOwnPropertyDescriptor(item,key);
   if(typeof key!=='string'||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')){
    throw Error('El dato JSON debe contener propiedades de texto enumerables con valores definidos.');
   }
   inspect(descriptor.value);
  }
  ancestors.delete(item);
 }
 inspect(value);
 let decoded;
 try{decoded=JSON.parse(JSON.stringify(value))}
 catch{throw Error('El dato debe poder guardarse como JSON.')}
 if(!jsonEqual(value,decoded))throw Error('El dato debe conservar sus valores y tipos al guardarse como JSON.');
}

function validateCase(test){
 const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 if(!isObject(test)||typeof test.id!=='string'||!test.id||typeof test.name!=='string'||!test.name.trim()){
  throw Error('El caso necesita un identificador y un nombre.');
 }
 if(!isObject(test.input))throw Error('La entrada debe ser un objeto JSON.');
 if(!isObject(test.expected)||!validCasePath(test.expected.path)||!Object.prototype.propertyIsEnumerable.call(test.expected,'value')){
  throw Error('Usa un campo como cita.cliente, $ o $error y define el valor esperado.');
 }
 const {today,appointments}=test.fixture||{};
 if(typeof today!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(today)
  ||!Number.isFinite(Date.parse(today+'T00:00:00Z'))
  ||new Date(today+'T00:00:00Z').toISOString().slice(0,10)!==today){
  throw Error('Selecciona una fecha simulada válida.');
 }
 if(!Array.isArray(appointments)||!appointments.every(isObject)){
  throw Error('Las citas simuladas deben ser una lista de objetos.');
 }
 assertJsonValue(test);
}

function encodeTestContract(contract){
 contract.cases.forEach(validateCase);
 const serialized=JSON.stringify(contract);
 JSON.parse(serialized).cases.forEach(validateCase);
 return JSON.stringify(serialized);
}

const MAX_SPEC_CASES=500;
const MAX_SPEC_BYTES=5*1024*1024;
