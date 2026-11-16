# Verificación EGM de contratos y simulación

Revisión del 16 de noviembre de 2026. El punto de partida fue un clon público de `87fcbd89530b13733faea8369fd0e107c99d25ce`. Los revisores se iniciaron con `fork_turns: "none"`, sin historial de conversación y con lecturas explícitas. Cada uno ejecutó sus propias reproducciones sobre el código y conservó los archivos del producto.

## Hallazgos revisados

| Área | Evidencia obtenida |
|---|---|
| Contrato exportado | Un adaptador que responde según la entrada pasa. Respuestas constantes, tipos incorrectos, campos requeridos ausentes, errores inesperados y ejecuciones incompletas producen código de salida 1. |
| Serialización | Se rechazan expectativas o salidas con valores que se pierden o cambian al guardarse como JSON. Las reproducciones incluyen `undefined`, números no finitos, fechas, funciones, símbolos, propiedades no enumerables y accesores. |
| Datos JSON compuestos | El editor autónomo admite datos con claves propias `toString` y `valueOf` en condiciones y switches. El editor original permite importar, editar y guardar expectativas de ese tipo. |
| Comparación de ramas | Los casos independientes detectan una arista distinta con los mismos bloques y la misma salida, tanto en el flujo principal como dentro de un subflujo. |
| Cobertura | Una arista recorrida solo por un caso cuya expectativa falla se muestra con ese estado. Los casos que coinciden aportan la cobertura positiva. |

## Correcciones adicionales surgidas de la revisión

La primera ronda confirmó los controles habituales del contrato y encontró que `setExpected` convertía a texto un objeto antes de identificarlo como JSON. Importar `{"toString":{}}` y editar esa expectativa provocaba una excepción. Se corrigió el orden de conversión y se añadió una regresión de importación, edición y guardado.

La revisión identificó además propiedades no enumerables y símbolos que podían desaparecer sin que el comparador los viera. El validador ahora inspecciona los descriptores propios y rechaza esas representaciones, incluidos accesores y referencias circulares, antes de comprobar la serialización.

Otra ronda reprodujo una conversión fallida al comparar un objeto JSON en la igualdad del intérprete original. Se incorporó una conversión segura con su regresión. También se corrigieron las etiquetas de campos con nombres heredados, como `toString`.

## Rondas y controles independientes

| Ronda | Revisores | Resultado |
|---|---|---|
| Inicial | Contratos, simulación, exportación | Los controles ordinarios pasan y las implementaciones inválidas fallan. Se detecta el fallo de edición JSON. |
| Segunda | Contratos y simulación | Se verifica la edición corregida y el rechazo de doce variantes de adaptador inválido. Se detecta la comparación JSON pendiente en el intérprete original. |
| Tercera | Contratos y flujos | Sin defectos bloqueantes reproducidos en el alcance. Se detecta una etiqueta visual incorrecta para campos heredados. |
| Cierre | Contratos y flujos | Sin hallazgos bloqueantes. Un adaptador válido pasa y nueve variantes incumplidoras fallan. Se ejecutan siete grupos independientes de aserciones de flujos, comparación y cobertura. |

Los dos últimos ciclos terminaron sin hallazgos bloqueantes sobre el alcance reportado. Las reproducciones independientes complementan las regresiones de [contratos y editor original](../tests/flujo.test.cjs) y [simulador autónomo](../tests/prototipo.test.cjs). La suite del candidato corregido pasa 60 pruebas.

## Verificación en navegador y archivo descargado

En un origen local de prueba se importó el caso que interrumpía el formulario. La expectativa `{"toString":{}}` se pudo editar y guardar. Dos casos con datos compuestos y escalares mostraron **2 de 2 coinciden**.

Se descargó **Tests del sistema** desde ese editor y se ejecutó ese mismo archivo con Node.js. El adaptador válido pasó sus tres pruebas, incluida la configuración. Un adaptador constante falló un caso y las variantes con salida de tipo incorrecto, ejecución incompleta, campo `undefined` o propiedad no enumerable fallaron ambos casos.

La evidencia visual corresponde al navegador. Los agentes que usaron un DOM simulado comprobaron los manejadores reales y los archivos generados. Una revisión con navegador no pudo confirmar su propia descarga y registró esa limitación. La comprobación posterior del archivo descargado se realizó en la revisión principal.

Esta evidencia cubre las variantes ejecutadas. Cada implementación debe aportar los casos confirmados y expectativas que describen su comportamiento, junto con su adaptador aislado. Las nuevas comprobaciones se incluyen al volver a exportar las pruebas.
