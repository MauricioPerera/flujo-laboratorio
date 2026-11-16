# Flujo — Laboratorio visual

Plataforma para diseñar y simular flujos de distintos dominios en proyectos HTML editables. El editor original incluye exportación de pruebas de modelo y contratos ejecutables para el ejemplo inmobiliario.

La [especificación de la plataforma](SPECIFICATION.md) describe el ciclo completo. La [matriz de trazabilidad](SPEC_TRACEABILITY.md) documenta la evidencia disponible. Los proyectos incluidos ilustran su uso, entre ellos el [ejemplo autónomo «Sistema de solicitudes»](EXAMPLE_REQUESTS.md).

En [GitHub Pages](https://mauricioperera.github.io/flujo-laboratorio/), el botón **Abrir el editor** te permite cargar el ejemplo «Sistema de solicitudes» o abrir un lienzo en blanco.

## Licencia

Flujo se distribuye bajo la [licencia MIT](LICENSE). Los nuevos HTML exportados incluyen el aviso de licencia del editor y el simulador.

## Iniciar

Usa **Node.js 24**. Desde la raíz, crea una copia del ejemplo y abre su vista en vivo. El primer comando crea una carpeta local para proyectos de trabajo.

```text
mkdir .local
node scripts/proyecto-html.cjs actualizar-visor dist/prototipo-proyecto.html .local/solicitudes.html
node scripts/proyecto-html.cjs previsualizar .local/solicitudes.html
```

Usa otro nombre si ya existe la copia. La CLI abre el navegador con el proyecto cargado. En **Entrada inicial (JSON)** pega `{"idSolicitud":"REQ-104","clienteId":"CLI-88"}` y pulsa **Iniciar simulación**. El resultado debe incluir el estado **En revisión**. El HTML exportado también se puede abrir directamente como archivo, con editor y simulador incorporados.

### Superficies del repositorio

| Entrada | Uso |
|---|---|
| `dist/prototipo-proyecto.html` | Proyectos de cualquier dominio en HTML autónomo. La vista en vivo añade colaboración sobre el mismo archivo e historial de cambios. |
| `dist/index.html` | Editor original con el ejemplo inmobiliario, historial de ejecuciones y exportación de pruebas de modelo y contrato. |

Los agentes pueden comenzar por [AGENTS.md](AGENTS.md). La [guía de reapertura del HTML](.agents/skills/flujo-operar-proyecto/SKILL.md#exportar-y-volver-a-abrir) explica cómo comprobar una descarga, abrirla sin servidor y volver a encender la vista en vivo. Para preparar una versión en GitHub, consulta la [guía de publicación](docs/PUBLICACION.md).

### Crear un proyecto autónomo

Abre el editor autónomo. Pulsa **Nuevo proyecto** y nombra el proyecto y su primer flujo. El lienzo y la biblioteca propia empiezan vacíos. Usa **Nuevo flujo** para añadir otros lienzos, **Bloque comodín** para definir un bloque reutilizable y **Subflujo → Abrir lienzo** para editar un proceso hijo. El inspector permite guardar el contrato de cada bloque y conectar sus salidas.

Los selectores **Proyecto** y **Flujo** permiten cambiar de lienzo. Las definiciones propias se comparten entre los flujos del proyecto. **Exportar proyecto HTML** descarga el proyecto seleccionado con sus flujos, subflujos, biblioteca y editor incorporado.

Si creas otro proyecto dentro de una vista en vivo, expórtalo para conservarlo fuera de esa sesión. Para trabajar sobre su propio archivo, inícialo con `previsualizar`.

### Trabajar con IA sobre el HTML exportado

El agente puede usar `scripts/proyecto-html.cjs` desde este repositorio para leer, editar y simular el archivo sin servidor. El HTML sigue siendo el archivo del proyecto y contiene tanto su modelo como el visor.

Para ver los cambios mientras trabajas con un agente, este puede abrir el proyecto directamente con:

```powershell
node scripts/proyecto-html.cjs previsualizar proyecto.html
```

El comando arranca una vista en vivo en la máquina local y abre el proyecto en el navegador. Las ediciones del proyecto vinculado se guardan automáticamente en el HTML indicado al abrirlo. El estado **Guardado en el HTML** confirma que el agente ya puede leer la revisión. Cuando el agente guarda un cambio, el visor actualiza el lienzo y ejecuta otra vez la última simulación completa con la misma entrada. Las pausas conservan el modelo con que empezaron.

Si el archivo cambió desde que empezaste a editar en el visor, el guardado conserva la revisión más reciente y deja tus cambios pendientes en el visor. Puedes exportar esos cambios antes de aplicar lo guardado en disco. El comando devuelve la URL para abrir la vista en otro navegador con `--sin-abrir`.

```powershell
node scripts/proyecto-html.cjs leer .local/solicitudes.html .local/edicion.json
```

`leer` devuelve `revision` y `project`. Con una ruta de salida crea un JSON UTF-8 para editar, incluso en PowerShell 5.1. El agente edita los datos de `project` en el JSON temporal. `guardar` comprueba la revisión y las referencias de los bloques antes de actualizar los datos embebidos. Con una ruta de salida escribe una copia nueva. Sin esa ruta actualiza el HTML original. El visor conserva su código en ambos casos.

Para probar la copia, guarda este contenido en `.local/solicitud.json`.

```json
{"input":{"idSolicitud":"REQ-104","clienteId":"CLI-88"}}
```

```powershell
node scripts/proyecto-html.cjs guardar .local/solicitudes.html .local/edicion.json .local/proyecto-revisado.html
node scripts/proyecto-html.cjs ejecutar .local/proyecto-revisado.html .local/solicitud.json
```

El ejemplo entrega `output.flowData.estado` con valor `En revisión` mientras el cambio conserve ese comportamiento. Usa rutas de salida nuevas si repites los comandos con archivos que ya existen.

**Historial de cambios** muestra la fecha y hora, el autor declarado y los valores antes y después de cada guardado que cambia el modelo. Se guarda dentro del HTML. Las ediciones en vivo figuran como **Usuario del visor**. Para identificar sus cambios, el agente añade `"author":{"type":"ai","name":"Codex"}` al JSON que entrega a `guardar`, al mismo nivel que `revision` y `project`. El resto de los guardados por ese comando figuran como **Terminal**. El historial empieza con los guardados hechos con esta versión.

En la vista en vivo, abre una entrada de **Historial de cambios** y pulsa **Revertir cambio** junto al campo. El visor restablece el valor anterior si el campo todavía coincide con el valor que dejó esa entrada. El guardado añade una **Reversión** con su autor y fecha, vinculada al cambio original. Los registros anteriores a la función de reversión se pueden consultar. El agente puede revertir con `node scripts/proyecto-html.cjs revertir proyecto.html solicitud.json`, indicando `revision`, `entryId`, `changeIndex` (desde 0) y, si corresponde, `author`.

En una entrada de **Reversión**, pulsa **Rehacer cambio** para aplicar de nuevo el valor del campo. El visor comprueba que el campo conserve el valor de la reversión. Guarda una entrada **Cambio rehecho** con autor, fecha y vínculo a esa reversión. El agente puede usar `node scripts/proyecto-html.cjs rehacer proyecto.html solicitud.json` con el identificador de la reversión.

Cada botón actúa sobre un campo. Si un guardado eliminó un bloque y sus conexiones, restaura primero el bloque y después las conexiones. El editor comprueba que existan los extremos de cada conexión.

`ejecutar` usa el motor del editor local y devuelve recorrido y resultado. `input` contiene los campos que pide el contrato del proyecto elegido. Las claves opcionales `flowId`, `subflowId` y `messages` permiten elegir un lienzo o aportar mensajes de seguimiento. Los comandos con entrada JSON admiten `-` para leerla de la entrada estándar.

Para que la vista recoja un cambio, el agente guarda sobre el HTML que abrió con `previsualizar`. **Exportar proyecto HTML** genera un archivo autónomo para abrir o compartir. `node scripts/proyecto-html.cjs actualizar-visor antiguo.html actualizado.html` permite actualizar el editor incorporado en un artefacto anterior.

## Ejecutar la aplicación principal

Para servir el editor del ejemplo inmobiliario, ejecuta `python -m http.server 4173 --bind 127.0.0.1 --directory dist` desde la raíz con Python 3. Abre `http://127.0.0.1:4173/`. El mismo servidor permite abrir `/prototipo-proyecto.html`.

Pulsa **Ejecutar flujo** para editar los datos de entrada en JSON y recorrer los bloques conectados. La simulación muestra los bloques recorridos y el resultado obtenido. El ejemplo inmobiliario incluye catálogo, disponibilidad y citas de prueba; sus bloques especializados pertenecen a ese ejemplo.

Las propiedades, las citas y los horarios son simulados. Las citas y el flujo se guardan en el almacenamiento local del navegador, en ese dispositivo y origen. No hay conexión con un calendario, una base de datos compartida, clientes reales ni un modelo de lenguaje. Si el navegador conserva el trabajo de la primera versión en `flujo-v1`, el selector muestra «Flujo original recuperado» como una opción adicional.

### Notas y pruebas

En el lienzo, **+ Nota** crea una zona con título y comentario. Cambia su tamaño desde la esquina inferior derecha y arrástrala desde el asa; los bloques cuyo centro esté dentro se moverán con la nota. El botón ⛶ abre el lienzo a pantalla completa; Esc o el mismo botón permiten salir.

En **Historial**, guarda un nombre de caso, un campo de salida (por ejemplo `disponible`, `cita.cliente`, `$` o `$error`) y un valor esperado en JSON (por ejemplo `true` o `"Ana"`). Cada ejecución registra entrada, salida y pasos y compara ese campo; si no defines expectativa, se registra sin comparar. Cada flujo conserva hasta 100 ejecuciones con su revisión, fecha y citas iniciales. Las citas nuevas se guardan por flujo cuando la ejecución llega a una salida sin errores. Los registros compartidos de versiones anteriores se pueden consultar en Historial, donde permanecen sin flujo asignado.

### Intenciones y subflujos

El selector superior permite alternar entre el nuevo flujo y el anterior, conservados por separado en el navegador. El bloque **Intención** distingue información, visita, falta de propiedad y otras solicitudes usando reglas de palabras; no utiliza IA. El simulador conserva temporalmente la intención mientras solicita la propiedad o la fecha y hora que faltan.

El bloque **Subflujo** se abre desde su tarjeta o el panel de detalles. En su lienzo, los datos que llegan al bloque se entregan a su entrada y la salida vuelve al flujo padre. Puedes agregar y conectar bloques, incluir notas y anidar subflujos. Las ejecuciones muestran los pasos internos en el historial. Las dos consultas de propiedades del ejemplo comparten el catálogo editable.

### Especificaciones y casos exportables

Desde **Exportar** se pueden agregar y editar casos con entrada JSON, campo de salida, valor esperado, fecha simulada y citas iniciales. Los casos se guardan por flujo en el navegador. **Cargar ejemplos propuestos** agrega escenarios del chatbot para revisar; sus expectativas son propuestas que deben validarse con el negocio.

**Verificar casos** utiliza el mismo motor del editor sobre copias aisladas; no registra citas ni modifica el historial. El panel descarga tres archivos: una especificación Markdown con nodos, conexiones, notas, configuraciones, casos y revisión estructural básica; un JSON con el flujo completo y los casos; y un archivo autocontenido de pruebas para Node.js 18 o superior. Ejecútalo con `node --test flujo.test.cjs`. Un archivo sin casos falla de forma explícita para evitar una verificación vacía. Las pruebas usan la fecha y las citas simuladas de cada caso y la versión del motor incluida en el archivo exportado.

La exportación incluye los datos configurados en los nodos y los casos. El historial y las citas guardadas del navegador no se incluyen automáticamente. Los resultados de verificación aparecen en el documento solo si fueron calculados durante la sesión y corresponden a la versión actual del flujo y de sus casos.

### Definición, referencia y contrato del sistema

En **Exportar** se documentan el nombre, propósito, reglas acordadas y preguntas pendientes. Esos textos se guardan localmente y se incluyen en los archivos Markdown y JSON. Las reglas de texto son documentación; los casos confirmados son las comprobaciones ejecutables.

Los campos simples de los casos se pueden editar visualmente; el JSON avanzado queda disponible para datos compuestos. Los ejemplos se marcan como propuestos y se pueden confirmar individualmente. Los tests del modelo incluyen todos los casos, mientras que los tests del sistema incluyen únicamente los confirmados y fallan si no hay ninguno.

En **Cambios**, guarda una referencia y después compara ambos flujos con los mismos casos, fecha simulada y citas iniciales. Cada fila muestra el resultado anterior, el actual y si cambió la ruta o la salida. La referencia guarda el grafo, no el motor antiguo: la comparación usa el motor actual para ambas versiones. Solo se conserva una referencia por flujo.

El botón **Abrir un artefacto** valida un JSON exportado y lo abre en la opción separada «Flujo importado», conservando los dos flujos existentes. Un nuevo importado reemplaza el importado anterior después de confirmarlo. Se recuperan los casos, la definición y la referencia cuando estén presentes; los resultados históricos no se importan.

Para verificar una implementación externa, descarga `contrato.test.cjs` y `adaptador.flujo.cjs` en una carpeta de trabajo, como `.local/`. El adaptador debe implementar `ejecutarCaso({entrada, contexto})`, preparar un entorno aislado con la fecha y citas entregadas y devolver `{salida, error, completado}`. La plantilla falla intencionalmente hasta que se conecte al sistema real. Desde la carpeta de los archivos, en PowerShell:

```powershell
$env:FLUJO_ADAPTER = './adaptador.flujo.cjs'
node --test contrato.test.cjs
```

El conjunto de pruebas pasa los datos simulados al adaptador, pero la implementación del adaptador es responsable de aislarlos. Las funciones del editor y el intercambio del archivo no sincronizan datos entre usuarios o dispositivos automáticamente.

## Pruebas de regresión

Ejecuta `node --test` desde la raíz. La suite usa datos aislados y cubre recuperación, ejecución, historial, conversación, importación y pruebas generadas. El JSON de una especificación admite hasta 500 casos y 5 MB. El editor comprueba los límites y el formato antes de descargar ese archivo.
