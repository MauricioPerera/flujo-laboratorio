---
name: flujo-verificar-cambios
description: Revisar y verificar cambios en el código, documentación o artefactos de Flujo. Usar para ejecutar regresiones, comprobar la interfaz, auditar el alcance de una capacidad y preparar una versión del repositorio para GitHub.
---

# Verificar cambios de Flujo

1. Identifica la capacidad y la superficie que cambió en [AGENTS.md](../../../AGENTS.md). Consulta su [criterio de aceptación](../../../SPEC_TRACEABILITY.md).
2. Ejecuta `node --test` desde la raíz con Node.js 24. Si se cambió `dist/routing.js`, sincroniza el HTML autónomo con `node scripts/sync-routing.cjs` antes de probar.
3. Si la modificación afecta al lienzo o al editor, usa una copia del proyecto y reproduce la acción por su entrada normal en el navegador. Comprueba el estado final y también un caso que deba conservar su comportamiento.
4. Si se cambió la CLI o la colaboración en vivo, compara el resultado del visor con `leer` y `ejecutar` sobre el mismo HTML. Prueba la edición desde el visor o desde la CLI según corresponda. Si el control de revisión cambió, reproduce un guardado sobre una revisión anterior y vuelve a leer el archivo para comprobar qué persistió.
5. Si se modificó la exportación, usa [Exportar y volver a abrir](../flujo-operar-proyecto/SKILL.md#exportar-y-volver-a-abrir). Lee la descarga exacta para comprobar que conserva el cambio. Prueba en esa copia una entrada cuyo resultado debió cambiar y otra que debió conservarlo. Para un umbral incluye un caso en el límite.
6. Informa la ruta de la copia, los datos, la rama, el resultado y la superficie usada. La CLI comprueba el modelo embebido. El resultado visible por `file://` con el visor apagado comprueba la apertura autónoma en el navegador. Una ejecución por la URL de `previsualizar` comprueba la vista en vivo. Si falta una de las comprobaciones solicitadas, regístrala como pendiente. Para contratos de implementación, identifica también si se ejecutó el sistema mediante su adaptador.
7. Para preparar una versión, sigue la [guía de publicación](../../../docs/PUBLICACION.md). Verifica el conjunto de archivos y valida la copia que se publicaría.
