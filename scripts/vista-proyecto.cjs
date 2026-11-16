const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { watchFile, unwatchFile } = require('node:fs');
const { createServer } = require('node:http');
const { readHtml, validateProject, renderHtml, writeHtml, applyHistoryHtml, enginePath } = require('./proyecto-html.cjs');

const host = '127.0.0.1';
const configMarker = '<!-- PROJECT PREVIEW CONFIG -->';
const maxSaveBytes = 16 * 1024 * 1024;

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));
}

async function readSave(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxSaveBytes) throw new Error('El proyecto supera el tamaño admitido.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function openBrowser(url) {
  const [command, args] = process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const browser = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
  browser.on('error', () => {});
  browser.unref();
}

function launchPreview(file, open) {
  return new Promise((resolve, reject) => {
    const worker = spawn(process.execPath, [__filename, file], {
      detached: true, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    const timeout = setTimeout(() => {
      worker.kill();
      reject(new Error('La vista en vivo no arrancó a tiempo.'));
    }, 5000);
    worker.once('error', error => { clearTimeout(timeout); reject(error); });
    worker.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error('La vista en vivo terminó al iniciar (' + code + ').'));
    });
    worker.once('message', result => {
      clearTimeout(timeout);
      worker.disconnect();
      worker.unref();
      if (result.error) {
        reject(new Error(result.error));
        return;
      }
      if (open) openBrowser(result.url);
      resolve(result);
    });
  });
}

function serveProject(file) {
  const template = readHtml(enginePath);
  if (!template.source.includes(configMarker)) throw new Error('Falta la configuración del visor en vivo.');
  let snapshot = readHtml(file);
  validateProject(snapshot.project);
  const { id, version } = snapshot.project;
  const token = randomUUID();
  const route = '/' + token + '/';
  const config = { id: token, events: route + 'eventos', save: route + 'guardar', revert: route + 'revertir', redo: route + 'rehacer' };
  const clients = new Set();
  let waitingForFile = false;
  let sequence = 0;

  function currentModel() {
    return { project: snapshot.project, revision: snapshot.revision, sequence };
  }

  function send(response, event, value) {
    response.write('event: ' + event + '\ndata: ' + JSON.stringify(value) + '\n\n');
  }
  function publish() {
    try {
      const next = readHtml(file);
      if (!waitingForFile && next.revision === snapshot.revision) return;
      validateProject(next.project);
      if (next.project.id !== id || next.project.version !== version) {
        throw new Error('El archivo ahora corresponde a otro proyecto o versión.');
      }
      if (next.revision !== snapshot.revision) sequence++;
      snapshot = next;
      waitingForFile = false;
      for (const client of clients) send(client, 'proyecto', currentModel());
    } catch {
      if (waitingForFile) return;
      waitingForFile = true;
      for (const client of clients) send(client, 'aviso', 'Esperando una versión válida del mismo proyecto.');
    }
  }

  async function saveFromViewer(request, response, address) {
    if (request.headers.origin !== 'http://' + address ||
        request.headers['content-type']?.split(';')[0] !== 'application/json') {
      sendJson(response, 403, { error: 'El guardado solo está disponible desde este visor.' });
      return;
    }
    if (Number(request.headers['content-length']) > maxSaveBytes) {
      sendJson(response, 413, { error: 'El proyecto supera el tamaño admitido.' });
      return;
    }
    let edit;
    try {
      edit = await readSave(request);
      if (typeof edit?.revision !== 'string') throw new Error('Falta la revisión que se está editando.');
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }
    publish();
    if (waitingForFile) {
      sendJson(response, 503, { error: 'El HTML en disco todavía no se puede actualizar.' });
      return;
    }
    try {
      if (request.url === config.save) writeHtml(file, snapshot, edit, undefined, { source: 'viewer' });
      else applyHistoryHtml(file, snapshot, edit, { source: 'viewer', redo: request.url === config.redo });
      publish();
      sendJson(response, 200, currentModel());
    } catch (error) {
      if (error.code === 'REVISION_CONFLICT') {
        publish();
        sendJson(response, 409, currentModel());
      } else if (error.code === 'EEXIST') {
        sendJson(response, 423, { error: 'Otro guardado está en curso.' });
      } else {
        sendJson(response, 400, { error: error.message });
      }
    }
  }

  // Poll the path so atomic replacement stays observable on Windows.
  watchFile(file, { interval: 250 }, publish);
  publish();

  const server = createServer((request, response) => {
    const address = host + ':' + server.address().port;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.headers.host !== address) {
      response.writeHead(403).end();
      return;
    }
    if (request.method === 'POST' && [config.save, config.revert, config.redo].includes(request.url)) {
      void saveFromViewer(request, response, address);
      return;
    }
    if (request.method !== 'GET') {
      response.writeHead(405).end();
      return;
    }
    if (request.url === config.events) {
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
      response.write('retry: 800\n\n');
      send(response, 'proyecto', currentModel());
      clients.add(response);
      response.once('close', () => clients.delete(response));
      return;
    }
    if (request.url !== route) {
      response.writeHead(404).end();
      return;
    }
    const injection = '<script id="projectPreview" type="application/json">' + JSON.stringify(config) + '</script>';
    const page = renderHtml(template, snapshot.project).replace(configMarker, () => injection);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "frame-ancestors 'none'"
    }).end(page);
  });
  server.on('close', () => unwatchFile(file, publish));
  server.once('error', error => {
    unwatchFile(file, publish);
    process.send?.({ error: error.message });
    process.exitCode = 1;
  });
  server.listen(0, host, () => process.send?.({
    url: 'http://' + host + ':' + server.address().port + route,
    proyecto: snapshot.project.name,
    pid: process.pid
  }));
}

module.exports = { launchPreview };

if (require.main === module) {
  try {
    serveProject(process.argv[2]);
  } catch (error) {
    process.send?.({ error: error.message });
    process.exitCode = 1;
  }
}
