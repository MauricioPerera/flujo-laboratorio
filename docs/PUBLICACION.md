# Primera versión en GitHub

El objetivo de `v0.1.0` es entregar el repositorio de Flujo con sus dos editores, la vista local en vivo y la CLI para trabajar sobre proyectos HTML. La versión es una propuesta de etiqueta. La [especificación](../SPECIFICATION.md) y la [matriz de trazabilidad](../SPEC_TRACEABILITY.md) describen las capacidades y su evidencia. La [revisión del candidato](REVISION-0.1.0.md) registra los resultados de preparación para GitHub.

## Verificación en una copia limpia

1. Usa Node.js 24 desde la raíz y ejecuta `node --test`.
2. Sigue el [inicio rápido](../README.md#iniciar) sobre una copia del ejemplo autónomo. Confirma que `REQ-104` con `CLI-88` entrega el estado **En revisión**.
3. En esa misma vista, selecciona **¿Alcanzó el límite?**, cambia su valor de `3` a `4` y pulsa **Guardar bloque**. Comprueba con `leer` que el HTML contiene `4`. En **Historial de cambios**, vuelve a `3` con **Revertir cambio** y aplica de nuevo `4` con **Rehacer cambio**. Comprueba que el historial conserva las tres entradas.
4. Abre el [editor original](../README.md#ejecutar-la-aplicación-principal) en una sesión de navegador sin datos de Flujo y elige **Con subflujos**. En **Exportar**, carga los casos propuestos y confirma uno. Ejecuta las pruebas descargadas del modelo y comprueba que pasan los seis casos. El contrato ejecuta el caso confirmado con un adaptador conectado. La plantilla descargada informa que requiere una implementación. La regresión en [tests/flujo.test.cjs](../tests/flujo.test.cjs) prueba el contrato con un adaptador de ejemplo.

El [workflow](../.github/workflows/ci.yml) ejecuta la suite en Windows y Ubuntu cuando hay un push a `main` o una pull request. Las comprobaciones de interfaz requieren navegador.

## Preparar la publicación

1. Revisa el árbol del commit candidato con `git ls-tree -r --name-only <commit>`. Incluye `dist/`, los scripts, pruebas, documentación y skills. La configuración personal de publicación, los archivos de sesión, las exportaciones de trabajo y los secretos pertenecen al entorno local. Los patrones correspondientes están en [`.gitignore`](../.gitignore). Extrae el commit candidato con `git archive --format=zip --output=flujo.zip <commit>` y repite la verificación desde esa copia.
2. Define el repositorio de destino, su visibilidad y la licencia si corresponde. El repositorio actual todavía carece de un remoto y de una licencia asignada.
3. Revisa si el destino debe conservar el historial local. Una revisión anterior contiene el identificador de un sitio de demostración en `.openai/hosting.json`. Esa configuración quedó fuera del conjunto de archivos de la versión actual. Para publicar solo el estado actual, crea un repositorio inicial desde una exportación limpia del commit elegido.
4. Sube el commit a la rama `main` de GitHub y espera que termine el workflow. Cuando la revisión elegida esté verificada en el destino, crea la etiqueta `v0.1.0` y una release.

## Alcance para las notas de versión

- **Proyecto HTML autónomo.** Creación de proyectos, bloques personalizados, subflujos, contratos de entrada, ejecución de casos del modelo en el panel **Casos** y exportación del proyecto portable.
- **Vista en vivo y trabajo con agentes.** Edición sobre el mismo HTML, guardado con control de revisión, historial de cambios, reversión y cambios rehechos.
- **Editor original.** Ejemplo inmobiliario con consultas, disponibilidad y agendas simuladas, casos verificables y exportación de pruebas y adaptador de contrato.
