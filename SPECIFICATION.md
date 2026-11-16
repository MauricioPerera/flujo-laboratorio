# Especificación de la plataforma Flujo

## Propósito

Flujo es una herramienta para **crear, gestionar, simular y verificar flujos de cualquier proyecto**. El usuario puede modelar un sistema junto con una IA y revisar visualmente qué pasa con distintas entradas, qué reglas están acordadas y qué decisiones siguen abiertas.

La unidad de trabajo es el **proyecto de flujos**. Cada proyecto reúne sus propios flujos, subflujos, biblioteca de bloques, notas, contratos y casos. Se diseña para que cada equipo pueda llevar ese proyecto dentro del sistema que está definiendo, como un HTML con editor, visor y opciones de exportación.

Una vez acordado el modelo, los flujos, casos y contratos sirven de referencia para desarrollar y verificar las implementaciones correspondientes. La simulación del editor usa datos de prueba. Las operaciones reales pertenecen a las implementaciones del proyecto.

## Ciclo de trabajo

1. **Crear un proyecto.** Partir de un lienzo editable y definir los flujos y subflujos del sistema. Reutilizar bloques comunes y crear los específicos del dominio cuando haga falta.
2. **Especificar el comportamiento.** Conectar bloques, declarar entradas y salidas y describir qué debería ocurrir. Registrar las incertidumbres junto al paso correspondiente con hechos, restricciones y decisiones pendientes.
3. **Simular y comprobar.** Ejecutar casos con entradas y expectativas explícitas. Inspeccionar el recorrido y el resultado obtenido, localizar caminos sin cubrir y comparar el efecto de los cambios.
4. **Entregar la especificación.** Exportar el modelo, los contratos y los casos ejecutables. Conservar ese material con el proyecto para poder repetir la verificación.
5. **Verificar la implementación correspondiente.** Ejecutar los casos confirmados contra la implementación mediante un adaptador y comparar el resultado con el contrato de la revisión del flujo usada como referencia.

## Capacidades acordadas

| Área | Comportamiento esperado | Evidencia |
|---|---|---|
| Proyectos portables | Crear proyectos independientes de distintos dominios. Guardar y reabrir el HTML del proyecto con su definición, editor y opciones de exportación. Conservar las ediciones al intercambiar archivos. | R01, R02, R25 |
| Bloques configurables | Usar entrada, condición, selección, operación, subflujo, espera y resultado. Crear bloques propios a partir del comodín con propósito, entradas, salidas, reglas y resultado simulado. Importar definiciones estructuradas, incluidas las preparadas por una IA. | R03, R04 |
| Lienzo | Agrupar y comentar con notas. Acercar, alejar, ajustar la vista y abrir solo el lienzo en pantalla completa. Las condiciones binarias tienen salidas Sí y No. Las conexiones llegan a sus puertos y las etiquetas se mantienen legibles con cambios de zoom o tamaño. Al organizar se retiran los bloques sin ruta desde una entrada y se conservan sus definiciones reutilizables. | R05–R10 |
| Subflujos e incertidumbre | Abrir y editar el lienzo hijo. Aplicar su resultado en el padre. Documentar decisiones abiertas en su contexto, con lo que ya se sabe y las restricciones que sigue teniendo el sistema. | R11, R17, R18 |
| Simulación interactiva | Validar entradas y mostrar recorrido y salida. Distinguir los mensajes externos del estado interno. Los flujos pueden esperar una nueva entrada, recuperar la pausa y usar condiciones de salida configuradas para las repeticiones. | R13–R16, R24 |
| Casos, historial y cambios | Registrar entrada, expectativa, resultado obtenido y recorrido. Señalar las conexiones sin caso. Comparar los mismos escenarios entre revisiones de un flujo. | R19–R21 |
| Implementaciones | Exportar la especificación, los casos, las pruebas del modelo y el contrato ejecutable. Usar los casos confirmados para verificar la implementación que corresponde al flujo. | R22 |
| Colaboración con agentes | Evaluar situaciones nuevas indicando qué ruta las cubre o qué decisión queda por definir. Se planteó WebMCP como vía para interactuar con la herramienta. Su viabilidad queda por verificar. | R23 |

El dominio de cada proyecto aporta sus bloques, datos, reglas, resultados y casos. Los casos de inmobiliaria y de consulta de solicitudes ejercitan la herramienta con dos modelos concretos. R12 documenta la clasificación del ejemplo inmobiliario. [Proyecto de ejemplo «Sistema de solicitudes»](EXAMPLE_REQUESTS.md)

## Relación entre flujo e implementación

El flujo define el comportamiento que se quiere comprobar. Su contrato indica los datos intercambiados y los resultados esperados. Los casos del modelo sirven para discutir y probar el comportamiento. Los casos confirmados sirven además para verificar una implementación.

La aplicación principal exporta pruebas de contrato y una plantilla de adaptador. El desarrollador implementa en esa plantilla la llamada al sistema y devuelve salida, error y estado de finalización. El proyecto autónomo ejecuta los casos del modelo en el panel **Casos**. La exportación de pruebas de implementación para este editor y el vínculo entre una implementación, la revisión que cumple y su verificación siguen pendientes.

## Evidencia y alcance actual

La aplicación principal tiene evidencia de notas de agrupación, historial, comparación y exportación de pruebas y contrato. Su motor está acoplado al ejemplo inmobiliario. En el navegador, el HTML autónomo permitió crear desde cero un proyecto de aprobación de gastos con dos flujos, un subflujo y una definición reutilizada en ambos. Se verificaron la ejecución de dos ramas, el regreso del dato al padre, el cambio de proyecto, la recarga y la descarga HTML. También se probaron los contratos, la espera persistente y la cobertura con el ejemplo de solicitudes.

El simulador autónomo admite una conexión por salida de bloque y limita cada ejecución a 100 pasos, incluidos los subflujos y las reanudaciones.

El usuario abrió directamente el HTML de gastos en el navegador y exportó desde ahí una revisión que se pudo ejecutar en un entorno aislado. El acceso automatizado a los controles de la pestaña local sigue pendiente. También quedan pendientes en el HTML autónomo las notas de agrupación, el historial de ejecuciones, la comparación de resultados entre revisiones y la exportación de especificaciones y pruebas ejecutables para verificar la implementación. La pantalla completa y la evaluación vía WebMCP siguen pendientes de verificación.

Los agentes pueden trabajar sobre el HTML exportado con control de revisión y simularlo con el motor del editor. El comando de vista en vivo arranca un servicio en la máquina local y abre el proyecto en el navegador. Los cambios que se confirman en el visor se guardan en el mismo HTML. Los cambios que guarda el agente actualizan el lienzo y la última simulación completa. En «Aprobación de gastos», el visor guardó el umbral de 1100 y su descripción en el HTML. El agente leyó ese archivo y obtuvo revisión con un importe de 1150. Un guardado que parte de una revisión desactualizada conserva el archivo más reciente y deja pendiente la edición local. Cada cambio guardado por el visor o la herramienta local añade al HTML una entrada con fecha, autor, campo y valores anterior y nuevo. El HTML exportado se puede abrir de forma autónoma y conserva su historial.

La vista en vivo permite revertir un campo registrado usando su referencia en el modelo. La operación conserva otras ediciones y se rechaza si el campo ya tiene un valor distinto del que dejó el cambio original. La reversión se guarda como una entrada nueva, vinculada a la original, con autor, fecha y valores antes y después. En una copia de «Aprobación de gastos», revertir desde el visor restauró el umbral de 1100 y devolvió a revisión el gasto de 1150.

La vista en vivo también permite rehacer un campo desde su entrada de reversión. El guardado genera una entrada vinculada a la reversión con autor y fecha. En la misma copia, rehacer cambió el umbral de 1100 a 1200 y el gasto de 1150 pasó a aprobado. La operación conservó una edición posterior del propósito del subflujo.

Cada requisito se valida en el alcance ejercitado, con evidencia reproducible. Las pruebas de un ejemplo aportan evidencia para la capacidad que ejercitan. La matriz señala las capacidades parciales y las pruebas pendientes. [Matriz de trazabilidad](SPEC_TRACEABILITY.md) · [Auditoría EGM](EGM_AUDIT_REPORT.md)

La versión local es la referencia de este documento. La auditoría registra las diferencias con la publicación anterior.
