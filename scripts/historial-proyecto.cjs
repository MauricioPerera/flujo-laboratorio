const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const label = {
  nodes: 'Bloques', edges: 'Conexiones', subflows: 'Subflujos', flows: 'Flujos',
  graph: 'Lienzo', blockDefinitions: 'Biblioteca', notes: 'Notas', openQuestions: 'Decisiones pendientes',
  cases: 'Casos', title: 'Nombre', name: 'Nombre', flowName: 'Nombre del flujo', purpose: 'Propósito',
  description: 'Descripción', value: 'Valor', field: 'Campo', operator: 'Regla',
  example: 'Entrada de ejemplo', inputSchema: 'Tipos de entrada', requiredFields: 'Campos obligatorios',
  optionalFields: 'Campos opcionales', message: 'Mensaje de salida', text: 'Texto',
  inputs: 'Entradas', outputs: 'Salidas', simulatedOutput: 'Datos simulados', simulation: 'Datos simulados',
  x: 'Posición horizontal', y: 'Posición vertical'
};
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const named = item => item.title || item.name || item.id;
const hasIds = items => Array.isArray(items) &&
  items.every(item => isRecord(item) && typeof item.id === 'string') &&
  new Set(items.map(item => item.id)).size === items.length;

function diff(before, after, path, segments, changes) {
  if (isDeepStrictEqual(before, after)) return;

  if (hasIds(before) && hasIds(after)) {
    const oldItems = new Map(before.map(item => [item.id, item]));
    const newItems = new Map(after.map(item => [item.id, item]));
    for (const id of new Set([...oldItems.keys(), ...newItems.keys()])) {
      const previous = oldItems.get(id);
      const next = newItems.get(id);
      const member = { id };
      if (!next) {
        const index = before.indexOf(previous);
        Object.assign(member, { index, previous: before[index - 1]?.id, next: before[index + 1]?.id });
      }
      diff(previous, next, [...path, named(next ?? previous)], [...segments, member], changes);
    }
    const oldOrder = before.filter(item => newItems.has(item.id));
    const newOrder = after.filter(item => oldItems.has(item.id));
    if (oldOrder.some((item, i) => item.id !== newOrder[i].id)) {
      changes.push({
        path: [...path, 'Orden'], before: oldOrder.map(named), after: newOrder.map(named),
        target: { segments, order: { before: oldOrder.map(item => item.id), after: newOrder.map(item => item.id) } }
      });
    }
  } else if (isRecord(before) && isRecord(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      diff(Object.hasOwn(before, key) ? before[key] : undefined, Object.hasOwn(after, key) ? after[key] : undefined,
        [...path, Object.hasOwn(label, key) ? label[key] : key], [...segments, { key }], changes);
    }
  } else {
    changes.push({ path, before, after, target: { segments } });
  }
}

function attribute(author, source) {
  if (source === 'viewer') return { type: 'viewer', name: 'Usuario del visor' };
  if (author?.type === 'ai' && typeof author.name === 'string' && author.name.trim()) {
    return { type: 'ai', name: author.name.trim().slice(0, 80) };
  }
  return { type: 'terminal', name: 'Terminal' };
}

function appendHistory(previous, edited, author, source, action) {
  const { storageRevision: _oldRevision, changeHistory, ...before } = previous;
  const { storageRevision: _newRevision, changeHistory: _submittedHistory, ...after } = edited;
  const changes = [];
  diff(before, after, [], [], changes);
  const history = Array.isArray(changeHistory) ? [...changeHistory] : [];
  if (changes.length) {
    history.push({
      id: randomUUID(), at: new Date().toISOString(),
      author: attribute(author, source), changes, ...action
    });
  }
  return history.length ? { ...after, changeHistory: history } : after;
}

function targetLocation(project, segments) {
  let parent = project;
  for (const [index, segment] of segments.entries()) {
    const isList = Array.isArray(parent);
    const key = isList && typeof segment?.id === 'string'
      ? parent.findIndex(item => item?.id === segment.id)
      : isRecord(parent) && typeof segment?.key === 'string' ? segment.key : null;
    if (key === null) break;
    const value = Object.hasOwn(parent, key) ? parent[key] : undefined;
    if (index === segments.length - 1) return { parent, key, value, segment };
    parent = value;
  }
  throw new Error('El campo de este cambio ya no existe.');
}

function revertOrder(list, order) {
  if (!Array.isArray(list) || !Array.isArray(order.before) || !Array.isArray(order.after) ||
      order.before.length !== order.after.length) throw new Error('El orden del registro es inválido.');
  const tracked = new Set(order.after);
  const items = list.filter(item => tracked.has(item?.id));
  if (!isDeepStrictEqual(items.map(item => item.id), order.after)) {
    throw new Error('El orden de estos elementos cambió después. Revisa la entrada más reciente.');
  }
  const byId = new Map(items.map(item => [item.id, item]));
  if (new Set(order.before).size !== tracked.size || !order.before.every(id => tracked.has(id))) {
    throw new Error('El orden anterior es inválido.');
  }
  let cursor = 0;
  for (const [index, item] of list.entries()) {
    if (tracked.has(item?.id)) list[index] = byId.get(order.before[cursor++]);
  }
}

function revertHistoryChange(project, entryId, changeIndex, { redo = false } = {}) {
  const entry = Array.isArray(project.changeHistory) && project.changeHistory.find(item => item?.id === entryId);
  if (redo && typeof entry?.reverts?.entryId !== 'string') {
    throw new Error('Rehacer requiere seleccionar una entrada de reversión.');
  }
  const change = Number.isInteger(changeIndex) && changeIndex >= 0 && entry?.changes?.[changeIndex];
  const segments = change?.target?.segments;
  if (!Array.isArray(segments) || segments.length === 0 ||
      ['changeHistory', 'storageRevision', 'id', 'version'].includes(segments[0]?.key)) {
    throw new Error('Este cambio carece de una referencia que permita revertirlo.');
  }
  const updated = structuredClone(project);
  const { parent, key, value, segment } = targetLocation(updated, segments);
  if (change.target.order) {
    revertOrder(value, change.target.order);
  } else {
    if (!isDeepStrictEqual(value, change.after)) {
      throw new Error('Este campo cambió después. Revisa la entrada más reciente antes de revertirlo.');
    }
    if (Array.isArray(parent)) {
      if (change.before === undefined && key >= 0) parent.splice(key, 1);
      else if (change.before?.id !== segment.id) throw new Error('El elemento anterior del registro es inválido.');
      else if (key >= 0) parent[key] = structuredClone(change.before);
      else {
        const next = parent.findIndex(item => item?.id === segment.next);
        const previous = parent.findIndex(item => item?.id === segment.previous);
        const index = next >= 0 ? next : previous >= 0 ? previous + 1 : segment.index;
        parent.splice(index, 0, structuredClone(change.before));
      }
    } else if (change.before === undefined) {
      delete parent[key];
    } else {
      Object.defineProperty(parent, key, { value: structuredClone(change.before), enumerable: true, writable: true, configurable: true });
    }
  }
  return updated;
}

module.exports = { appendHistory, revertHistoryChange };
