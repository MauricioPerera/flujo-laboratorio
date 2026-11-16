# Trabajar con Flujo

Flujo es una herramienta para diseñar y simular sistemas mediante flujos. Los datos, operaciones y resultados de los ejemplos son simulados. La [especificación](SPECIFICATION.md) define el alcance y la [matriz](SPEC_TRACEABILITY.md) indica qué se pudo verificar.

## Identifica la tarea

- Para editar, ejecutar o mostrar un proyecto HTML, sigue [flujo-operar-proyecto](.agents/skills/flujo-operar-proyecto/SKILL.md).
- Para modificar el producto, revisar una regresión o preparar una versión, sigue [flujo-verificar-cambios](.agents/skills/flujo-verificar-cambios/SKILL.md).
- Para publicar, consulta la [guía de primera versión](docs/PUBLICACION.md).

## Archivos de entrada

| Ruta | Función |
|---|---|
| `dist/prototipo-proyecto.html` | Editor autónomo, modelo de ejemplo y simulador embebido. Sirve de plantilla para exportar y abrir proyectos genéricos. |
| `dist/index.html` y módulos de `dist/` | Editor original del ejemplo inmobiliario. Incluye notas de agrupación, historial de ejecuciones y exportación de pruebas de contrato. |
| `scripts/proyecto-html.cjs` | CLI para leer, guardar, previsualizar, simular, revertir y rehacer cambios en un proyecto HTML. |
| `scripts/vista-proyecto.cjs` y `scripts/historial-proyecto.cjs` | Vista local en vivo, guardado con control de revisión e historial auditable. |
| `tests/` | Pruebas del editor original, del HTML autónomo y del guardado y ejecución por CLI. |

## Reglas de trabajo

- Ejecuta `node --test` desde la raíz con Node.js 24. El repositorio funciona sin instalar dependencias de npm.
- Usa una copia del ejemplo para experimentar. Por defecto, `previsualizar` edita el mismo archivo que le entregas.
- Usa `leer` y `guardar` para modificar el HTML de trabajo, manteniendo su `revision` y declarando la autoría del agente. Si otro editor guardó primero, vuelve a leer y aplica la edición sobre el archivo reciente.
- El trazado se comparte desde `dist/routing.js`. Después de cambiarlo, ejecuta `node scripts/sync-routing.cjs` para actualizar el HTML autónomo y corre las pruebas.
- Cuando cambies una interacción, verifícala en el navegador además de ejecutar la suite. Registra qué superficie y casos quedaron comprobados.
