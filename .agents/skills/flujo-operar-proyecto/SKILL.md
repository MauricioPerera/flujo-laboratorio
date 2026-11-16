---
name: flujo-operar-proyecto
description: Trabajar sobre un proyecto HTML de Flujo. Usar para abrir el visor en vivo, crear o editar bloques, flujos, subflujos y casos, simular entradas, inspeccionar el historial, revertir o rehacer un cambio y entregar el HTML exportado.
---

# Operar un proyecto de Flujo

## Elegir el archivo

Ubica el HTML indicado por el usuario. Si empiezas con el editor del repositorio, usa Node.js 24 y ejecuta estos comandos desde la raíz. Crea `.local` solo si falta y elige un nombre de salida libre.

```text
mkdir .local
node scripts/proyecto-html.cjs actualizar-visor dist/prototipo-proyecto.html .local/proyecto.html
node scripts/proyecto-html.cjs previsualizar .local/proyecto.html --sin-abrir
```

El comando de vista local arranca el visor y devuelve la URL y el PID del proceso. Guarda ambos si necesitas verificar o detener ese visor. Abre la URL en el navegador. Omite `--sin-abrir` si quieres que la CLI abra el navegador predeterminado. La vista guarda sobre el HTML que recibió. Para empezar desde cero, pulsa **Nuevo proyecto**, pon nombre al proyecto y al primer flujo y agrega bloques y conexiones. Si ese proyecto nuevo se creó dentro de la vista de otro archivo, usa **Exportar proyecto HTML** para guardarlo en su propio archivo.

## Exportar y volver a abrir

1. En el inspector, guarda el bloque con **Guardar bloque** y comprueba que el lienzo refleje el cambio. Cuando edites en una pestaña `file://`, guarda tus cambios en una copia con **Exportar proyecto HTML**.
2. En la lista de descargas, identifica el archivo que acaba de terminar. Si ya existía una exportación, el navegador puede añadir un sufijo al nombre. Usa la ruta exacta con comillas, incluso si contiene espacios. Ejecuta `node scripts/proyecto-html.cjs leer "ruta/copia.html"` y comprueba el nombre del proyecto y el valor editado en `project`.
3. Si te piden comprobar el archivo sin servidor y arrancaste un visor para esa prueba, verifica que el PID devuelto siga siendo el proceso de ese visor. Detén ese proceso (por ejemplo con `Stop-Process -Id <PID>` en PowerShell o `kill <PID>` en una terminal POSIX) y comprueba que su URL ya no responda. Cerrar la pestaña deja el proceso en marcha.
4. Abre la copia con **Abrir archivo** del navegador (Ctrl+O en Chrome). Si el usuario ya la abrió, toma esa pestaña cuando la herramienta lo permita. Comprueba que la URL sea `file://` y corresponda a la copia. Selecciona el flujo. En **Entrada inicial (JSON)** pega el objeto interno de `input`, por ejemplo `{"idSolicitud":"REQ-104"}`, y pulsa **Iniciar simulación**. Si hay una pausa, **Siguiente mensaje (JSON)** recibe un objeto de `messages` por turno. Para los casos guardados del flujo, usa **Casos → Ejecutar casos**. Deja a la vista el resultado que pidió el usuario.
5. Si la herramienta rechaza la navegación `file://`, indica al usuario qué copia abrir. Cuando confirme que la abrió, usa esa pestaña si el control está disponible. Si la herramienta ordena detenerse, respeta el aviso y sigue su procedimiento de reanudación. La comprobación en navegador sigue pendiente hasta observar el resultado en la pestaña del archivo. Registra por separado cualquier comprobación hecha con `leer` y `ejecutar`.
6. Si el usuario pide encender el visor, ejecuta `node scripts/proyecto-html.cjs previsualizar "ruta/copia.html" --sin-abrir` sobre la copia exportada. Abre la URL devuelta, usa las mismas entradas y comprueba la rama y el resultado. Si te piden dejarlo abierto, mantén la pestaña y el proceso en marcha.

## Editar y simular

1. Crea un JSON temporal UTF-8 en una carpeta local, por ejemplo con `node scripts/proyecto-html.cjs leer ruta/proyecto.html .local/edicion.json`. Crea `.local/` si falta. Edita `project` y conserva `revision`. Usa los IDs existentes para localizar bloques, flujos y subflujos.
2. Añade `"author":{"type":"ai","name":"Nombre del agente"}` al mismo nivel que `project` y `revision`.
3. Ejecuta `node scripts/proyecto-html.cjs guardar ruta/proyecto.html .local/edicion.json`. Si el HTML cambió, léelo de nuevo con otra ruta de extracción y vuelve a aplicar únicamente la edición solicitada. Para entregar una copia, añade su ruta como último argumento.
4. Prepara `solicitud.json`. Toma los campos y tipos del bloque de entrada y, si hay una pausa, los del bloque **Esperar respuesta**. En el ejemplo de solicitudes puedes usar `{"input":{"idSolicitud":"REQ-104","clienteId":"CLI-88"}}` o enviar la identificación después con `{"input":{"idSolicitud":"REQ-104"},"messages":[{"texto":"Mi número es CLI-88","clienteId":"CLI-88"}]}`. Ejecuta `node scripts/proyecto-html.cjs ejecutar "ruta/proyecto.html" "solicitud.json"`. La CLI toma el modelo del HTML y lo simula con el motor del repositorio. `flowId` selecciona un flujo adicional y `subflowId` un subflujo. Revisa `visited`, `output`, `error`, `completed` y `pending`; el código de salida del comando por sí solo no indica si el flujo completó el caso.
5. Verifica un caso que cambie con tu edición y uno comparable que conserve el comportamiento esperado. Comprueba la rama recorrida y el resultado. Abre el visor cuando el usuario necesite ver el cambio.

## Consultar el historial

`leer` devuelve el historial en `project.changeHistory`. Para revertir o rehacer, prepara un JSON con la revisión actual, el `entryId`, el índice `changeIndex` desde cero y `author`. Ejecuta `revertir` con la entrada que contiene el cambio. Ejecuta `rehacer` con la entrada de reversión. La CLI valida que el campo conserve el valor esperado.

Para comprobar todo el recorrido del ejemplo integrado, consulta [Sistema de solicitudes](../../../EXAMPLE_REQUESTS.md).
