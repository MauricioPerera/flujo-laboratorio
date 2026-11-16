---
name: flujo-verificar-cambios
description: Revisar y verificar cambios en el código, documentación o artefactos de Flujo. Usar para ejecutar regresiones, comprobar la interfaz, auditar el alcance de una capacidad y preparar una versión del repositorio para GitHub.
---

# Verificar cambios de Flujo

1. Identifica la capacidad y la superficie que cambió en [AGENTS.md](../../../AGENTS.md). Consulta su [criterio de aceptación](../../../SPEC_TRACEABILITY.md).
2. Ejecuta `node --test` desde la raíz con Node.js 24. Si se cambió `dist/routing.js`, sincroniza el HTML autónomo con `node scripts/sync-routing.cjs` antes de probar.
3. Si la modificación afecta al lienzo o al editor, usa una copia del proyecto y reproduce la acción por su entrada normal en el navegador. Comprueba el estado final y también un caso que deba conservar su comportamiento.
4. Si se cambió la CLI o la colaboración en vivo, compara el resultado del visor con `leer` y `ejecutar` sobre el mismo HTML. Prueba la edición desde el visor o desde la CLI según corresponda. Si el control de revisión cambió, reproduce un guardado sobre una revisión anterior y vuelve a leer el archivo para comprobar qué persistió.
5. Si se modificó la exportación, abre o ejecuta el artefacto descargado en un entorno limpio. Comprueba qué campos se conservaron. Distingue la comprobación de las pruebas del modelo de la comprobación de un sistema a través de su adaptador.
6. Informa qué comprobaste, con entradas y resultados. Si una superficie sigue pendiente, delimita su estado en la matriz. Una prueba sin interfaz aporta evidencia del motor y un ejercicio en el navegador aporta evidencia del recorrido visible.
7. Para preparar una versión, sigue la [guía de publicación](../../../docs/PUBLICACION.md). Verifica el conjunto de archivos y valida la copia que se publicaría.
