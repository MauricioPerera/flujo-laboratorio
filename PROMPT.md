# Trabaja conmigo en Flujo

Vamos a evaluar el comportamiento de un sistema con [Flujo](https://mauricioperera.github.io/flujo-laboratorio/) antes de invertir en su implementación. Quiero reducir la ambigüedad y la incertidumbre, probar decisiones con datos simulados y preparar una entrega con la que una IA pueda generar y validar el código dentro del alcance que acordemos.

## Mi encargo

- **Objetivo** — [Describe el sistema o el cambio que quieres hacer.]
- **Proyecto existente** — [Adjunta el HTML o indica dónde está. Si empezamos de cero, déjalo vacío.]
- **Casos que quiero comprobar** — [Describe entradas, decisiones o resultados esperados si ya los conoces.]
- **Alcance y restricciones** — [Indica qué debe incluirse, qué queda fuera y las decisiones técnicas o de negocio ya tomadas.]

## Cómo trabajar

1. Abre el [repositorio de Flujo](https://github.com/MauricioPerera/flujo-laboratorio) y lee `AGENTS.md` y las skills `flujo-operar-proyecto` y `flujo-verificar-cambios` en `.agents/skills/`. Si necesitas usar la CLI, trabaja desde una copia local del repositorio con Node.js 24.
2. Si te di un HTML, inspecciona ese archivo e identifica el proyecto, el flujo y los bloques que debemos revisar. Si empezamos de cero, usa **Abrir el editor → Abrir un lienzo en blanco**. Usa **Cargar datos de prueba** cuando el objetivo sea explorar el ejemplo.
3. Modela entradas y salidas, decisiones y subflujos con bloques del editor. Distingue los datos que entran del estado interno. Si falta una decisión, deja explícitos el punto pendiente, las reglas ya acordadas, las alternativas que aún caben y las tareas o casos afectados. Si cambia el comportamiento, los contratos o el alcance, obtén su definición antes de ejecutar la tarea dependiente. Avanza en las partes independientes que ya estén definidas.
4. Prepara casos con datos concretos y resultados esperados. Ejecuta uno para cada rama que el encargo requiera verificar, incluidos los límites y errores que apliquen. Indica la entrada, el recorrido, el resultado esperado, el obtenido y cualquier rama pendiente de probar.
5. Si editas con la CLI, usa `leer` y `guardar` como explica la skill. Conserva el valor de `revision` que te devolvió `leer` y registra tu autoría al guardar. Si entregas una copia, exporta el proyecto y comprueba que la descarga exacta conserve los cambios antes de volver a simularla.
6. Si te pido verificar el HTML sin servidor, comprueba la ejecución en el navegador con el archivo abierto por `file://`. Si solo pudiste usar la CLI o el visor local, indica cuál usaste y que la prueba en navegador sin servidor sigue pendiente. Si te pido dejar el visor abierto, deja visible el resultado del caso solicitado.

## Entrega para generar y validar el código

Entrega el HTML y la evidencia de los casos ejecutados. Prepara además un Markdown con la revisión del modelo de referencia, las decisiones confirmadas, los contratos, las incertidumbres y sus dependencias.

Relaciona cada tarea de implementación con el requisito y el flujo que satisface y con sus pruebas de aceptación. Describe los entregables, el alcance autorizado y las restricciones. Cuando exista un repositorio destino, identifica las áreas o archivos afectados y los comandos conocidos para comprobar el trabajo. Registra los detalles de implementación que todavía requieren una decisión.

Indica qué artefactos produce el exportador actual y qué información tuviste que documentar aparte. Señala las comprobaciones pendientes para que la siguiente IA pueda distinguir lo acordado, lo verificado y lo que necesita resolver.
