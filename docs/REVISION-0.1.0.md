# Revisión del candidato v0.1.0

La revisión EGM se hizo en dos rondas con agentes independientes iniciados sin historial de conversación. La primera evaluó comprensión, consistencia del código y preparación de la entrega. La segunda revisó el árbol candidato extraído con `git archive` y reprodujo casos desde la CLI. Los cambios posteriores a esa ronda se verificaron con las pruebas de regresión.

| Hallazgo | Resolución y comprobación |
|---|---|
| El commit anterior omitía herramientas y guías y contenía una configuración local de publicación. | El candidato incluye los dos editores, scripts, pruebas, documentación, skills y workflow. El ZIP excluye la configuración y los archivos de trabajo. |
| La extracción por redirección puede producir UTF-16 en PowerShell 5.1. Faltaba crear el JSON de simulación en el inicio por CLI. | `leer` puede escribir un archivo UTF-8. La guía incluye el JSON de solicitudes. La copia que produjo la CLI devolvió **En revisión** para `REQ-104` y `CLI-88`. |
| La vista en vivo podía indicar que otro proyecto ya se había guardado en el archivo enlazado. | Al crear otro proyecto, el visor explica que hay que exportarlo para conservarlo fuera de la sesión. El aviso se comprobó en el navegador. |
| Los contratos incompletos o mal formados podían admitir entradas inválidas o interrumpir la carga. | Hay validación de esquema, listas, tipos y campos adicionales en el HTML y la CLI. En navegador se comprobó el aviso para un tipo inválido. La suite cubre rechazos por contrato, nulos y campos heredados o adicionales. |
| Una ruta duplicada se ignoraba silenciosamente y algunos números inválidos podían elegir la rama afirmativa. | El editor evita duplicar rutas y el simulador informa la ambigüedad. Las comparaciones numéricas descartan valores no numéricos o no finitos. Hay regresiones para ambos hallazgos. |
| Un flujo podía detectar un ciclo pese a cambiar los datos o recibir un nuevo mensaje. | El detector considera las transformaciones y vuelve a evaluar el flujo tras un mensaje aceptado. Las pruebas ejercitan esos retornos y la detección de un ciclo sin progreso. Se conserva el límite de 100 pasos por ejecución. |
| Los casos comparaban el orden de las claves de objetos JSON. | Se compara el contenido de los objetos y se mantiene el orden de los elementos de las listas. Hay una prueba que distingue ambos casos. |

## Verificación de entrega

- La suite se ejecutó en una extracción del candidato en Windows y Ubuntu con Node.js 24. Las dos skills pasaron su validador de formato.
- En navegador se comprobó la simulación de solicitudes y el aviso al cambiar a un proyecto nuevo. La primera ronda también ejercitó la edición, reversión y rehecho en la vista en vivo y la exportación de pruebas de modelo en el editor original.
- Los pasos para repetir la verificación y las decisiones de publicación están en la [guía de primera versión](PUBLICACION.md). El workflow de GitHub queda pendiente de ejecutarse en el repositorio de destino. El alcance de cada capacidad y sus comprobaciones pendientes están en la [matriz de trazabilidad](../SPEC_TRACEABILITY.md).
