---
name: flujo-operar-proyecto
description: Trabajar sobre un proyecto HTML de Flujo. Usar para abrir el visor en vivo, crear o editar bloques, flujos, subflujos y casos, simular entradas, inspeccionar el historial, revertir o rehacer un cambio y entregar el HTML exportado.
---

# Operar un proyecto de Flujo

## Elegir el archivo

1. Ubica el HTML de trabajo indicado por el usuario. Si el encargo parte del ejemplo, crea una copia con el [inicio rápido](../../../README.md#iniciar).
2. Ejecuta desde la raíz del repositorio. Lee el proyecto antes de elegir un flujo o subflujo.

```text
node scripts/proyecto-html.cjs leer ruta/proyecto.html
node scripts/proyecto-html.cjs previsualizar ruta/proyecto.html --sin-abrir
node scripts/proyecto-html.cjs ejecutar ruta/proyecto.html solicitud.json
```

El visor guarda sobre el HTML que recibió. `--sin-abrir` devuelve su URL para abrirla con la herramienta de navegador disponible. Si entregas un visor abierto, verifica que la URL funcione y deja en marcha ese proceso.

## Editar y simular

1. Crea un JSON temporal UTF-8 en una carpeta local, por ejemplo con `node scripts/proyecto-html.cjs leer ruta/proyecto.html .local/edicion.json`. Crea `.local/` si falta. Edita `project` y conserva `revision`. Usa los IDs existentes para localizar bloques, flujos y subflujos.
2. Añade `"author":{"type":"ai","name":"Nombre del agente"}` al mismo nivel que `project` y `revision`.
3. Ejecuta `node scripts/proyecto-html.cjs guardar ruta/proyecto.html .local/edicion.json`. Si el HTML cambió, léelo de nuevo con otra ruta de extracción y vuelve a aplicar únicamente la edición solicitada. Para entregar una copia, añade su ruta como último argumento.
4. Prepara `solicitud.json` como `{"input":{"idSolicitud":"REQ-104","clienteId":"CLI-88"}}` si usas el ejemplo de solicitudes. Emplea la entrada y los tipos del proyecto elegido. `flowId` selecciona un flujo adicional, `subflowId` un subflujo y `messages` aporta respuestas posteriores. Revisa `visited`, `output`, `error`, `completed` y `pending`.
5. Verifica un caso que cambie con tu edición y uno comparable que conserve el comportamiento esperado. Comprueba la rama recorrida y el resultado. Abre el visor cuando el usuario necesite ver el cambio.

## Consultar el historial

`leer` devuelve el historial en `project.changeHistory`. Para revertir o rehacer, prepara un JSON con la revisión actual, el `entryId`, el índice `changeIndex` desde cero y `author`. Ejecuta `revertir` con la entrada que contiene el cambio. Ejecuta `rehacer` con la entrada de reversión. La CLI valida que el campo conserve el valor esperado.

Para comprobar todo el recorrido del ejemplo integrado, consulta [Sistema de solicitudes](../../../EXAMPLE_REQUESTS.md).
