const { createHash, randomUUID } = require('node:crypto');
const { closeSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { compileFunction, createContext } = require('node:vm');
const { appendHistory, revertHistoryChange } = require('./historial-proyecto.cjs');

const tag = /^<script id="projectData" type="application\/json">([\s\S]*?)<\/script>/gm;
const enginePath = join(__dirname, '..', 'dist', 'prototipo-proyecto.html');
const engineRegion = /\/\/ BEGIN SHARED SIMULATION\r?\n([\s\S]+?)\/\/ END SHARED SIMULATION/;
const nodeKinds = new Set(['input', 'output', 'condition', 'switch', 'operation', 'subflow', 'wait', 'custom']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isName = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => createHash('sha256').update(value).digest('hex');

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function indexItems(items, label) {
  requireValue(Array.isArray(items), label + ' debe ser una lista.');
  const ids = new Set();
  for (const item of items) {
    requireValue(isObject(item) && isName(item.id), label + ' contiene un elemento sin identificador.');
    requireValue(!ids.has(item.id), label + ' contiene un identificador duplicado: ' + item.id);
    ids.add(item.id);
  }
  return ids;
}

function validateGraph(graph, label, blocks, subflows) {
  const ids = indexItems(graph.nodes, 'Bloques de ' + label);
  requireValue(Array.isArray(graph.edges), 'Faltan las conexiones de ' + label + '.');
  for (const edge of graph.edges) {
    requireValue(isObject(edge) && ids.has(edge.from) && ids.has(edge.to) && isName(edge.when),
      'Conexión inválida en ' + label + '.');
  }
  const { duplicateEdge, messageContractError } = simulationEngine();
  const duplicate = duplicateEdge(graph.edges);
  requireValue(!duplicate, duplicate && `El bloque «${duplicate.from}» tiene más de una conexión para la ruta «${duplicate.when}» en ${label}.`);
  for (const node of graph.nodes) {
    requireValue(nodeKinds.has(node.kind) && isName(node.title), 'Bloque inválido en ' + label + ': ' + node.id);
    requireValue(node.kind !== 'custom' || blocks.has(node.blockId), 'Falta la definición del bloque ' + node.id + '.');
    requireValue(node.kind !== 'subflow' || isName(node.subflowId), 'Falta el subflujo del bloque ' + node.id + '.');
    requireValue(node.subflowId === undefined || subflows.has(node.subflowId), 'Subflujo desconocido en ' + node.id + '.');
    if (node.kind === 'input' || node.kind === 'wait') {
      const error = messageContractError(node);
      requireValue(!error, `Contrato de «${node.title}» en ${label}: ${error}`);
    }
  }
  requireValue(graph.cases === undefined || Array.isArray(graph.cases), 'Casos inválidos en ' + label + '.');
}

function validateProject(project) {
  requireValue(isObject(project) && isName(project.id) && isName(project.name) && Number.isInteger(project.version),
    'El documento debe contener el identificador, nombre y versión del proyecto.');
  requireValue(Array.isArray(project.cases), 'El proyecto debe contener una lista de casos.');
  const blocks = indexItems(project.blockDefinitions, 'Biblioteca');
  const subflows = indexItems(project.subflows, 'Subflujos');
  indexItems(project.flows ?? [], 'Flujos');
  validateGraph(project, project.flowName || 'Flujo principal', blocks, subflows);
  for (const flow of project.flows ?? []) {
    requireValue(isName(flow.name), 'Falta el nombre del flujo ' + flow.id + '.');
    validateGraph(flow, flow.name, blocks, subflows);
  }
  for (const flow of project.subflows) {
    requireValue(isName(flow.name), 'Falta el nombre del subflujo ' + flow.id + '.');
    if (flow.graph !== undefined) {
      requireValue(isObject(flow.graph), 'Lienzo inválido en ' + flow.name + '.');
      validateGraph(flow.graph, flow.name, blocks, subflows);
    }
  }
}

function readHtml(file) {
  const bytes = readFileSync(file);
  const source = bytes.toString('utf8');
  const matches = [...source.matchAll(tag)];
  requireValue(matches.length === 1, 'Se esperaba un HTML de Flujo con un único bloque projectData.');
  const [element, data] = matches[0];
  const project = JSON.parse(data);
  return { source, element, project, revision: hash(bytes) };
}

function readJson(file) {
  return JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8').replace(/^\uFEFF/, ''));
}

function renderHtml(template, project) {
  const content = JSON.stringify(project).replace(/</g, '\\u003c');
  const nextTag = '<script id="projectData" type="application/json">' + content + '</script>';
  return template.source.replace(template.element, () => nextTag);
}

function requireRevision(current, expected) {
  if (current !== expected) {
    throw Object.assign(new Error('El HTML cambió desde la lectura. Vuelve a leerlo antes de guardar.'), { code: 'REVISION_CONFLICT' });
  }
}

function writeHtml(file, snapshot, edit, outputFile, { template = snapshot, source = 'terminal', historyAction } = {}) {
  requireRevision(snapshot.revision, edit?.revision);
  validateProject(edit.project);
  requireValue(edit.project.id === snapshot.project.id && edit.project.version === snapshot.project.version,
    'La edición debe conservar el identificador y la versión del proyecto.');

  const project = { ...appendHistory(snapshot.project, edit.project, edit.author, source, historyAction), storageRevision: randomUUID() };
  const next = renderHtml(template, project);
  const output = resolve(outputFile ?? file);
  if (outputFile) {
    requireValue(output !== resolve(file), 'Para editar el archivo original, omite la ruta de salida.');
    writeFileSync(output, next, { flag: 'wx' });
  } else {
    const lockPath = output + '.lock';
    const lock = openSync(lockPath, 'wx');
    const temp = output + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(temp, next, { flag: 'wx' });
      requireRevision(hash(readFileSync(output)), snapshot.revision);
      renameSync(temp, output);
    } finally {
      closeSync(lock);
      unlinkSync(lockPath);
      try { unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return { archivo: output, revision: hash(next), proyecto: project.name };
}

function applyHistoryHtml(file, snapshot, request, { source = 'terminal', redo = false } = {}) {
  requireRevision(snapshot.revision, request?.revision);
  const { entryId, changeIndex, author } = request;
  const project = revertHistoryChange(snapshot.project, entryId, changeIndex, { redo });
  const reference = { entryId, changeIndex };
  return writeHtml(file, snapshot, { revision: request.revision, project, author }, undefined,
    { source, historyAction: redo ? { redoes: reference } : { reverts: reference } });
}

let engine;
function simulationEngine() {
  if (engine) return engine;
  const core = readFileSync(enginePath, 'utf8').match(engineRegion);
  requireValue(core, 'Falta el motor compartido del editor local.');
  const createEngine = compileFunction(core[1] + '\nreturn {simulateGraph,starterGraph,duplicateEdge,messageContractError};', [], {
    filename: enginePath,
    parsingContext: createContext({ structuredClone })
  });
  engine = createEngine();
  return engine;
}

function runHtml(project, request) {
  validateProject(project);
  requireValue(isObject(request) && isObject(request.input), 'La ejecución requiere un objeto input.');
  requireValue(request.messages === undefined || Array.isArray(request.messages) && request.messages.every(isObject),
    'messages debe ser una lista de objetos.');
  requireValue(request.subflowResults === undefined || isObject(request.subflowResults),
    'subflowResults debe ser un objeto.');
  const flow = request.flowId === undefined ? project : project.flows?.find(item => item.id === request.flowId);
  requireValue(flow, 'Flujo desconocido: ' + request.flowId);
  const model = { ...project, nodes: flow.nodes, edges: flow.edges, requestDemo: flow === project && project.id === 'solicitudes-demo' };
  const subflow = request.subflowId === undefined ? null : project.subflows.find(item => item.id === request.subflowId);
  requireValue(subflow || request.subflowId === undefined, 'Subflujo desconocido: ' + request.subflowId);

  const {simulateGraph, starterGraph} = simulationEngine();
  const graph = subflow ? subflow.graph ?? starterGraph(subflow, {}, model) : flow;
  return simulateGraph(graph, subflow, request.input, model, request.messages, request.subflowResults);
}

async function main(args) {
  const [command, file, json, output] = args;
  requireValue(file && (
    command === 'leer' && (args.length === 2 || args.length === 3) ||
    command === 'guardar' && (args.length === 3 || args.length === 4) ||
    (command === 'revertir' || command === 'rehacer') && args.length === 3 ||
    command === 'actualizar-visor' && args.length === 3 ||
    command === 'previsualizar' && (args.length === 2 || args.length === 3 && json === '--sin-abrir') ||
    command === 'ejecutar' && args.length === 3
  ), 'Uso: proyecto-html.cjs leer HTML [SALIDA.json] | guardar HTML JSON [COPIA.html] | revertir HTML SOLICITUD.json | rehacer HTML SOLICITUD.json | actualizar-visor HTML COPIA.html | ejecutar HTML SOLICITUD.json | previsualizar HTML [--sin-abrir]');
  if (command === 'previsualizar') {
    return require('./vista-proyecto.cjs').launchPreview(resolve(file), json !== '--sin-abrir');
  }
  const snapshot = readHtml(file);
  if (command === 'leer') {
    const data = { revision: snapshot.revision, project: snapshot.project };
    if (!json) return data;
    const destination = resolve(json);
    writeFileSync(destination, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    return { archivo: destination, revision: snapshot.revision };
  }
  if (command === 'guardar') return writeHtml(file, snapshot, readJson(json), output);
  if (command === 'revertir' || command === 'rehacer') {
    return applyHistoryHtml(file, snapshot, readJson(json), { redo: command === 'rehacer' });
  }
  if (command === 'actualizar-visor') {
    return writeHtml(file, snapshot, { revision: snapshot.revision, project: snapshot.project }, json, { template: readHtml(enginePath) });
  }
  return runHtml(snapshot.project, readJson(json));
}

module.exports = { readHtml, validateProject, renderHtml, writeHtml, applyHistoryHtml, enginePath };

if (require.main === module) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
