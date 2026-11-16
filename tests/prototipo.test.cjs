const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'dist', 'prototipo-proyecto.html'), 'utf8');
test('the standalone HTML embeds the same routing code used by the main editor', () => {
  const source = readFileSync(join(__dirname, '..', 'dist', 'routing.js'), 'utf8');
  const standalone = html.match(/\/\/ BEGIN EMBEDDED ROUTING\r?\n([\s\S]*?)\/\/ END EMBEDDED ROUTING/);
  const shared = source.match(/const flowRouting = \(\(\) => \{\r?\n([\s\S]*?)return \{routeConnections\};/);
  assert.ok(standalone && shared);
  assert.equal(standalone[1].replaceAll('\r\n', '\n'), shared[1].replaceAll('\r\n', '\n'));
});

test('the HTML project CLI edits the embedded model and runs the editor simulator offline', t => {
  const folder = mkdtempSync(join(tmpdir(), 'flujo-html-'));
  t.after(() => {
    for (const file of readdirSync(folder)) unlinkSync(join(folder, file));
    rmdirSync(folder);
  });
  const original = join(folder, 'proyecto.html');
  const updated = join(folder, 'revisado.html');
  const draft = join(folder, 'edición.json');
  writeFileSync(original, html);
  const cli = join(__dirname, '..', 'scripts', 'proyecto-html.cjs');
  const call = (args, input) => spawnSync(process.execPath, [cli, ...args], {
    input: input === undefined ? undefined : JSON.stringify(input),
    encoding: 'utf8'
  });
  const json = (args, input) => {
    const result = call(args, input);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };

  const extract = json(['leer', original, draft]);
  const edit = JSON.parse(readFileSync(draft, 'utf8'));
  assert.equal(extract.revision, edit.revision);
  assert.deepEqual(edit, json(['leer', original]));
  assert.equal(call(['leer', original, draft]).status, 1);
  const message = 'Resultado revisado </script>';
  edit.project.nodes.find(node => node.id === 'n-not-found').message = message;
  json(['guardar', original, '-', updated], edit);
  assert.equal(readFileSync(original, 'utf8'), html);
  const saved = json(['leer', updated]);
  assert.notEqual(saved.revision, edit.revision);
  assert.ok(saved.project.storageRevision);
  const outsideData = source => source.replace(/^<script id="projectData" type="application\/json">.*<\/script>/m, '');
  assert.equal(outsideData(readFileSync(updated, 'utf8')), outsideData(html));

  const input = { clienteId: 'CLI-88', idSolicitud: 'REQ-404' };
  const result = json(['ejecutar', updated, '-'], { input });
  assert.equal(result.output.flowData.respuesta, message);
  assert.ok(result.subflows.some(flow => flow.visited.includes('Solicitud no encontrada')));
  const viewer = boot(readFileSync(updated, 'utf8'));
  const viewerResult = JSON.parse(JSON.stringify(viewer.run(`window.__prototypeTestApi.simulate(${JSON.stringify(input)})`)));
  assert.deepEqual(result, viewerResult);

  const stale = call(['guardar', updated, '-'], edit);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /cambió desde la lectura/);
  const badEdit = structuredClone(saved);
  badEdit.project.edges[0].to = 'bloque-inexistente';
  const invalid = call(['guardar', updated, '-'], badEdit);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Conexión inválida/);
  const brokenContract = structuredClone(saved);
  const inputNode = brokenContract.project.nodes.find(node => node.kind === 'input');
  inputNode.requiredFields = {};
  assert.match(call(['guardar', updated, '-'], brokenContract).stderr, /campos obligatorios como una lista/);
  inputNode.requiredFields = ['idSolicitud'];
  inputNode.allowAdditional = 'false';
  assert.match(call(['guardar', updated, '-'], brokenContract).stderr, /true o false/);
  const ambiguous = structuredClone(saved);
  ambiguous.project.edges.push({ ...ambiguous.project.edges[0], to: 'n-count' });
  assert.match(call(['guardar', updated, '-'], ambiguous).stderr, /más de una conexión para la ruta «next»/);
  assert.equal(json(['leer', updated]).revision, saved.revision);
  saved.project.description = 'Edición en el archivo original.';
  json(['guardar', updated, '-'], saved);
  assert.equal(json(['leer', updated]).project.description, 'Edición en el archivo original.');
});

test('the HTML history records reversals and redos with their authors, times and references', async t => {
  const { launchPreview } = require('../scripts/vista-proyecto.cjs');
  const { readHtml, writeHtml } = require('../scripts/proyecto-html.cjs');
  const folder = mkdtempSync(join(tmpdir(), 'flujo-guardado-'));
  const file = join(folder, 'proyecto.html');
  let preview;
  t.after(() => {
    if (preview) process.kill(preview.pid);
    for (const entry of readdirSync(folder)) unlinkSync(join(folder, entry));
    rmdirSync(folder);
  });
  writeFileSync(file, html);
  preview = await launchPreview(file, false);
  const origin = new URL(preview.url).origin;
  const save = (edit, requestOrigin = origin, route = 'guardar') => fetch(preview.url + route, {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify(edit),
    signal: AbortSignal.timeout(5000)
  });
  const edit = readHtml(file);
  edit.project.nodes.find(node => node.id === 'n-limit').value = '4';
  const denied = await save({ revision: edit.revision, project: edit.project }, 'http://127.0.0.1:8000');
  assert.equal(denied.status, 403);

  const saved = await save({ revision: edit.revision, project: edit.project, author: { type: 'ai', name: 'Impostor' } });
  assert.equal(saved.status, 200);
  const acknowledgement = await saved.json();
  const after = readHtml(file);
  assert.equal(acknowledgement.revision, after.revision);
  assert.equal(after.project.nodes.find(node => node.id === 'n-limit').value, '4');
  const [viewerEntry] = after.project.changeHistory;
  assert.equal(viewerEntry.author.type, 'viewer');
  assert.ok(!Number.isNaN(Date.parse(viewerEntry.at)));
  assert.deepEqual(viewerEntry.changes, [{
    path: ['Bloques', '¿Alcanzó el límite?', 'Valor'], before: '3', after: '4',
    target: { segments: [{ key: 'nodes' }, { id: 'n-limit' }, { key: 'value' }] }
  }]);
  const cliEdit = structuredClone(after.project);
  cliEdit.description = 'Cambio más reciente en disco.';
  cliEdit.changeHistory = [];
  writeHtml(file, after, { revision: after.revision, project: cliEdit, author: { type: 'ai', name: 'Codex' } });

  edit.project.nodes.find(node => node.id === 'n-limit').value = '5';
  const conflict = await save({ revision: acknowledgement.revision, project: edit.project });
  assert.equal(conflict.status, 409);
  const latest = await conflict.json();
  assert.ok(latest.sequence > acknowledgement.sequence);
  assert.equal(latest.revision, readHtml(file).revision);
  assert.equal(latest.project.description, cliEdit.description);
  assert.equal(latest.project.nodes.find(node => node.id === 'n-limit').value, '4');
  assert.equal(latest.project.changeHistory.length, 2);
  assert.deepEqual(latest.project.changeHistory[1].author, { type: 'ai', name: 'Codex' });
  assert.equal(latest.project.changeHistory[1].changes[0].after, cliEdit.description);

  const reversal = { revision: latest.revision, entryId: viewerEntry.id, changeIndex: 0 };
  const staleReversal = await save({ ...reversal, revision: acknowledgement.revision }, origin, 'revertir');
  assert.equal(staleReversal.status, 409);
  assert.equal(readHtml(file).revision, latest.revision);
  const response = await save(reversal, origin, 'revertir');
  assert.equal(response.status, 200);
  const reverted = readHtml(file);
  assert.equal(reverted.project.nodes.find(node => node.id === 'n-limit').value, '3');
  assert.equal(reverted.project.description, cliEdit.description);
  assert.equal(reverted.project.changeHistory.length, 3);
  const recorded = reverted.project.changeHistory[2];
  assert.deepEqual(recorded.reverts, { entryId: viewerEntry.id, changeIndex: 0 });
  assert.equal(recorded.author.type, 'viewer');
  assert.ok(Date.parse(recorded.at) >= Date.parse(viewerEntry.at));
  assert.equal(recorded.changes[0].before, '4');
  assert.equal(recorded.changes[0].after, '3');
  const rejected = await save({ ...reversal, revision: reverted.revision }, origin, 'revertir');
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /campo cambió después/);
  assert.equal(readHtml(file).revision, reverted.revision);

  const wrongEntry = await save({ ...reversal, revision: reverted.revision }, origin, 'rehacer');
  assert.equal(wrongEntry.status, 400);
  assert.match((await wrongEntry.json()).error, /entrada de reversión/);
  const redo = { revision: reverted.revision, entryId: recorded.id, changeIndex: 0 };
  const staleRedo = await save({ ...redo, revision: latest.revision }, origin, 'rehacer');
  assert.equal(staleRedo.status, 409);
  const redoResponse = await save(redo, origin, 'rehacer');
  assert.equal(redoResponse.status, 200);
  const redone = readHtml(file);
  const redoRecord = redone.project.changeHistory[3];
  assert.equal(redone.project.nodes.find(node => node.id === 'n-limit').value, '4');
  assert.equal(redone.project.description, cliEdit.description);
  assert.equal(redone.project.changeHistory.length, 4);
  assert.deepEqual(redoRecord.redoes, { entryId: recorded.id, changeIndex: 0 });
  assert.equal(redoRecord.author.type, 'viewer');
  assert.ok(Date.parse(redoRecord.at) >= Date.parse(recorded.at));
  assert.equal(redoRecord.changes[0].before, '3');
  assert.equal(redoRecord.changes[0].after, '4');
  const duplicate = await save({ ...redo, revision: redone.revision }, origin, 'rehacer');
  assert.equal(duplicate.status, 400);
  assert.match((await duplicate.json()).error, /campo cambió después/);
  assert.equal(readHtml(file).revision, redone.revision);

  const viewer = boot(readFileSync(file, 'utf8'));
  viewer.element('#changeHistoryButton').onclick();
  const history = viewer.element('#changeHistoryList').innerHTML;
  assert.match(history, /Codex · IA/);
  assert.match(history, /Usuario del visor/);
  assert.match(history, /Reversión/);
  assert.match(history, /Cambio rehecho/);
  assert.match(history, /Bloques › ¿Alcanzó el límite\? › Valor/);
  viewer.element('#exportHtmlButton').onclick();
  const reopened = boot(await viewer.downloads.at(-1).text());
  assert.equal(reopened.run('window.__prototypeTestApi.project.changeHistory.length'), 4);
});

test('a reversal restores a deleted element and its order without dropping another addition', () => {
  const { appendHistory, revertHistoryChange } = require('../scripts/historial-proyecto.cjs');
  const record = id => ({ id, text: id });
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(record);
  const previous = { notes: [a, b, c] };
  const edited = appendHistory(previous, { notes: [c, a] }, undefined, 'viewer');
  const [entry] = edited.changeHistory;
  const moved = revertHistoryChange({ ...edited, notes: [c, d, a] }, entry.id, 1);
  assert.deepEqual(moved.notes, [a, d, c]);
  const restored = revertHistoryChange(moved, entry.id, 0);
  assert.deepEqual(restored.notes, [a, d, b, c]);
});

function boot(sourceHtml = html, savedProject, session = new Map(), storage = new Map(), browser = {}) {
  const dataMatch = sourceHtml.match(/<script id="projectData" type="application\/json">([\s\S]*?)<\/script>/);
  const previewMatch = sourceHtml.match(/^<script id="projectPreview" type="application\/json">([^\n]*)<\/script>/m);
  const inlineScript = [...sourceHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
  assert.ok(dataMatch && inlineScript, 'autonomous project must contain embedded data and executable code');
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', hidden: false,
      clientWidth: 900, clientHeight: 620, offsetWidth: 250, offsetHeight: 130,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute() {}, scrollTo() {}, scrollIntoView() {},
      querySelectorAll() { return []; }
    });
    return elements.get(selector);
  };
  if (savedProject) storage.set('flujo-project:' + savedProject.id, JSON.stringify(savedProject));
  const downloads = [];
  const document = {
    fullscreenElement: null,
    documentElement: { outerHTML: sourceHtml },
    getElementById(id) {
      if (id === 'projectData') return { textContent: dataMatch[1] };
      if (id === 'projectPreview') return previewMatch ? { textContent: previewMatch[1] } : null;
      return element('#' + id);
    },
    querySelector: element,
    querySelectorAll(selector) { return selector === '#nodes .node' ? [] : []; },
    createElement() { return { click() {} }; },
    addEventListener() {}
  };
  const window = { addEventListener() {} };
  const context = vm.createContext({
    document, window, structuredClone, TextEncoder, Math, JSON, Date, EventSource: browser.EventSource,
    localStorage: {
      get length() { return storage.size; },
      key: index => [...storage.keys()][index] ?? null,
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    sessionStorage: {
      getItem: key => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, value),
      removeItem: key => session.delete(key)
    },
    getComputedStyle: () => ({ height: '620px' }),
    Blob,
    URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout: () => 1, clearTimeout() {}, console
  });
  const instrumented = inlineScript.replace(/\}\)\(\);\s*$/, 'window.__prototypeTestApi={simulate,expectedCase,get project(){return project},auditGraph,organizeFlow,restoreArchivedNodes,render,renderQuestions,editDefinition,addNode,editSubflow,routeConnections,measureRoutes,openSubflowCanvas,activeGraph,saveSimulatedData,starterGraph};})();');
  assert.notEqual(instrumented, inlineScript, 'test API should be injected before the app closure');
  vm.runInContext(instrumented, context, { filename: 'prototipo-proyecto.html' });
  return { run: expression => vm.runInContext(expression, context), storage, session, element, downloads };
}

test('autonomous project examples match and cover every configured connection', () => {
  const page = boot();
  const summary = page.run(`(()=>{
    const api=window.__prototypeTestApi,results=api.project.cases.map(api.expectedCase);
    const covered=new Set(results.flatMap(result=>result.visitedEdges));
    return {passed:results.filter(result=>result.passed).length,total:results.length,edges:api.project.edges.length,covered:api.project.edges.filter(edge=>covered.has(edge.from+'→'+edge.to+':'+edge.when)).length,failures:results.filter(result=>!result.passed).map(result=>({name:result.name,error:result.error,expected:result.expected,actual:result.actual})),uncovered:api.project.edges.filter(edge=>!covered.has(edge.from+'→'+edge.to+':'+edge.when))};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), { passed: 16, total: 16, edges: 19, covered: 19, failures: [], uncovered: [] });
});

test('the preview connects automatically, refreshes the simulation and exports an offline HTML', async () => {
  const sourceTag = /^<script id="projectData" type="application\/json">([^\n]*)<\/script>/m;
  const original = JSON.parse(html.match(sourceTag)[1]);
  const handlers = new Map();
  let sequence = 0;
  const previewHtml = html.replace('<!-- PROJECT PREVIEW CONFIG -->',
    '<script id="projectPreview" type="application/json">{"id":"preview-test","events":"/preview-test/eventos"}</script>');
  const browser = {
    EventSource: class {
      constructor(url) { assert.equal(url, '/preview-test/eventos'); }
      addEventListener(event, callback) { handlers.set(event, callback); }
    }
  };
  const publish = message => {
    const project = structuredClone(original);
    project.nodes.find(node => node.id === 'n-result').message = message;
    handlers.get('proyecto')({ data: JSON.stringify({ project, revision: 'test-' + ++sequence, sequence }) });
  };
  const page = boot(previewHtml, undefined, new Map(), new Map(), browser);
  handlers.get('proyecto')({ data: JSON.stringify({ project: original, revision: 'test-0', sequence }) });
  assert.match(page.element('#livePreviewStatus').textContent, /Archivo al día/);
  const result = () => JSON.parse(page.element('#resultText').textContent).flowData;
  page.element('#runInput').value = '{"idSolicitud":"REQ-104","clienteId":"CLI-88"}';
  page.element('#runDefault').onclick();
  assert.equal(result().respuesta, 'Consulta completada.');
  handlers.get('aviso')({ data: JSON.stringify('Esperando una versión válida del mismo proyecto.') });
  assert.equal(result().respuesta, 'Consulta completada.');
  publish('Resultado actualizado desde disco.');
  assert.equal(result().respuesta, 'Resultado actualizado desde disco.');
  assert.match(page.element('#livePreviewStatus').textContent, /Actualizado desde el archivo/);
  assert.match(page.element('#runInput').value, /REQ-104/);

  page.run("window.__prototypeTestApi.project.description='Edición del usuario';window.__prototypeTestApi.render()");
  publish('Segunda versión desde disco.');
  assert.equal(page.element('#applyProjectFile').hidden, false);
  assert.equal(result().respuesta, 'Resultado actualizado desde disco.');
  assert.equal(page.run('window.__prototypeTestApi.project.description'), 'Edición del usuario');
  page.element('#applyProjectFile').onclick();
  assert.equal(result().respuesta, 'Segunda versión desde disco.');
  assert.equal(page.element('#applyProjectFile').hidden, true);
  page.element('#exportHtmlButton').onclick();
  const exported = await page.downloads.at(-1).text();
  assert.doesNotMatch(exported, /preview-test/);
  assert.ok(boot(exported).run('window.__prototypeTestApi.project.nodes.some(node=>node.message==="Segunda versión desde disco.")'));

  page.element('#newProject').onclick();
  page.element('#newProjectName').value = 'Proyecto separado';
  page.element('#workspaceForm').onsubmit({ preventDefault() {} });
  assert.match(page.element('#livePreviewStatus').textContent, /Exporta su HTML/);
  publish('Otra edición del archivo vinculado.');
  assert.equal(page.element('#projectTitle').textContent, 'Proyecto separado');
  assert.match(page.element('#livePreviewStatus').textContent, /Exporta su HTML/);
});

test('a blank project stores independent flows and exports only its own editable project', async () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const submit = () => page.element('#workspaceForm').onsubmit({ preventDefault() {} });
  const select = (view, picker, value) => view.element(picker).onchange({ target: { value } });
  page.element('#newProject').onclick();
  page.element('#newProjectName').value = '  ';
  submit();
  assert.equal(page.element('#workspaceError').hidden, false);
  assert.equal(page.run(`${api}.project.id`), 'solicitudes-demo');

  page.element('#newProjectName').value = 'Aprobación de gastos';
  page.element('#newProjectDescription').value = 'Simula la revisión de gastos.';
  page.element('#newFlowName').value = 'Aprobar gasto';
  submit();
  const projectId = page.run(`${api}.project.id`);
  assert.notEqual(projectId, 'solicitudes-demo');
  assert.equal(page.run(`${api}.project.nodes.length`), 0);
  assert.equal(page.run(`${api}.project.blockDefinitions.length`), 0);
  assert.equal(page.run(`${api}.project.subflows.length`), 0);
  assert.equal(page.run(`${api}.project.cases.length`), 0);

  page.element('#openWildcard').onclick();
  page.element('#blockName').value = 'Registrar decisión';
  page.element('#blockPurpose').value = 'Resume la decisión simulada.';
  page.element('#blockInputs').value = 'aprobado';
  page.element('#blockOutputs').value = 'registro';
  page.element('#blockSimulation').value = '{"registro":"simulado"}';
  page.element('#saveBlock').onclick();
  page.run(`(() => {
    const api=${api};
    api.addNode('input');
    api.addNode('subflow');
    api.addNode('custom',api.project.blockDefinitions[0].id);
    api.addNode('output');
    const [input,call,action,output]=api.project.nodes;
    const child=api.project.subflows[0];
    child.name='Verificar presupuesto';
    child.outputs=['aprobado'];
    api.openSubflowCanvas(call);
    child.graph.nodes.find(node=>node.kind==='output').simulatedOutput={aprobado:true};
    api.project.edges=[{from:input.id,to:call.id,when:'next'},
      {from:call.id,to:action.id,when:'next'},{from:action.id,to:output.id,when:'next'}];
    api.render();
  })()`);
  page.element('#backToParent').onclick();
  page.element('#runInput').value = '{"importe":150}';
  page.element('#runDefault').onclick();
  const result = JSON.parse(page.element('#resultText').textContent);
  assert.equal(result.flowData.aprobado, true);
  assert.equal(result.flowData.registro, 'simulado');
  assert.equal(result.internalState.estadoConversacion, 'completada');
  assert.equal(result.internalState.idSolicitudEnCurso, undefined);
  assert.equal(result.internalState.intentosSinIdentificacion, undefined);

  page.element('#newFlow').onclick();
  page.element('#newFlowName').value = 'Consultar comprobante';
  submit();
  const secondary = page.run(`${api}.project.flows[0].id`);
  assert.equal(page.run(`${api}.activeGraph().nodes.length`), 0);
  page.run(`${api}.addNode('input')`);
  assert.equal(page.run(`${api}.project.nodes.length`), 4);
  select(page, '#projectPicker', '');
  assert.equal(page.run(`${api}.project.id`), 'solicitudes-demo');
  assert.equal(page.run(`${api}.project.nodes.length`), 16);
  select(page, '#projectPicker', projectId);
  assert.equal(page.element('#flowPicker').value, secondary);

  const reloaded = boot(html, undefined, page.session, page.storage);
  assert.equal(reloaded.run(`${api}.project.id`), projectId);
  assert.equal(reloaded.element('#flowPicker').value, secondary);
  assert.equal(reloaded.run(`${api}.activeGraph().nodes.length`), 1);
  reloaded.element('#exportHtmlButton').onclick();
  const exported = await reloaded.downloads.at(-1).text();
  const reopened = boot(exported, undefined, new Map(), page.storage);
  assert.equal(reopened.run(`${api}.project.id`), projectId);
  assert.doesNotMatch(reopened.element('#projectPicker').innerHTML, /Sistema de solicitudes/);
  assert.match(reopened.element('#flowPicker').innerHTML, /Consultar comprobante/);
  assert.equal(reopened.run(`${api}.simulate({importe:150}).output.flowData.registro`), 'simulado');
  select(reopened, '#flowPicker', secondary);
  assert.equal(reopened.run(`${api}.activeGraph().nodes.length`), 1);
  reopened.run(`${api}.addNode('output')`);
  assert.equal(reloaded.run(`${api}.activeGraph().nodes.length`), 1);
});

test('project blocks enforce required inputs and declared outputs during simulation', () => {
  const page = boot();
  const graph = {
    nodes: [
      { id: 'in', kind: 'input', title: 'Entrada', requiredFields: [], optionalFields: [], inputSchema: {}, allowAdditional: true },
      { id: 'custom', kind: 'custom', title: 'Bloque propio', blockId: 'custom-contract' },
      { id: 'out', kind: 'output', title: 'Resultado', message: 'Terminado' }
    ],
    edges: [{ from: 'in', to: 'custom', when: 'next' }, { from: 'custom', to: 'out', when: 'next' }],
    blockDefinitions: [{ id: 'custom-contract', name: 'Bloque propio', inputs: ['clave'], outputs: ['resultado'], simulation: { resultado: 'ok' } }],
    subflows: [], cases: []
  };
  page.run(`Object.assign(window.__prototypeTestApi.project,${JSON.stringify(graph)})`);
  const missingInput = page.run('window.__prototypeTestApi.simulate({})');
  assert.match(missingInput.error, /faltan entradas requeridas: clave/);
  const blankInput = page.run('window.__prototypeTestApi.simulate({clave:"   "})');
  assert.match(blankInput.error, /faltan entradas requeridas: clave/);

  const valid = page.run('window.__prototypeTestApi.simulate({clave:"entrada"})');
  assert.equal(valid.error, null);
  assert.equal(valid.output.flowData.resultado, 'ok');
  assert.equal(valid.completed, true);

  page.run('window.__prototypeTestApi.project.blockDefinitions[0].simulation={}');
  const missingOutput = page.run('window.__prototypeTestApi.simulate({clave:"entrada"})');
  assert.match(missingOutput.error, /faltan salidas declaradas: resultado/);
});

test('wildcard imports can be edited and their example outputs drive the simulated flow', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  page.element('#importBlockButton').onclick();
  const generatedDefinition = {
    id: 'ai-identity-check', name: 'Validar identidad', purpose: 'Verifica el cliente antes de continuar.',
    inputs: ['clienteId'], outputs: ['identidadValida'],
    rules: ['Si coincide, identidadValida=true.'], simulation: { identidadValida: true }
  };
  page.element('#aiDefinition').value = JSON.stringify(generatedDefinition);
  page.element('#importAiDefinition').onclick();
  assert.match(page.element('#projectPalette').innerHTML, /Validar identidad/);
  page.element('#projectPalette').onclick({ target: { closest: () => ({ dataset: { addCustom: generatedDefinition.id } }) } });
  const instanceId = page.run(`${api}.project.nodes.at(-1).id`);
  page.run(`${api}.project.nodes=[{id:'in',kind:'input',title:'Entrada'},{id:${JSON.stringify(instanceId)},kind:'custom',blockId:'ai-identity-check',title:'Validar identidad'},{id:'out',kind:'output',title:'Resultado',message:'Fin'}]`);
  page.run(`${api}.project.edges=[{from:'in',to:${JSON.stringify(instanceId)},when:'next'},{from:${JSON.stringify(instanceId)},to:'out',when:'next'}]`);
  page.run(`${api}.render()`);

  const valid = page.run(`${api}.simulate({clienteId:'CLI-88'})`);
  assert.equal(valid.error, null);
  assert.equal(valid.output.flowData.identidadValida, true);
  assert.match(page.run(`${api}.simulate({}).error`), /clienteId/);

  page.run(`${api}.editDefinition('ai-identity-check')`);
  page.element('#blockName').value = 'Validar identidad v2';
  page.element('#blockPurpose').value = 'Aplica el resultado simulado actualizado.';
  page.element('#blockSimulation').value = '{"identidadValida":false}';
  page.element('#saveBlock').onclick();
  const edited = page.run(`${api}.simulate({clienteId:'CLI-88'})`);
  assert.equal(edited.error, null);
  assert.equal(edited.output.flowData.identidadValida, false);
  assert.equal(page.run(`${api}.project.nodes.find(n=>n.id===${JSON.stringify(instanceId)}).title`), 'Validar identidad v2');
});

test('structured block imports reject malformed contracts, duplicate IDs, and generate missing IDs', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const base = { name: 'Bloque', purpose: 'Describe una operación.', inputs: ['entrada'], outputs: ['salida'], simulation: { salida: 1 } };
  for (const invalid of [
    { ...base, name: '   ' },
    { ...base, inputs: [''] },
    { ...base, outputs: [3] },
    { ...base, inputs: ['entrada', 'entrada'] },
    { ...base, inputs: ['entrada', ' entrada '] },
    { ...base, outputs: ['salida', 'salida'] },
    { ...base, outputs: ['salida', ' salida '] },
    { ...base, rules: [''] },
    { ...base, simulation: [] }
  ]) {
    const before = page.run(`${api}.project.blockDefinitions.length`);
    page.element('#aiDefinition').value = JSON.stringify(invalid);
    page.element('#importAiDefinition').onclick();
    assert.equal(page.run(`${api}.project.blockDefinitions.length`), before);
  }
  page.element('#aiDefinition').value = JSON.stringify({ ...base, id: 'lookup-request' });
  page.element('#importAiDefinition').onclick();
  assert.equal(page.run(`${api}.project.blockDefinitions.length`), 2);
  page.element('#aiDefinition').value = JSON.stringify(base);
  page.element('#importAiDefinition').onclick();
  assert.match(page.run(`${api}.project.blockDefinitions.at(-1).id`), /^ai-/);
});

test('new subflow blocks get editable definitions whose simulated outputs feed later nodes', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  page.run(`${api}.project.nodes=[];${api}.project.edges=[];${api}.project.subflows=[]`);
  page.run(`${api}.addNode('subflow')`);
  const created = page.run(`(()=>{const n=${api}.project.nodes[0],sf=${api}.project.subflows[0];return {node:n,definition:sf}})()`);
  page.run(`${api}.addNode('input')`);
  const inputId = page.run(`${api}.project.nodes.at(-1).id`);
  assert.ok(created.node.subflowId);
  assert.equal(created.definition.id, created.node.subflowId);
  page.run(`${api}.editSubflow(${JSON.stringify(created.node.subflowId)})`);
  page.element('#subflowName').value = 'Consultar solicitud';
  page.element('#subflowPurpose').value = 'Busca el estado de la solicitud sin fijar aún la integración.';
  page.element('#subflowInputs').value = 'idSolicitud';
  page.element('#subflowOutputs').value = 'estadoSolicitud';
  page.element('#subflowSimulation').value = '{"estadoSolicitud":"en_revision"}';
  page.element('#saveSubflow').onclick();
  page.run(`${api}.project.nodes.push({id:'out',kind:'output',title:'Entregar estado',message:'Listo'});${api}.project.edges=[{from:${JSON.stringify(inputId)},to:${JSON.stringify(created.node.id)},when:'next'},{from:${JSON.stringify(created.node.id)},to:'out',when:'next'}]`);
  const result = page.run(`${api}.simulate({idSolicitud:'REQ-1'})`);
  assert.equal(result.error, null);
  assert.equal(result.output.flowData.estadoSolicitud, 'en_revision');
  assert.deepEqual(JSON.parse(JSON.stringify(result.visited)), ['Nueva entrada', 'Consultar solicitud', 'Entregar estado']);
  const missing = page.run(`${api}.simulate({})`);
  assert.match(missing.error, /idSolicitud/);
});

test('editing a child canvas changes the parent route and survives storage and HTML export', async () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  page.run(`${api}.openSubflowCanvas(${api}.project.nodes.find(node=>node.id==='n-lookup'))`);
  assert.match(page.element('#canvasTitle').textContent, /Flujo principal \/ Consultar solicitud/);
  assert.equal(page.run(`${api}.activeGraph().nodes.length`), 5);
  assert.equal(page.run(`${api}.project.nodes.length`), 16);

  page.element('#simulatedData').value = '["invalid"]';
  page.run(`${api}.saveSimulatedData(${api}.activeGraph().nodes.find(node=>node.id==='lookup-found'))`);
  assert.match(page.element('#toast').textContent, /objeto JSON válido/);
  assert.equal(page.run(`${api}.activeGraph().nodes.find(node=>node.id==='lookup-found').simulatedOutput.resultadoConsulta`), 'encontrada');
  page.element('#simulatedData').value = '{"resultadoConsulta":"no_encontrada","estado":null,"detalle":"$& guardado"}';
  page.run(`${api}.saveSimulatedData(${api}.activeGraph().nodes.find(node=>node.id==='lookup-found'))`);
  page.run(`${api}.addNode('operation');(()=>{
    const graph=${api}.activeGraph(),step=graph.nodes.at(-1);
    step.title='Preparar respuesta';
    step.simulatedOutput={paso:'desde el lienzo hijo'};
    graph.edges.find(edge=>edge.from==='start').to=step.id;
    graph.edges.push({from:step.id,to:'lookup-example',when:'next'});
    ${api}.render();
  })()`);
  page.element('#runDefault').onclick();
  assert.equal(JSON.parse(page.element('#resultText').textContent).flowData.paso, 'desde el lienzo hijo');
  assert.match(page.element('#routeText').innerHTML, /Recibir.*Preparar respuesta.*Simular consulta.*Solicitud encontrada/);
  page.element('#backToParent').onclick();
  const result = page.run(`${api}.simulate({idSolicitud:'REQ-104',clienteId:'CLI-88'})`);
  assert.equal(result.error, null);
  assert.equal(result.visited.at(-1), 'Solicitud no encontrada');
  assert.equal(result.output.flowData.paso, 'desde el lienzo hijo');
  assert.equal(result.subflows.find(flow => flow.name === 'Consultar solicitud').visited[1], 'Preparar respuesta');
  const before = page.storage.get('flujo-project:solicitudes-demo');
  assert.equal(JSON.parse(before).subflows.find(flow => flow.id === 'lookup-request').graph.nodes.at(-1).title, 'Preparar respuesta');
  page.element('#exportHtmlButton').onclick();
  assert.equal(page.storage.get('flujo-project:solicitudes-demo'), before);
  const reopened = boot(await page.downloads[0].text());
  const roundTrip = reopened.run(`${api}.simulate({idSolicitud:'REQ-104',clienteId:'CLI-88'})`);
  assert.equal(roundTrip.error, null);
  assert.equal(roundTrip.output.flowData.detalle, '$& guardado');
  assert.equal(roundTrip.visited.at(-1), 'Solicitud no encontrada');
});

test('nested graphs return evaluated blocks and reject repeated subflow calls within their own stack', () => {
  const page = boot();
  const state = `(()=>{
    const api=window.__prototypeTestApi,model=api.project;
    const identity=model.subflows.find(flow=>flow.id==='validate-customer');
    identity.graph={nodes:[{id:'start',kind:'input'},{id:'deep',kind:'subflow',subflowId:'nested'},
     {id:'return',kind:'output'}],edges:[{from:'start',to:'deep',when:'next'},{from:'deep',to:'return',when:'next'}]};
    const nested={id:'nested',name:'Validación anidada',inputs:['clienteId'],outputs:['resultadoIdentidad','clienteIdNormalizado'],
     graph:{nodes:[{id:'start',kind:'input'},{id:'check',kind:'condition',field:'clienteId',operator:'eq',value:'CLI-88'},
      {id:'yes',kind:'output',simulatedOutput:{resultadoIdentidad:'validada',clienteIdNormalizado:'CLI-88'}},
      {id:'no',kind:'output',simulatedOutput:{resultadoIdentidad:'no_encontrada',clienteIdNormalizado:null}}],
      edges:[{from:'start',to:'check',when:'next'},{from:'check',to:'yes',when:'yes'},{from:'check',to:'no',when:'no'}]}};
    model.subflows.push(nested);
    const ok=api.simulate({idSolicitud:'REQ-104',clienteId:'CLI-88'});
    const missing=api.simulate({idSolicitud:'REQ-104',clienteId:'CLI-404'});
    nested.graph.nodes[1]={id:'check',kind:'subflow',subflowId:identity.id};
    const cycle=api.simulate({idSolicitud:'REQ-104',clienteId:'CLI-88'});
    return {ok,missing,cycle};
  })()`;
  const { ok, missing, cycle } = page.run(state);
  assert.equal(ok.output.flowData.resultadoIdentidad, 'validada');
  assert.equal(ok.completed, true);
  assert.equal(missing.output.flowData.resultadoIdentidad, 'no_encontrada');
  assert.equal(missing.pending, true);
  assert.match(cycle.error, /vuelve a llamarse/);
});

test('the lookup subflow runs all three internal branches and chooses each parent result', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const covered = new Set();
  for (const [caseId, request, outcome, childExit, parentExit, parentState] of [
    ['c1', 'REQ-104', 'encontrada', 'Solicitud encontrada', 'Entregar estado', 'completada'],
    ['c8', 'REQ-404', 'no_encontrada', 'Solicitud no encontrada', 'Solicitud no encontrada', 'solicitud_no_encontrada'],
    ['c9', 'REQ-503', 'error_tecnico', 'Error técnico', 'Consulta pendiente de definición', 'pendiente_definicion']
  ]) {
    const testCase = page.run(`${api}.project.cases.find(item=>item.id==='${caseId}')`);
    assert.equal(testCase.input.idSolicitud, request);
    assert.equal(testCase.subflowResults, undefined);
    const result = page.run(`${api}.simulate(${JSON.stringify(testCase.input)})`);
    assert.equal(result.error, null);
    assert.equal(result.completed, true);
    assert.equal(result.output.flowData.resultadoConsulta, outcome);
    assert.equal(result.output.internalState.estadoConversacion, parentState);
    assert.equal(result.visited.at(-1), parentExit);
    const trace = result.subflows.find(run => run.id === 'lookup-request');
    assert.equal(trace.overridden, false);
    assert.deepEqual([...trace.visited], ['Recibir datos de consulta', 'Simular consulta', childExit]);
    for (const edge of trace.visitedEdges) covered.add(edge);
    assert.equal(page.run(`${api}.expectedCase(${JSON.stringify(testCase)}).passed`), true);
  }
  assert.equal(covered.size, 4);
  page.run(`${api}.openSubflowCanvas(${api}.project.nodes.find(node=>node.id==='n-lookup'))`);
  page.element('#casesButton').onclick();
  assert.equal(page.element('#coverageTitle').textContent, 'Cobertura de Consultar solicitud');
  assert.equal((page.element('#pathCoverage').innerHTML.match(/Cubierto por/g) || []).length, 4);
});

test('identity validation executes three child branches and only lets valid clients consult the request', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const covered = new Set();
  for (const fixture of [
    { id: 'c1', client: 'CLI-88', outcome: 'validada', exit: 'Identidad validada',
      route: ['Reiniciar fallos consecutivos', 'Consultar solicitud', 'Resultado de consulta', 'Entregar estado'],
      state: 'completada', pending: false, count: 0 },
    { id: 'c6', client: 'CLI-99', outcome: 'no_encontrada', exit: 'Identidad no encontrada',
      route: ['Contar fallo consecutivo', '¿Alcanzó el límite?', 'Pedir identificación', 'Esperar siguiente mensaje'],
      state: 'esperando_respuesta', pending: true, count: 1 },
    { id: 'c7', client: 'CLI-503', outcome: 'error_tecnico', exit: 'Error técnico',
      route: ['Validación técnica pendiente'], state: 'pendiente_definicion', pending: false, count: 0 }
  ]) {
    const testCase = page.run(`${api}.project.cases.find(item=>item.id==='${fixture.id}')`);
    assert.equal(testCase.input.clienteId, fixture.client);
    assert.equal(testCase.subflowResults, undefined);
    const result = page.run(`${api}.simulate(${JSON.stringify(testCase.input)})`);
    const trace = result.subflows.find(run => run.id === 'validate-customer');
    assert.equal(result.error, null);
    assert.equal(result.pending, fixture.pending);
    assert.equal(trace.overridden, false);
    assert.equal(trace.output.resultadoIdentidad, fixture.outcome);
    assert.deepEqual([...trace.visited], ['Recibir identificación', 'Simular validación de identidad', fixture.exit]);
    assert.deepEqual([...result.visited.slice(result.visited.indexOf('Resultado de identidad') + 1)], fixture.route);
    assert.equal(result.output.internalState.estadoConversacion, fixture.state);
    assert.equal(result.output.internalState.intentosSinIdentificacion, fixture.count);
    assert.equal(result.subflows.some(run => run.id === 'lookup-request'), fixture.outcome === 'validada');
    if (fixture.outcome !== 'validada') {
      assert.equal(result.output.flowData.clienteIdNormalizado, null);
      assert.equal(result.output.flowData.detalle, undefined);
      assert.equal(result.output.flowData.estado, undefined);
    }
    for (const edge of trace.visitedEdges) covered.add(edge);
    assert.equal(page.run(`${api}.expectedCase(${JSON.stringify(testCase)}).passed`), true);
  }
  assert.equal(covered.size, 4);
  page.run(`${api}.openSubflowCanvas(${api}.project.nodes.find(node=>node.id==='n-identity'))`);
  page.element('#casesButton').onclick();
  assert.equal(page.element('#coverageTitle').textContent, 'Cobertura de Validar identidad del cliente');
  assert.equal((page.element('#pathCoverage').innerHTML.match(/Cubierto por/g) || []).length, 4);
});

test('identity retries accept a corrected ID or stop on the third failed lookup', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const retry = id => page.run(`(()=>{
    const api=${api},fixture=api.project.cases.find(item=>item.id==='${id}');
    return {fixture,result:api.simulate(fixture.input,fixture.followupMessages),check:api.expectedCase(fixture)};
  })()`);
  const recover = retry('retry-recovers');
  assert.equal(recover.check.passed, true);
  assert.equal(recover.check.acceptedFollowups, 1);
  assert.deepEqual([...recover.result.subflows.filter(run => run.id === 'validate-customer').map(run => run.output.resultadoIdentidad)],
    ['no_encontrada', 'validada']);
  assert.equal(recover.result.output.latestUserMessage.clienteId, 'CLI-88');
  assert.equal(recover.result.output.internalState.idSolicitudEnCurso, 'REQ-104');
  assert.equal(recover.result.output.internalState.intentosSinIdentificacion, 0);
  assert.equal(recover.result.visited.at(-1), 'Entregar estado');

  const stop = retry('retry-limit');
  assert.equal(stop.check.passed, true);
  assert.equal(stop.check.acceptedFollowups, 2);
  assert.deepEqual([...stop.result.subflows.map(run => [run.id, run.output.resultadoIdentidad].join(':'))],
    Array(3).fill('validate-customer:no_encontrada'));
  assert.equal(stop.result.output.latestUserMessage.clienteId, 'CLI-777');
  assert.equal(stop.result.output.internalState.intentosSinIdentificacion, 3);
  assert.equal(stop.result.output.flowData.estado, undefined);
  assert.equal(stop.result.visited.at(-1), 'Límite alcanzado');
  assert.equal(stop.result.completed, true);
  assert.equal(stop.result.pending, false);

  const twoFailures = page.run(`${api}.simulate(${JSON.stringify(stop.fixture.input)},${JSON.stringify(stop.fixture.followupMessages.slice(0, 1))})`);
  assert.equal(twoFailures.pending, true);
  assert.equal(twoFailures.output.internalState.intentosSinIdentificacion, 2);
  assert.equal(twoFailures.visited.at(-1), 'Esperar siguiente mensaje');
  page.element('#casesButton').onclick();
  assert.match(page.element('#caseList').innerHTML, /data-case-id="retry-limit".*Mensajes posteriores aceptados: 2 de 3/);
});

test('the interface resumes the same pending simulation and preserves the request and retry counter', () => {
  const page = boot();
  const output = () => JSON.parse(page.element('#resultText').textContent);
  const reply = data => {
    page.element('#followupInput').value = JSON.stringify(data);
    page.element('#resumeRun').onclick();
  };
  page.element('#runInput').value = '{"idSolicitud":"REQ-104","clienteId":"CLI-99"}';
  page.element('#runDefault').onclick();
  assert.equal(page.element('#followupPanel').hidden, false);
  assert.equal(output().internalState.intentosSinIdentificacion, 1);
  assert.equal(output().internalState.estadoConversacion, 'esperando_respuesta');
  reply({ clienteId: 'CLI-88' });
  assert.match(page.element('#runInputError').textContent, /Falta el campo obligatorio «texto»/);
  assert.equal(page.element('#followupPanel').hidden, false);
  assert.equal(output().internalState.turnosUsuario, 1);

  reply({ texto: 'Prueba con CLI-404', clienteId: 'CLI-404' });
  assert.equal(output().internalState.intentosSinIdentificacion, 2);
  assert.equal(output().internalState.idSolicitudEnCurso, 'REQ-104');
  assert.equal(output().internalState.turnosUsuario, 2);
  page.run("window.__prototypeTestApi.openSubflowCanvas(window.__prototypeTestApi.project.nodes.find(node=>node.id==='n-identity'))");
  assert.equal(page.element('#followupPanel').hidden, true);
  page.element('#backToParent').onclick();
  assert.equal(page.element('#followupPanel').hidden, false);
  assert.equal(output().internalState.intentosSinIdentificacion, 2);

  reply({ texto: 'El identificador correcto es CLI-88', clienteId: 'CLI-88' });
  assert.equal(page.element('#followupPanel').hidden, true);
  assert.equal(output().initialUserMessage.clienteId, 'CLI-99');
  assert.equal(output().latestUserMessage.clienteId, 'CLI-88');
  assert.equal(output().internalState.idSolicitudEnCurso, 'REQ-104');
  assert.equal(output().internalState.intentosSinIdentificacion, 0);
  assert.equal(output().internalState.estadoConversacion, 'completada');
  assert.match(page.element('#routeText').innerHTML, /→ Entregar estado/);
  assert.equal((page.element('#routeText').innerHTML.match(/Recibir mensaje inicial/g) || []).length, 1);
});

test('subflow waits resume in place and retain the graph that the simulation started with', () => {
  const page = boot();
  page.run(`(()=>{
    const model=window.__prototypeTestApi.project;
    const identity=model.subflows.find(flow=>flow.id==='validate-customer');
    identity.graph={
      nodes:[{id:'start',kind:'input',title:'Entrada hija'},
        {id:'wait',kind:'wait',title:'Confirmar identidad',requiredFields:['confirmacion']},
        {id:'end',kind:'output',title:'Fin hijo',simulatedOutput:{resultadoIdentidad:'validada',clienteIdNormalizado:'CLI-88'}}],
      edges:[{from:'start',to:'wait',when:'next'},{from:'wait',to:'end',when:'next'}]
    };
  })()`);
  page.element('#runDefault').onclick();
  assert.equal(page.element('#followupPanel').hidden, false);
  assert.match(page.element('#followupContract').textContent, /confirmacion/);
  assert.match(page.element('#routeText').innerHTML, /Entrada hija → Confirmar identidad/);
  page.run("window.__prototypeTestApi.project.subflows.find(flow=>flow.id==='validate-customer').graph.edges.pop()");
  page.element('#followupInput').value = '{"confirmacion":true}';
  page.element('#resumeRun').onclick();
  const result = JSON.parse(page.element('#resultText').textContent);
  assert.equal(result.internalState.estadoConversacion, 'completada');
  assert.equal(result.internalState.turnosUsuario, 2);
  assert.match(page.element('#routeText').innerHTML, /Entrada hija → Confirmar identidad → Fin hijo/);
  assert.equal(page.element('#followupPanel').hidden, true);
});

const mainPause = 'flujo-project:solicitudes-demo:pending-run-v1:main';

test('a new tab restores the pending request and counter, then clears the pause after completion', () => {
  const page = boot();
  const reply = (view, data) => {
    view.element('#followupInput').value = JSON.stringify(data);
    view.element('#resumeRun').onclick();
  };
  const output = view => JSON.parse(view.element('#resultText').textContent);
  page.element('#runInput').value = '{"idSolicitud":"REQ-104","clienteId":"CLI-99"}';
  page.element('#runDefault').onclick();
  reply(page, { texto: 'Prueba con CLI-404', clienteId: 'CLI-404' });
  assert.equal(output(page).internalState.intentosSinIdentificacion, 2);
  const savedPause = page.storage.get(mainPause);
  assert.equal(JSON.parse(savedPause).messages.length, 1);
  reply(page, { clienteId: 'CLI-88' });
  assert.equal(page.storage.get(mainPause), savedPause);

  const project = JSON.parse(page.storage.get('flujo-project:solicitudes-demo'));
  project.nodes.find(node => node.id === 'n-wait').requiredFields.push('contratoNuevo');
  const reloaded = boot(html, project, new Map(), page.storage);
  assert.equal(reloaded.element('#followupPanel').hidden, false);
  assert.match(reloaded.element('#pendingRunNote').textContent, /recuperada/);
  assert.doesNotMatch(reloaded.element('#followupContract').textContent, /contratoNuevo/);
  assert.deepEqual(output(reloaded), output(page));
  assert.equal(boot(html, project).element('#followupPanel').hidden, true);

  reply(reloaded, { texto: 'El correcto es CLI-88', clienteId: 'CLI-88' });
  const final = output(reloaded);
  assert.equal(final.internalState.idSolicitudEnCurso, 'REQ-104');
  assert.equal(final.internalState.intentosSinIdentificacion, 0);
  assert.equal(final.internalState.turnosUsuario, 3);
  assert.equal(final.flowData.estado, 'En revisión');
  assert.match(reloaded.element('#routeText').innerHTML, /→ Entregar estado/);
  assert.equal(page.storage.has(mainPause), false);
  assert.equal(boot(html, project, new Map(), page.storage).element('#followupPanel').hidden, true);
});

test('the third failed identity after reopening ends the run and removes the saved pause', () => {
  const first = boot();
  const state = view => JSON.parse(view.element('#resultText').textContent);
  const reply = (view, clienteId) => {
    view.element('#followupInput').value = JSON.stringify({ texto: 'Verifica mi identificación', clienteId });
    view.element('#resumeRun').onclick();
  };
  first.element('#runInput').value = '{"idSolicitud":"REQ-104","clienteId":"CLI-99"}';
  first.element('#runDefault').onclick();
  reply(first, 'CLI-404');
  assert.equal(state(first).internalState.intentosSinIdentificacion, 2);
  assert.equal(first.storage.has(mainPause), true);

  const resumed = boot(html, undefined, new Map(), first.storage);
  assert.equal(resumed.element('#followupPanel').hidden, false);
  assert.deepEqual(state(resumed), state(first));
  reply(resumed, 'CLI-777');
  assert.equal(state(resumed).internalState.idSolicitudEnCurso, 'REQ-104');
  assert.equal(state(resumed).internalState.intentosSinIdentificacion, 3);
  assert.equal(state(resumed).internalState.estadoConversacion, 'limite_intentos');
  assert.match(resumed.element('#routeText').innerHTML, /→ Límite alcanzado/);
  assert.doesNotMatch(resumed.element('#routeText').innerHTML, /Consultar solicitud/);
  assert.equal(resumed.element('#followupPanel').hidden, true);
  assert.equal(first.storage.has(mainPause), false);

  const reopened = boot(html, undefined, new Map(), first.storage);
  assert.equal(reopened.element('#followupPanel').hidden, true);
  assert.equal(reopened.element('#resultText').textContent, 'Aquí aparecerá el resultado simulado.');
});

test('a new request starts with fresh state after the previous request reaches the retry limit', () => {
  const page = boot();
  const output = () => JSON.parse(page.element('#resultText').textContent);
  page.element('#runInput').value = '{"idSolicitud":"REQ-104","clienteId":"CLI-99"}';
  page.element('#runDefault').onclick();
  for (const clienteId of ['CLI-404', 'CLI-777']) {
    page.element('#followupInput').value = JSON.stringify({ texto: 'Verifica mi identificación', clienteId });
    page.element('#resumeRun').onclick();
  }
  assert.equal(output().internalState.estadoConversacion, 'limite_intentos');
  assert.equal(output().internalState.intentosSinIdentificacion, 3);

  const newMessage = { idSolicitud: 'REQ-404', clienteId: 'CLI-503' };
  page.element('#runInput').value = JSON.stringify(newMessage);
  page.element('#runDefault').onclick();

  const result = output();
  assert.deepEqual(result.initialUserMessage, newMessage);
  assert.deepEqual(result.latestUserMessage, newMessage);
  assert.equal(result.internalState.idSolicitudEnCurso, 'REQ-404');
  assert.equal(result.internalState.intentosSinIdentificacion, 0);
  assert.equal(result.internalState.turnosUsuario, 1);
  assert.doesNotMatch(page.element('#resultText').textContent, /REQ-104/);
  assert.match(page.element('#routeText').innerHTML, /→ Validación técnica pendiente/);
  assert.doesNotMatch(page.element('#routeText').innerHTML, /Reiniciar fallos consecutivos/);
});

test('an older tab loads the latest pause before it can submit a stale reply', () => {
  const first = boot();
  first.element('#runInput').value = '{"idSolicitud":"REQ-104","clienteId":"CLI-99"}';
  first.element('#runDefault').onclick();
  const second = boot(html, undefined, new Map(), first.storage);
  const send = (view, clienteId) => {
    view.element('#followupInput').value = JSON.stringify({ texto:'Verifica mi identificación', clienteId });
    view.element('#resumeRun').onclick();
  };
  send(second, 'CLI-404');
  const latestPause = first.storage.get(mainPause);
  send(first, 'CLI-88');
  assert.equal(first.storage.get(mainPause), latestPause);
  assert.match(first.element('#runInputError').textContent, /cambió en otra pestaña/);
  assert.equal(JSON.parse(first.element('#resultText').textContent).internalState.intentosSinIdentificacion, 2);
  send(first, 'CLI-88');
  assert.equal(first.storage.has(mainPause), false);
  send(second, 'CLI-777');
  assert.equal(first.storage.has(mainPause), false);
  assert.equal(second.element('#followupPanel').hidden, true);
});

test('a pause from session storage is promoted to persistent browser storage', () => {
  const page = boot();
  page.element('#runInput').value = '{"idSolicitud":"REQ-104","clienteId":"CLI-99"}';
  page.element('#runDefault').onclick();
  const previous = JSON.parse(page.storage.get(mainPause));
  delete previous.runId;
  const session = new Map([[mainPause, JSON.stringify(previous)]]);
  page.storage.delete(mainPause);
  const upgraded = boot(html, undefined, session, page.storage);
  assert.equal(upgraded.element('#followupPanel').hidden, false);
  assert.equal(session.has(mainPause), false);
  assert.equal(page.storage.has(mainPause), true);
  assert.equal(boot(html, undefined, new Map(), page.storage).element('#followupPanel').hidden, false);
});

test('a child canvas restores its own pending simulation when reopened in a new tab', () => {
  const page = boot();
  const open = view => view.run(`(()=>{
    const api=window.__prototypeTestApi;
    api.openSubflowCanvas(api.project.nodes.find(node=>node.id==='n-identity'));
  })()`);
  open(page);
  page.run(`(()=>{
    const graph=window.__prototypeTestApi.activeGraph();
    graph.nodes.splice(1,0,{id:'verify',kind:'wait',title:'Confirmar dato',requiredFields:['texto']});
    const entry=graph.edges.find(edge=>edge.from==='start');
    graph.edges.push({from:'verify',to:entry.to,when:'next'});
    entry.to='verify';
    window.__prototypeTestApi.render();
  })()`);
  page.element('#runDefault').onclick();
  assert.equal(page.element('#followupPanel').hidden, false);
  const saved = JSON.parse(page.storage.get('flujo-project:solicitudes-demo'));
  const reloaded = boot(html, saved, new Map(), page.storage);
  assert.equal(reloaded.element('#followupPanel').hidden, true);
  open(reloaded);
  assert.match(reloaded.element('#pendingRunNote').textContent, /recuperada/);
  reloaded.element('#followupInput').value = '{"texto":"Confirmado"}';
  reloaded.element('#resumeRun').onclick();
  assert.equal(JSON.parse(reloaded.element('#resultText').textContent).flowData.resultadoIdentidad, 'validada');
  assert.equal(page.storage.has('flujo-project:solicitudes-demo:pending-run-v1:subflow:validate-customer'), false);
});

test('saved demos upgrade only untouched subflow canvases and cases', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const legacy = JSON.parse(page.run(`JSON.stringify((()=>{
    const project=${api}.project;
    for(const [flowId,field,fixtures] of [
     ['lookup-request','idSolicitud',[['c8','lookup-missing','REQ-999'],['c9','lookup-failed','REQ-104']]],
     ['validate-customer','clienteId',[['c6','identity-missing','CLI-99'],['c7','identity-error','CLI-88']]]
    ]){
      const flow=project.subflows.find(flow=>flow.id===flowId),sample=flow.graph;
      flow.graph=${api}.starterGraph(flow,{},${api}.project);
      for(const [id,exit,value] of fixtures){
        const test=project.cases.find(item=>item.id===id);
        test.input[field]=value;
        test.subflowResults={[flowId]:sample.nodes.find(node=>node.id===exit).simulatedOutput};
      }
    }
    return project;
  })())`));
  const upgraded = boot(html, legacy);
  assert.equal(upgraded.run(`${api}.project.subflows.find(flow=>flow.id==='lookup-request').graph.nodes.length`), 5);
  assert.equal(upgraded.run(`${api}.project.cases.find(item=>item.id==='c8').input.idSolicitud`), 'REQ-404');
  assert.equal(upgraded.run(`${api}.project.cases.find(item=>item.id==='c9').subflowResults`), undefined);
  assert.equal(upgraded.run(`${api}.project.subflows.find(flow=>flow.id==='validate-customer').graph.nodes.length`), 5);
  assert.equal(upgraded.run(`${api}.project.cases.find(item=>item.id==='c7').input.clienteId`), 'CLI-503');
  assert.equal(upgraded.run(`${api}.project.cases.find(item=>item.id==='c6').subflowResults`), undefined);
  const changedCase = structuredClone(legacy);
  changedCase.cases.find(item => item.id === 'c8').name = 'Caso del equipo';
  assert.equal(boot(html, changedCase).run(`${api}.project.cases.find(item=>item.id==='c8').name`), 'Caso del equipo');
  const custom = legacy.subflows.find(flow => flow.id === 'lookup-request');
  custom.graph.nodes[1].simulatedOutput.estado = 'Estado editado';
  legacy.subflows.find(flow => flow.id === 'validate-customer').graph.nodes[1].title = 'Validación propia';
  const preserved = boot(html, legacy);
  assert.equal(preserved.run(`${api}.project.subflows.find(flow=>flow.id==='lookup-request').graph.nodes[1].simulatedOutput.estado`), 'Estado editado');
  assert.equal(preserved.run(`${api}.project.cases.find(item=>item.id==='c8').input.idSolicitud`), 'REQ-999');
  assert.equal(preserved.run(`${api}.project.subflows.find(flow=>flow.id==='validate-customer').graph.nodes[1].title`), 'Validación propia');
  assert.equal(preserved.run(`${api}.project.cases.find(item=>item.id==='c7').input.clienteId`), 'CLI-88');
});

test('saved demos receive retry cases without replacing existing edits or creating duplicates', () => {
  const page = boot();
  const saved = JSON.parse(page.storage.get('flujo-project:solicitudes-demo'));
  saved.cases = saved.cases.filter(item => item.id !== 'retry-limit');
  saved.cases.find(item => item.id === 'retry-recovers').name = 'Caso editado';
  const upgraded = boot(html, saved);
  const actual = JSON.parse(upgraded.storage.get('flujo-project:solicitudes-demo'));
  assert.equal(actual.cases.find(item => item.id === 'retry-recovers').name, 'Caso editado');
  assert.equal(actual.cases.filter(item => item.id === 'retry-limit').length, 1);
  const reloaded = boot(html, actual);
  assert.equal(reloaded.run('window.__prototypeTestApi.project.cases.length'), 16);
});

test('autonomous simulator supports a generic approval flow outside the real estate example', () => {
  const page = boot();
  const graph = {
    nodes: [
      { id: 'in', kind: 'input', title: 'Recibir monto', requiredFields: ['monto'], optionalFields: [], inputSchema: { monto: { type: 'number' } }, allowAdditional: false },
      { id: 'check', kind: 'condition', title: '¿Supera el mínimo?', field: 'monto', operator: 'gte', value: '1000' },
      { id: 'yes', kind: 'output', title: 'Aprobar', message: 'Aprobado' },
      { id: 'no', kind: 'output', title: 'Revisar', message: 'Requiere revisión' }
    ],
    edges: [
      { from: 'in', to: 'check', when: 'next' },
      { from: 'check', to: 'yes', when: 'yes' },
      { from: 'check', to: 'no', when: 'no' }
    ],
    blockDefinitions: [], subflows: [], cases: []
  };
  page.run(`Object.assign(window.__prototypeTestApi.project,${JSON.stringify(graph)})`);
  const approved = page.run('window.__prototypeTestApi.simulate({monto:1500})');
  const review = page.run('window.__prototypeTestApi.simulate({monto:400})');
  assert.equal(approved.error, null);
  assert.equal(approved.output.flowData.respuesta, 'Aprobado');
  assert.deepEqual(JSON.parse(JSON.stringify(approved.visited)), ['Recibir monto', '¿Supera el mínimo?', 'Aprobar']);
  assert.equal(review.error, null);
  assert.equal(review.output.flowData.respuesta, 'Requiere revisión');
  assert.deepEqual(JSON.parse(JSON.stringify(review.visited)), ['Recibir monto', '¿Supera el mínimo?', 'Revisar']);
  page.run(`const [input, condition] = window.__prototypeTestApi.project.nodes;
    input.requiredFields=[]; input.inputSchema={}; input.optionalFields=['monto']; condition.value='0';`);
  for (const monto of [null, false, '', [], 'Infinity']) {
    assert.equal(page.run(`window.__prototypeTestApi.simulate(${JSON.stringify({ monto })})`).output.flowData.respuesta, 'Requiere revisión');
  }
  assert.equal(page.run('window.__prototypeTestApi.simulate({monto:"0"})').output.flowData.respuesta, 'Aprobado');
});

test('a cycle may revisit a condition once a transformation changes the branch', () => {
  const page = boot();
  const graph = {
    nodes: [
      { id: 'in', kind: 'input', title: 'Entrada' },
      { id: 'ready', kind: 'condition', title: '¿Enviado?', field: 'enviado', operator: 'eq', value: 'true' },
      { id: 'send', kind: 'operation', title: 'Enviar', simulatedOutput: { enviado: true } },
      { id: 'out', kind: 'output', title: 'Confirmar envío' }
    ],
    edges: [
      { from: 'in', to: 'ready', when: 'next' },
      { from: 'ready', to: 'send', when: 'no' },
      { from: 'send', to: 'ready', when: 'next' },
      { from: 'ready', to: 'out', when: 'yes' }
    ]
  };
  const api = 'window.__prototypeTestApi';
  page.run(`Object.assign(${api}.project,${JSON.stringify(graph)})`);
  const result = page.run(`${api}.simulate({})`);
  assert.equal(result.error, null);
  assert.equal(result.completed, true);
  assert.equal(result.visited.at(-1), 'Confirmar envío');
  page.run(`${api}.project.nodes[2].simulatedOutput.enviado=false`);
  assert.match(page.run(`${api}.simulate({})`).error, /ciclo sin progreso/);
});

test('resuming a wait permits a new message even when the graph resets the turn counter', () => {
  const page = boot();
  const graph = {
    nodes: [
      { id: 'in', kind: 'input', title: 'Entrada' },
      { id: 'wait', kind: 'wait', title: 'Esperar' },
      { id: 'reset', kind: 'operation', title: 'Reiniciar', action: 'resetCounter', field: 'turnosUsuario' },
      { id: 'check', kind: 'condition', title: '¿Confirmado?', field: 'ok', operator: 'eq', value: 'true' },
      { id: 'out', kind: 'output', title: 'Confirmar' }
    ],
    edges: [
      { from: 'in', to: 'wait', when: 'next' },
      { from: 'wait', to: 'reset', when: 'next' },
      { from: 'reset', to: 'check', when: 'next' },
      { from: 'check', to: 'wait', when: 'no' },
      { from: 'check', to: 'out', when: 'yes' }
    ]
  };
  const api = 'window.__prototypeTestApi';
  page.run(`Object.assign(${api}.project,${JSON.stringify(graph)})`);
  const result = page.run(`${api}.simulate({},[{ok:false},{ok:true}])`);
  assert.equal(result.error, null);
  assert.equal(result.completed, true);
  assert.equal(result.visited.at(-1), 'Confirmar');
});

test('cases compare JSON objects by content and preserve array order', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const check = {
    input: { idSolicitud: 'REQ-104', clienteId: 'CLI-88', prueba: { a: 1, b: [2, 3] } },
    path: 'output.initialUserMessage.prueba',
    expected: { b: [2, 3], a: 1 }
  };
  assert.equal(page.run(`${api}.expectedCase(${JSON.stringify(check)}).passed`), true);
  check.expected.b.reverse();
  assert.equal(page.run(`${api}.expectedCase(${JSON.stringify(check)}).passed`), false);
});

test('the standalone connection panel leaves an occupied route unchanged', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const initial = page.run(`${api}.project.edges.length`);
  page.element('#addConnection').onclick();
  assert.equal(page.run(`${api}.project.edges.length`), initial);
  assert.match(page.element('#toast').textContent, /Todas las salidas/);
  page.run(`${api}.project.edges.push({...(${api}.project.edges[0]),to:'n-count'})`);
  assert.match(page.run(`${api}.simulate({}).error`), /más de una conexión para la ruta «next»/);
});

test('user message contract checks required, optional, typed, and additional fields', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const graph = {
    nodes: [
      { id: 'in', kind: 'input', title: 'Mensaje inicial', requiredFields: ['requestId'], optionalFields: ['locale'], inputSchema: { requestId: { type: 'string' }, locale: { type: 'string' } }, allowAdditional: true },
      { id: 'out', kind: 'output', title: 'Aceptado', message: 'Recibido' }
    ],
    edges: [{ from: 'in', to: 'out', when: 'next' }],
    blockDefinitions: [], subflows: [], cases: []
  };
  page.run(`Object.assign(${api}.project,${JSON.stringify(graph)})`);

  const valid = page.run(`${api}.simulate({requestId:'R-1',locale:'es',traceId:'T-9'})`);
  assert.equal(valid.error, null);
  assert.equal(valid.output.initialUserMessage.traceId, 'T-9');
  assert.equal(valid.validation.admiteCamposExtra, true);

  const withoutOptional = page.run(`${api}.simulate({requestId:'R-2'})`);
  assert.equal(withoutOptional.error, null);

  const missing = page.run(`${api}.simulate({locale:'es'})`);
  assert.match(missing.error, /Falta el campo obligatorio «requestId»/);
  const wrongType = page.run(`${api}.simulate({requestId:'R-1',locale:7})`);
  assert.match(wrongType.error, /«locale» debe ser de tipo string/);
  const nullOptional = page.run(`${api}.simulate({requestId:'R-1',locale:null})`);
  assert.match(nullOptional.error, /«locale» debe ser de tipo string/);

  page.run(`${api}.project.nodes[0].allowAdditional=false`);
  const extraRejected = page.run(`${api}.simulate({requestId:'R-1',traceId:'T-9'})`);
  assert.match(extraRejected.error, /«traceId» no está admitido por el contrato/);
  assert.equal(extraRejected.validation.admiteCamposExtra, false);
  assert.match(page.run(`${api}.simulate({requestId:'R-1',respuesta:'externa'})`).error,
    /«respuesta» no está admitido por el contrato/);

  page.run(`${api}.project.nodes[0].requiredFields=['constructor']`);
  assert.match(page.run(`${api}.simulate({})`).error, /Falta el campo obligatorio «constructor»/);
  assert.equal(page.run(`${api}.simulate({constructor:'propio'})`).error, null);
  page.run(`${api}.project.nodes[0].inputSchema={importe:null}`);
  assert.match(page.run(`${api}.simulate({constructor:'propio',importe:10})`).error, /Esquema inválido para «importe»/);
  page.run(`${api}.project.nodes[0].requiredFields={};`);
  assert.match(page.run(`${api}.simulate({})`).error, /campos obligatorios como una lista/);
});

test('followup message contracts enforce required, optional, typed, and additional fields', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const graph = {
    nodes: [
      { id: 'in', kind: 'input', title: 'Inicio', requiredFields: [], optionalFields: [], inputSchema: {}, allowAdditional: true },
      { id: 'prompt', kind: 'output', title: 'Pedir dato', message: 'Responde para continuar.' },
      { id: 'wait', kind: 'wait', title: 'Recibir respuesta', requiredFields: ['texto'], optionalFields: ['clienteId'], inputSchema: { texto: { type: 'string' }, clienteId: { type: 'string' } }, allowAdditional: false },
      { id: 'out', kind: 'output', title: 'Continuar', message: 'Respuesta recibida.' }
    ],
    edges: [
      { from: 'in', to: 'prompt', when: 'next' },
      { from: 'prompt', to: 'wait', when: 'next' },
      { from: 'wait', to: 'out', when: 'next' }
    ],
    blockDefinitions: [], subflows: [], cases: []
  };
  page.run(`Object.assign(${api}.project,${JSON.stringify(graph)})`);

  const valid = page.run(`${api}.simulate({},[{texto:'Soy CLI-88',clienteId:'CLI-88'}])`);
  assert.equal(valid.error, null);
  assert.equal(valid.completed, true);
  assert.deepEqual(JSON.parse(JSON.stringify(valid.output.latestUserMessage)), { texto: 'Soy CLI-88', clienteId: 'CLI-88' });
  assert.equal(valid.output.internalState.turnosUsuario, 2);
  const withoutOptional = page.run(`${api}.simulate({},[{texto:'Continuo sin compartir clienteId'}])`);
  assert.equal(withoutOptional.error, null);

  const missing = page.run(`${api}.simulate({},[{clienteId:'CLI-88'}])`);
  assert.match(missing.error, /Falta el campo obligatorio «texto»/);
  const wrongType = page.run(`${api}.simulate({},[{texto:23}])`);
  assert.match(wrongType.error, /«texto» debe ser de tipo string/);
  const extraRejected = page.run(`${api}.simulate({},[{texto:'hola',traceId:'T-1'}])`);
  assert.match(extraRejected.error, /«traceId» no está admitido por el contrato/);

  page.run(`${api}.project.nodes.find(n=>n.id==='wait').allowAdditional=true`);
  const extraAllowed = page.run(`${api}.simulate({},[{texto:'hola',traceId:'T-1'}])`);
  assert.equal(extraAllowed.error, null);
  assert.equal(extraAllowed.output.latestUserMessage.traceId, 'T-1');
});

test('internal retry state is separate from user-supplied JSON fields', () => {
  const page = boot();
  const result = page.run("window.__prototypeTestApi.simulate({idSolicitud:'REQ-104',intentosSinIdentificacion:99})");
  assert.equal(result.error, null);
  assert.equal(result.output.initialUserMessage.intentosSinIdentificacion, 99);
  assert.equal(result.output.internalState.intentosSinIdentificacion, 1);
  assert.notEqual(result.output.internalState.intentosSinIdentificacion, result.output.initialUserMessage.intentosSinIdentificacion);
});

test('open questions display the facts and constraints next to their related subflow', () => {
  const page = boot();
  page.run('window.__prototypeTestApi.renderQuestions()');
  const html = page.element('#questionsList').innerHTML;
  assert.match(html, /Subflujo relacionado: Validar identidad del cliente/);
  const identityQuestion = html.slice(html.indexOf('q-identity-source'), html.indexOf('</article>'));
  assert.match(identityQuestion, /No exponer datos de la solicitud antes de validar identidad/);
  assert.match(identityQuestion, /Fuente de datos y criterios de coincidencia/);
  assert.match(identityQuestion, /option value="open" selected/);
});

test('exported HTML embeds project state and reopens without external resources', async () => {
  const page = boot();
  const project = page.run('window.__prototypeTestApi.project');
  project.name = 'Proyecto portable';
  project.description = 'Descripción de prueba';
  project.notes = [{ id: 'nota-1', x: 30, y: 40, text: 'Regla para validar' }];
  project.openQuestions = [{ id: 'q1', title: 'Decisión pendiente', known: ['Dato conocido'], constraints: ['Límite'], unknowns: ['Pregunta'], status: 'open' }];
  project.blockDefinitions.push({ id: 'custom-discount', name: 'Aplicar descuento', inputs: ['monto'], outputs: ['total'], rules: ['total = monto * tasa'], simulation: { total: 90 } });
  project.nodes.push({ id: 'custom-discount-node', kind: 'custom', blockId: 'custom-discount', title: 'Aplicar descuento', x: 980, y: 540 });
  const nodes = project.nodes.length, edges = project.edges.length, subflows = project.subflows.length;
  page.element('#exportHtmlButton').onclick();
  assert.equal(page.downloads.length, 1);
  const exported = await page.downloads[0].text();
  assert.doesNotMatch(exported, /<(?:script|link)[^>]+(?:src|href)=/i);

  const reopened = boot(exported);
  const restored = reopened.run('window.__prototypeTestApi.project');
  assert.equal(restored.name, 'Proyecto portable');
  assert.equal(restored.description, 'Descripción de prueba');
  assert.equal(restored.nodes.length, nodes);
  assert.equal(restored.edges.length, edges);
  assert.equal(restored.subflows.length, subflows);
  assert.equal(restored.notes[0].text, 'Regla para validar');
  assert.equal(restored.openQuestions[0].constraints[0], 'Límite');
  assert.equal(restored.cases.length, 16);
  assert.ok(restored.blockDefinitions.some(block => block.id === 'lookup-request'));
  assert.deepEqual(JSON.parse(JSON.stringify(restored.blockDefinitions.find(block => block.id === 'custom-discount').simulation)), { total: 90 });
  assert.deepEqual(JSON.parse(JSON.stringify(restored.nodes.find(node => node.id === 'custom-discount-node'))), { id: 'custom-discount-node', kind: 'custom', blockId: 'custom-discount', title: 'Aplicar descuento', x: 980, y: 540 });
});

test('organizing the canvas removes unreachable nodes while preserving reusable definitions', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  page.run(`${api}.project.blockDefinitions.push({id:'orphan-definition',name:'Bloque aislado',inputs:[],outputs:[],simulation:{}})`);
  page.run(`${api}.project.nodes.push({id:'orphan',kind:'custom',blockId:'orphan-definition',title:'Bloque aislado'})`);
  page.run(`${api}.project.edges.push({from:'orphan',to:'n-result',when:'next'})`);
  assert.equal(page.run(`${api}.auditGraph().detached.some(node=>node.id==='orphan')`), true);
  page.run(`${api}.organizeFlow()`);
  assert.equal(page.run(`${api}.project.nodes.some(node=>node.id==='orphan')`), false);
  assert.equal(page.run(`${api}.project.edges.some(edge=>edge.from==='orphan'||edge.to==='orphan')`), false);
  assert.equal(page.run(`${api}.project.blockDefinitions.some(block=>block.id==='orphan-definition')`), true);
  assert.equal(page.run(`${api}.project.archivedNodes[0].nodes[0].title`), 'Bloque aislado');
  page.run(`${api}.restoreArchivedNodes()`);
  assert.equal(page.run(`${api}.project.nodes.some(node=>node.id==='orphan')`), true);
  assert.equal(page.run(`${api}.project.edges.some(edge=>edge.from==='orphan'&&edge.to==='n-result')`), true);
  assert.equal(page.run(`${api}.project.archivedNodes.length`), 0);
});

test('subflow input contracts and invalid graph connections are visible to simulation', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  const graph = {
    nodes: [
      { id: 'in', kind: 'input', title: 'Entrada', requiredFields: [], optionalFields: [], inputSchema: {}, allowAdditional: true },
      { id: 'custom', kind: 'custom', title: 'Bloque propio', blockId: 'custom-contract', subflowId: 'subflow-contract' },
      { id: 'out', kind: 'output', title: 'Resultado', message: 'Terminado' }
    ],
    edges: [{ from: 'in', to: 'custom', when: 'next' }, { from: 'custom', to: 'out', when: 'next' }],
    blockDefinitions: [{ id: 'custom-contract', name: 'Bloque propio', inputs: [], outputs: [], simulation: {} }],
    subflows: [{ id: 'subflow-contract', name: 'Subflujo propio', inputs: ['datoNecesario'], outputs: ['resultado'], simulationResult: { resultado: 'ok' } }],
    cases: []
  };
  page.run(`Object.assign(${api}.project,${JSON.stringify(graph)})`);
  const missingSubflowInput = page.run(`${api}.simulate({})`);
  assert.match(missingSubflowInput.error, /datoNecesario/);
  const valid = page.run(`${api}.simulate({datoNecesario:"valor"})`);
  assert.equal(valid.error, null);
  assert.equal(valid.output.flowData.resultado, 'ok');

  page.run(`${api}.project.edges.push({from:'in',to:'missing-node',when:'next'})`);
  const audit = page.run(`${api}.auditGraph()`);
  assert.equal(audit.invalidEdges.length, 1);
  page.run(`${api}.render()`);
  assert.match(page.element('#flowStatus').textContent, /conexión.*bloques inexistentes/);
  const nodeCount = page.run(`${api}.project.nodes.length`);
  page.run(`${api}.organizeFlow()`);
  assert.equal(page.run(`${api}.project.nodes.length`), nodeCount);
  const invalid = page.run(`${api}.simulate({datoNecesario:"valor"})`);
  assert.match(invalid.error, /conexión.*bloques inexistentes/);
});

test('rendered nodes expose connected result outputs, yes/no outputs, and a dedicated return port', () => {
  const page = boot();
  const api = 'window.__prototypeTestApi';
  page.run(`${api}.render()`);
  const nodes = page.element('#nodes').innerHTML;
  const connectedResult = nodes.split('data-id="n-ask"')[1].split('</article>')[0];
  const terminalResult = nodes.split('data-id="n-result"')[1].split('</article>')[0];
  const condition = nodes.split('data-id="n-check"')[1].split('</article>')[0];
  assert.match(condition, /node-port in back connected/);
  assert.match(connectedResult, /node-port out connected/);
  assert.doesNotMatch(terminalResult, /node-port out/);
  assert.equal((condition.match(/node-port out/g) || []).length, 2);
  assert.match(condition, /Sí/);
  assert.match(condition, /No/);
  assert.match(condition, /node-port out connected" data-edges="1"/);
  assert.match(condition, /node-port out connected" data-edges="2"/);
  assert.match(condition, /node-port in back connected" data-edges="16"/);
});

test('standalone branch labels sit beside their corresponding switch output ports', () => {
  const page = boot();
  const markup = page.element('#nodes').innerHTML.split('data-id="n-lookup-result"')[1].split('</article>')[0];
  const branchRows = [...markup.matchAll(/<div class="branch-row" data-tone="([^"]+)"><span class="node-port-label">([^<]+)<\/span><span class="node-port out connected" data-edges="(\d+)" data-tone="\1"/g)];
  assert.deepEqual(Object.fromEntries(branchRows.map(([, , label, edge]) => [edge, label])), {
    9: 'Encontrada', 10: 'No encontrada', 11: 'Error tecnico', 18: 'Por defecto'
  });
});

test('orthogonal routing goes around an intervening block without losing either endpoint', () => {
  const page = boot();
  const result = page.run(`window.__prototypeTestApi.routeConnections([
    {id:'source',left:10,right:60,top:40,bottom:100},
    {id:'obstacle',left:100,right:160,top:40,bottom:100},
    {id:'target',left:200,right:250,top:40,bottom:100}
  ], [{index:0,from:'source',to:'target',ports:[[60,70],[200,70]],terminals:[[73,70],[187,70]],returning:false}])`);
  assert.equal(result.obstructed, 0);
  assert.equal(result.crossings, 0);
  const points = JSON.parse(JSON.stringify(result.routes[0].points));
  assert.deepEqual(points[0], [60, 70]);
  assert.deepEqual(points.at(-1), [200, 70]);
  assert.ok(points.some(([, y]) => y < 40 || y > 100));
  assert.ok(points.slice(1).every(([x, y], index) => x === points[index][0] || y === points[index][1]));
});

test('the canvas flags crossings, overlapping lines, and connections through a block', () => {
  const page = boot();
  const result = page.run(`window.__prototypeTestApi.measureRoutes([
    {index:0,points:[[10,30],[90,30]]},
    {index:1,points:[[40,10],[40,50]]},
    {index:2,points:[[50,30],[100,30]]}
  ], [{id:'obstacle',left:65,right:75,top:25,bottom:35}])`);
  assert.equal(result.crossings, 2);
  assert.equal(result.obstructed, 2);
  assert.deepEqual([...result.conflicts].sort(), [0, 1, 2]);
});

test('large diagrams keep a visible route and report collisions when the routing grid is too large', () => {
  const page = boot();
  const result = page.run(`window.__prototypeTestApi.routeConnections([
    {id:'obstacle',left:100,right:160,top:40,bottom:100},
    ...Array.from({length:120},(_,i)=>({id:'node-'+i,left:300+i*200,right:380+i*200,top:150+i*160,bottom:200+i*160}))
  ], [{index:0,from:'source',to:'target',ports:[[60,70],[200,70]],terminals:[[73,70],[187,70]],returning:false}])`);
  assert.equal(result.routes.length, 1);
  assert.equal(result.obstructed, 1);
  assert.ok(result.conflicts.has(0));
});
