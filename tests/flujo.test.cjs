'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const dist = join(__dirname, '..', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const stylesheet = readFileSync(join(dist, 'style.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(([, file]) => file);
const data = value => JSON.parse(JSON.stringify(value));

class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [2030, 0, 1, 12])); }
  static now() { return new FixtureDate().getTime(); }
}

// Load the application's real scripts in page order with isolated storage.
function boot(values = {}) {
  const storage = new Map(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]));
  const networkAttempts = [];
  const blockNetwork = name => (...args) => { networkAttempts.push({ name, args }); throw new Error('Outbound network blocked by test harness.'); };
  const blockedConstructor = name => class { constructor(...args) { networkAttempts.push({ name, args }); throw new Error('Outbound network blocked by test harness.'); } };
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, {
        dataset: {}, style: {}, value: '', innerHTML: '', clientWidth: 900,
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener(type, listener) { if (type === 'click') this.onclick = listener; }, scrollTo() {},
        insertAdjacentHTML() {},
        querySelector: name => element(selector + ' ' + name),
        querySelectorAll: () => []
      });
    }
    return elements.get(selector);
  }
  const window = { addEventListener() {} };
  const downloads = [];
  let pendingDownloadBlob = null;
  const context = vm.createContext({
    document: {
      addEventListener() {},
      querySelector: selector => selector.startsWith('.node[data-id=') ? null : element(selector),
      body: { appendChild() {} },
      createElement() { return { click() { downloads.push({ name: this.download, blob: pendingDownloadBlob }); }, remove() {} }; }
    },
    window, localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    Date: FixtureDate, TextEncoder, structuredClone, crypto: require('node:crypto').webcrypto,
    Blob, URL: { createObjectURL(blob) { pendingDownloadBlob = blob; return 'blob:test'; }, revokeObjectURL() {} },
    fetch: blockNetwork('fetch'), XMLHttpRequest: blockedConstructor('XMLHttpRequest'),
    WebSocket: blockedConstructor('WebSocket'), EventSource: blockedConstructor('EventSource'),
    navigator: { sendBeacon: blockNetwork('navigator.sendBeacon') },
    setTimeout() {}, clearTimeout() {}, confirm: () => true
  });
  for (const file of scripts) vm.runInContext(readFileSync(join(dist, file), 'utf8'), context, { filename: file });
  return { storage, element, downloads, networkAttempts, run: expression => vm.runInContext(expression, context) };
}

function link(...nodes) {
  return {
    nodes: nodes.map((node, i) => ({ title: node.id, x: i * 250, y: 120, ...node })),
    edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id, branch: 'next' }))
  };
}
const input = { type: 'input', id: 'entrada', data: '{}' };
const output = { type: 'output', id: 'salida', message: '' };
const fixture = { today: '2030-01-01', appointments: [] };
const visit = { mensaje: 'Quiero agendar una visita a Casa Arboleda', accion: 'mensaje',
  fecha: '2030-01-02', hora: '10:00', cliente: 'Prueba' };
const legacy = {
  nodes: [{ id: 'v1', type: 'input', title: 'Flujo original editado', x: 20, y: 55, data: '{}' }],
  edges: []
};
const scenario = { id: 'igualdad', name: 'Objeto completo', input: {}, expected: { path: '$', value: {} }, fixture };

test('labeled routes retain the exact switch and condition port IDs used by the graph', () => {
  const page = boot();
  for (const [type, ports] of [
    ['router', { info: 'Información', visita: 'Visita', falta: 'Sin propiedad', otro: 'Otro' }],
    ['condition', { yes: 'Sí', no: 'No' }]
  ]) {
    const markup = page.run(`renderOutputs({id:'node',type:${JSON.stringify(type)}})`);
    const rows = [...markup.matchAll(/data-branch="([^"]+)"><span class="port-tag">([^<]+)<\/span><div[^>]+data-port="([^"]+)"/g)];
    assert.deepEqual(rows.map(([, branch, label, port]) => [branch, label, port]),
      Object.entries(ports).map(([branch, label]) => [branch, label, branch]));
  }
});

test('restores the original slot alongside the real estate template without overwriting it', () => {
  const page = boot({ 'flujo-v1': legacy, 'flujo-inmobiliaria-v1': link(input, output) });
  assert.equal(page.element('#flowChoice').querySelector('option[value=legacy]').disabled, false);
  page.run("loadTemplate('legacy')");
  assert.equal(page.run('state.nodes[0].title'), 'Flujo original editado');
  page.run("state.nodes[0].title='Recuperado';persist();loadTemplate('old')");
  assert.equal(page.run('state.nodes[0].id'), 'entrada');
  assert.equal(JSON.parse(page.storage.get('flujo-v1')).nodes[0].title, 'Recuperado');
  assert.equal(page.run('activeTemplate'), 'old');
  const emptyPage = boot();
  assert.equal(emptyPage.element('#flowChoice').querySelector('option[value=legacy]').disabled, true);
});

test('successful bookings commit to their own flow; incomplete or failed bookings leave no effects', () => {
  const page = boot({ 'flujo-citas-demo': [{ id: 'anterior' }], 'flujo-historial-v1': [{ name: 'anterior' }] });
  const first = page.run('runFlow(rootState,' + JSON.stringify(visit) + ')');
  assert.equal(first.completed, true);
  assert.equal(page.run('getAppointments().length'), 1);
  assert.equal(first.output.cita.propiedad, 'CASA-01');
  const history = JSON.parse(page.storage.get('flujo-historial-v1:new'));
  assert.ok(history[0].revision.startsWith('motor-2/'));
  assert.equal(history[0].today, fixture.today);
  assert.deepEqual(history[0].initialAppointments, []);
  page.run("loadTemplate('old');renderHistory()");
  assert.equal(page.run('getAppointments().length'), 0);
  assert.match(page.element('#legacyRecords').querySelector('pre').textContent, /anterior/);
  const originalGraph = page.run('rootState');
  const args = { ...visit, accion: 'agendar', propiedad: 'CASA-01' };
  const execute = graph => page.run('runFlow(' + JSON.stringify(graph) + ',' + JSON.stringify(args) + ')');
  const incomplete = structuredClone(originalGraph);
  incomplete.edges = incomplete.edges.filter(edge => edge.from !== 'n5');
  const partial = execute(incomplete);
  assert.equal(partial.completed, false);
  assert.equal(partial.appointments.length, 0);
  const failing = structuredClone(incomplete);
  failing.nodes.push({ id: 'error', type: 'condition', field: 'ausente' });
  failing.edges.push({ from: 'n5', to: 'error', branch: 'next' });
  assert.match(execute(failing).error, /ausente/);
  assert.equal(page.run('getAppointments().length'), 0);
  assert.equal(JSON.parse(page.storage.get('flujo-historial-v1:old')).length, 2);
  assert.equal(JSON.parse(page.storage.get('flujo-historial-v1:new')).length, 1);
  assert.deepEqual(JSON.parse(page.storage.get('flujo-citas-demo')), [{ id: 'anterior' }]);
  page.run("loadTemplate('new')");
  assert.equal(page.run('getAppointments().length'), 1);
});

test('the flow model resumes a pending visit from explicit state and prioritizes a new request', () => {
  const page = boot();
  const pending = { ...visit, mensaje: 'Listo', accion: 'mensaje', intencion_pendiente: 'visita', propiedad_pendiente: 'CASA-01' };
  const resumed = page.run('runFlow(rootState,' + JSON.stringify(pending) + ')');
  assert.equal(resumed.error, null);
  assert.equal(resumed.output.intencion, 'visita');
  assert.equal(resumed.output.cita.propiedad, 'CASA-01');
  const changed = page.run('runFlow(rootState,' + JSON.stringify({ ...pending, mensaje: 'Quiero cancelar mi cita' }) + ')');
  assert.equal(changed.error, null);
  assert.equal(changed.output.intencion, 'otro');
  assert.equal(changed.output.cita, undefined);
  const newRequest = page.run('runFlow(rootState,' + JSON.stringify({ ...pending, mensaje: 'Dame el precio de Departamento Roma' }) + ')');
  assert.equal(newRequest.error, null);
  assert.equal(newRequest.output.intencion, 'informacion');
  assert.equal(newRequest.output.detalle_propiedad.id, 'DEPTO-02');
});

test('main app navigation opens a nested canvas, returns to its parent, and preserves executed subflow edits', () => {
  const page = boot();
  page.run("loadTemplate('new')");
  const rootNodeId = page.run("state.nodes.find(n=>n.type==='subflow').id");
  page.run("selected=" + JSON.stringify(rootNodeId) + ";openSubflow(state.nodes.find(n=>n.id===" + JSON.stringify(rootNodeId) + "))");
  assert.equal(page.run('graphStack.length'), 1);
  assert.equal(page.run("state.nodes.some(n=>n.id==='p3')"), true);
  page.run("state.nodes.find(n=>n.id==='p3').message='Resultado interno actualizado';persist();$('#backFlow').onclick()");
  assert.equal(page.run('state===rootState'), true);
  assert.equal(page.run('graphStack.length'), 0);
  assert.equal(page.run('selected'), rootNodeId);

  page.run("loadTemplate('new')");
  assert.equal(page.run("rootState.nodes.find(n=>n.id===" + JSON.stringify(rootNodeId) + ").flow.nodes.find(n=>n.id==='p3').message"), 'Resultado interno actualizado');
  const run = page.run('runFlow(rootState,' + JSON.stringify({ ...visit, accion: 'informacion', propiedad: 'CASA-01', mensaje: 'Quiero información' }) + ')');
  assert.equal(run.error, null);
  assert.equal(run.completed, true);
  assert.equal(run.output.respuesta, 'Resultado interno actualizado');
});

test('numerical blocks reject non-numeric values while retaining finite numeric strings', () => {
  const page = boot();
  const graph = link(input, { id: 'op', type: 'operation', field: 'valor', operator: 'multiply', operand: '2', target: 'doble' }, output);
  for (const value of [null, '', false, {}, []]) {
    const run = page.run('flowRuntime.run(' + JSON.stringify(graph) + ',{valor:' + JSON.stringify(value) + '})');
    assert.match(run.error, /numéricos/);
  }
  assert.equal(page.run('flowRuntime.run(' + JSON.stringify(graph) + ',{valor:"12"}).output.doble'), 24);
});

test('specification import and export share validation and enforce the round-trip limits', async () => {
  const page = boot();
  page.run("storeExportCases(exampleCases());$('#verifyCases').onclick()");
  const valid = page.run('serializeSpec(createContract())');
  const roundTrip = page.run('parseImportedSpec(JSON.parse(' + JSON.stringify(valid) + '))');
  assert.equal(roundTrip.cases.length, 6);
  assert.ok(page.run('lastVerification.results.every(result=>result.pass)'));
  const spec = { formatVersion: 'flujo-spec/1.0', flow: link(input, output), cases: [scenario] };
  for (const [replace, error] of [
    [{ expected: { path: '', value: {} } }, /cita.cliente/],
    [{ fixture: { ...fixture, today: '2026-02-31' } }, /fecha simulada/],
    [{ fixture: { ...fixture, appointments: [null] } }, /lista de objetos/]
  ]) {
    const malformed = { ...spec, cases: [{ ...scenario, ...replace }] };
    for (const method of ['parseImportedSpec', 'serializeSpec']) {
      assert.throws(() => page.run(method + '(' + JSON.stringify(malformed) + ')'), error);
    }
  }
  assert.throws(() => page.run('storeExportCases(Array(501).fill({}))'), /500 casos/);
  assert.throws(() => page.run('serializeSpec({...createContract(),name:"á".repeat(3*1024*1024)})'), /5 MB/);
  await page.element('#importFile').onchange({ target: { files: [{ size: 512, text: async () => valid }] } });
  page.element('#confirmImport').onclick();
  assert.equal(page.run('activeTemplate'), 'imported');
  assert.equal(page.run('exportCases().length'), 6);
  assert.equal(page.run('getAppointments().length'), 0);
  const firstScope = page.run('flowStorageScope()');
  page.run("saveAppointments([{id:'reservada'}])");
  await page.element('#importFile').onchange({ target: { files: [{ size: 512, text: async () => valid }] } });
  page.element('#confirmImport').onclick();
  assert.notEqual(page.run('flowStorageScope()'), firstScope);
  assert.equal(page.run('getAppointments().length'), 0);
});

test('export controls create runnable specification, model tests, and implementation contract', async () => {
  const page = boot();
  page.run("const cases=exampleCases();cases[0].proposed=cases[2].proposed=false;storeExportCases(cases);$('#verifyCases').onclick()");
  for (const id of ['downloadMarkdown', 'downloadJson', 'downloadTests', 'downloadContractTests', 'downloadAdapter']) page.element('#' + id).onclick();
  assert.deepEqual(page.downloads.map(file => file.name), ['especificacion-flujo.md', 'flujo-especificacion.json', 'flujo.test.cjs', 'contrato.test.cjs', 'adaptador.flujo.cjs']);
  const artifacts = new Map(await Promise.all(page.downloads.map(async file => [file.name, await file.blob.text()])));
  assert.match(artifacts.get('especificacion-flujo.md'), /## Casos de prueba[\s\S]*## Contrato para la implementación/);
  const contract = JSON.parse(artifacts.get('flujo-especificacion.json'));
  assert.equal(contract.cases.length, 6);
  assert.equal(contract.cases.filter(item => !item.proposed).length, 2);
  assert.match(artifacts.get('flujo.test.cjs'), /node:test/);
  assert.match(artifacts.get('contrato.test.cjs'), /FLUJO_ADAPTER/);
  assert.match(artifacts.get('adaptador.flujo.cjs'), /async function ejecutarCaso/);

  const temp = mkdtempSync(join(tmpdir(), 'flujo-export-ui-'));
  const files = [];
  try {
    const modelTests = join(temp, 'flujo.test.cjs');
    files.push(modelTests);
    writeFileSync(modelTests, artifacts.get('flujo.test.cjs'));
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const modelResult = spawnSync(process.execPath, ['--test', '--test-reporter=tap', modelTests], { encoding: 'utf8', env });
    assert.equal(modelResult.status, 0, modelResult.stdout + modelResult.stderr);
    assert.match(modelResult.stdout, /^# tests 6/m);
    const adapter = join(temp, 'adapter.cjs');
    files.push(adapter);
    writeFileSync(adapter, `exports.ejecutarCaso=async({entrada,contexto})=>{
      if(contexto.aislado!==true || contexto.fechaActual!=='2030-01-01') throw Error('Contexto incorrecto');
      const intencion=entrada.mensaje.includes('información')?'informacion':'otro';
      return {salida:{intencion},error:null,completado:true};
    };`);
    const implementationTests = join(temp, 'contrato.test.cjs');
    files.push(implementationTests);
    writeFileSync(implementationTests, artifacts.get('contrato.test.cjs'));
    const contractEnv = { ...env, FLUJO_ADAPTER: adapter };
    const contractResult = spawnSync(process.execPath, ['--test', '--test-reporter=tap', implementationTests], { encoding: 'utf8', env: contractEnv });
    assert.equal(contractResult.status, 0, contractResult.stdout + contractResult.stderr);
    assert.match(contractResult.stdout, /^# tests 3/m);
    writeFileSync(adapter, 'exports.ejecutarCaso=async()=>({salida:{intencion:"informacion"},error:null,completado:true});');
    const constant = spawnSync(process.execPath, ['--test', '--test-reporter=tap', implementationTests], { encoding: 'utf8', env: contractEnv });
    assert.equal(constant.status, 1, constant.stdout + constant.stderr);
    assert.match(constant.stdout, /not ok \d+ - Mensaje fuera de alcance/);
    writeFileSync(adapter, 'exports.ejecutarCaso=async()=>({salida:"otra forma",error:null,completado:true});');
    const wrongShape = spawnSync(process.execPath, ['--test', '--test-reporter=tap', implementationTests], { encoding: 'utf8', env: contractEnv });
    assert.equal(wrongShape.status, 1, wrongShape.stdout + wrongShape.stderr);
    assert.match(wrongShape.stdout, /salida debe ser un objeto JSON o null/);
  } finally {
    for (const file of files) rmSync(file, { force: true });
    rmdirSync(temp);
  }
});

test('test export refuses expectations that disappear or change when serialized', () => {
  const page = boot();
  for (const expected of [
    '{path:"intencion",value:undefined}',
    '{path:"$",value:{campo:undefined}}',
    'Object.defineProperty({path:"intencion"},"value",{value:42})',
    '{path:"$",value:{toJSON:()=>({otro:1})}}'
  ]) {
    page.run(`createContract=()=>({flow:rootState,cases:[{...exampleCases()[0],proposed:false,expected:${expected}}]})`);
    page.element('#downloadTests').onclick();
    page.element('#downloadContractTests').onclick();
    assert.equal(page.downloads.length, 0);
    assert.match(page.element('#specTransferStatus').textContent, /JSON|valor esperado/);
  }
});

test('change comparison detects a different branch between the same two blocks', () => {
  const page = boot();
  const graph = link(input, { type: 'condition', id: 'cond', field: 'dato', comparison: 'eq', value: '1' }, output);
  graph.edges[1].branch = 'yes';
  graph.edges.push({ from: 'cond', to: output.id, branch: 'no' });
  const matching = { ...scenario, input: { dato: 1 }, expected: { path: 'dato', value: 1 } };
  page.run('rootState=' + JSON.stringify(graph) + ';storeExportCases([' + JSON.stringify(matching) + '])');
  page.element('#saveBaseline').onclick();
  page.run("rootState.nodes.find(n=>n.id==='cond').value='2'");
  page.element('#compareBaseline').onclick();
  assert.equal(page.run('lastImpact.results[0].before.pass&&lastImpact.results[0].after.pass'), true);
  assert.equal(page.run('lastImpact.results[0].outputChanged'), false);
  assert.equal(page.run('lastImpact.results[0].routeChanged'), true);
  assert.match(page.element('#impactResults').innerHTML, /Cambi[oó] la ruta recorrida/);
});

test('simulated executions are labeled and make no outbound calls in the model', () => {
  const page = boot();
  page.run('execute()');
  page.run("$('#openHistory').onclick()");
  const record = JSON.parse(page.storage.get('flujo-historial-v1:new'))[0];
  assert.equal(record.simulationOnly, true);
  assert.match(page.element('#historyList').innerHTML, /Simulación ·/);
  assert.match(page.element('#historyList').innerHTML, /datos locales/);

  const contract = JSON.parse(page.run('serializeSpec(createContract())'));
  assert.deepEqual(data(contract.simulation), { only: true, integrations: false, persistence: 'browser-local' });
  assert.match(page.run('markdownSpec(createContract())'), /no ejecuta integraciones productivas/);
  assert.deepEqual(page.networkAttempts, []);
  assert.doesNotMatch(stylesheet, /@import\s+url\s*\(\s*['"]?https?:\/\//i);
});

test('in-browser verification and both generated test files reject different own __proto__ keys', () => {
  const page = boot();
  const graph = link(input, output);
  const bad = { ...scenario, input: JSON.parse('{"__proto__":{"v":1}}'),
    expected: { path: '$', value: JSON.parse('{"__proto__":{"v":2}}') } };
  const good = { ...bad, name: 'Objeto idéntico', id: 'objeto-idéntico', expected: { path: '$', value: bad.input } };
  const expression = value => 'JSON.parse(' + JSON.stringify(JSON.stringify(value)) + ')';
  assert.equal(page.run('compareScenario(' + expression(bad) + ',' + expression(graph) + ').pass'), false);
  assert.equal(page.run('compareScenario(' + expression(good) + ',' + expression(graph) + ').pass'), true);
  assert.deepEqual(data(page.run('caseValue({a:{b:42}},null,"a.b")')), { found: true, value: 42 });
  const temp = mkdtempSync(join(tmpdir(), 'flujo-tests-'));
  const files = [];
  try {
    const adapter = join(temp, 'adapter.cjs');
    files.push(adapter);
    writeFileSync(adapter, 'exports.ejecutarCaso=async ({entrada})=>({salida:entrada,error:null,completado:true});');
    for (const generator of ['portableTestFile', 'systemTestFile']) {
      const artifact = join(temp, generator + '.test.cjs');
      files.push(artifact);
      writeFileSync(artifact, page.run(generator + '(' + expression({ flow: graph, cases: [good, bad] }) + ')'));
      const env = { ...process.env, FLUJO_ADAPTER: adapter };
      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', artifact], { encoding: 'utf8', env });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stdout, /^ok \d+ - Objeto idéntico/m);
      assert.match(result.stdout, /^not ok \d+ - Objeto completo/m);
      assert.match(result.stdout, /Esperado: \{"__proto__":\{"v":2\}\}; obtenido: \{"__proto__":\{"v":1\}\}/);
    }
  } finally {
    for (const file of files) rmSync(file, { force: true });
    rmdirSync(temp);
  }
});
