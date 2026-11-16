# Trabaja conmigo en Flujo

Vamos a diseñar o revisar el comportamiento de un sistema con [Flujo](https://mauricioperera.github.io/flujo-laboratorio/). El flujo es una especificación que vamos a simular con datos de prueba. Su implementación vendrá después.

## Mi encargo

- **Objetivo** — [Describe el sistema o el cambio que quieres hacer.]
- **Proyecto existente** — [Adjunta el HTML o indica dónde está. Si empezamos de cero, déjalo vacío.]
- **Casos que quiero comprobar** — [Describe entradas, decisiones o resultados esperados si ya los conoces.]

## Cómo trabajar

1. Abre el [repositorio de Flujo](https://github.com/MauricioPerera/flujo-laboratorio) y lee `AGENTS.md` y las skills `flujo-operar-proyecto` y `flujo-verificar-cambios` en `.agents/skills/`. Si necesitas usar la CLI, trabaja desde una copia local del repositorio con Node.js 24.
2. Si te di un HTML, inspecciona ese archivo e identifica el proyecto, el flujo y los bloques que debemos revisar. Si empezamos de cero, usa **Abrir el editor → Abrir un lienzo en blanco**. Usa **Cargar datos de prueba** cuando el objetivo sea explorar el ejemplo.
3. Modela entradas y salidas, decisiones y subflujos con bloques del editor. Distingue los datos que entran del estado interno. Si falta una decisión, deja explícitos el punto pendiente, las reglas ya acordadas y las alternativas que aún caben.
4. Prepara casos con datos concretos y resultados esperados. Ejecuta uno para cada rama que el encargo requiera verificar, incluidos los límites y errores que apliquen. Indica la entrada, el recorrido, el resultado esperado, el obtenido y cualquier rama pendiente de probar.
5. Si editas con la CLI, usa `leer` y `guardar` como explica la skill. Conserva el valor de `revision` que te devolvió `leer` y registra tu autoría al guardar. Si entregas una copia, exporta el proyecto y comprueba que la descarga exacta conserve los cambios antes de volver a simularla.
6. Si te pido verificar el HTML sin servidor, comprueba la ejecución en el navegador con el archivo abierto por `file://`. Si solo pudiste usar la CLI o el visor local, indica cuál usaste y que la prueba en navegador sin servidor sigue pendiente. Si te pido dejar el visor abierto, deja visible el resultado del caso solicitado.

Entrega el HTML y la evidencia de los casos que ejecutaste. Señala qué decisiones quedan pendientes de definir o verificar.
