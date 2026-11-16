# Ejemplo de proyecto autónomo «Sistema de solicitudes»

Identificador `solicitudes-demo`, versión 8. Modela una consulta de estado con comprobación de identidad previa. El ejemplo del HTML contiene 16 bloques y 19 conexiones en el flujo padre.

## Contratos de entrada y estado

| Dato | Campos obligatorios | Campos opcionales | Campos adicionales |
|---|---|---|---|
| Mensaje inicial | `idSolicitud`, texto | `clienteId`, texto | Permitidos por el contrato de ejemplo. |
| Mensaje posterior | `texto`, texto | `clienteId`, texto | Permitidos por el contrato de ejemplo. |

Los campos obligatorios deben estar presentes y los textos obligatorios deben contener algún carácter sin contar espacios. El simulador valida los tipos definidos. El panel interactivo rechaza un mensaje posterior inválido y mantiene la espera y el contador. El resultado muestra `initialUserMessage`, `latestUserMessage`, `internalState` y `flowData` por separado.

| Campo de estado interno | Inicialización y cambios |
|---|---|
| `idSolicitudEnCurso` | Toma el `idSolicitud` inicial y se conserva al reanudar. |
| `intentosSinIdentificacion` | Empieza en 0. Aumenta al faltar el identificador o al obtener `no_encontrada`. Vuelve a 0 al validar la identidad. |
| `turnosUsuario` | Empieza en 1 y aumenta con cada mensaje posterior aceptado. |
| `estadoConversacion` | Empieza en `activa`. La espera muestra `esperando_respuesta`; las salidas usan `completada`, `solicitud_no_encontrada`, `limite_intentos` o `pendiente_definicion`. |

## Subflujos y reglas del padre

| Subflujo | Entrada | Resultado simulado | Rama del padre |
|---|---|---|---|
| Validar identidad del cliente | `clienteId`, `idSolicitudEnCurso` | `CLI-88` devuelve `validada` y `clienteIdNormalizado: "CLI-88"`. | Reiniciar contador y consultar solicitud. |
| Validar identidad del cliente | Los mismos campos | Un ID desconocido como `CLI-99` devuelve `no_encontrada` e ID normalizado nulo. | Contar el fallo y aplicar el límite. |
| Validar identidad del cliente | Los mismos campos | `CLI-503` devuelve `error_tecnico` e ID normalizado nulo. | «Validación técnica pendiente» sin consultar la solicitud. |
| Consultar solicitud | `idSolicitudEnCurso`, `clienteIdNormalizado` | `REQ-104` devuelve `encontrada`, estado «En revisión» y detalle «La documentación está completa». | «Entregar estado». |
| Consultar solicitud | Los mismos campos | Un ID desconocido como `REQ-404` devuelve `no_encontrada` con estado y detalle nulos. | «Solicitud no encontrada». |
| Consultar solicitud | Los mismos campos | `REQ-503` devuelve `error_tecnico` con estado y detalle nulos. | «Consulta pendiente de definición». |

Las salidas técnicas de ambos subflujos también reciben la ruta por defecto del selector del padre si un caso suministra un resultado que este no reconoce. El acceso al estado y detalle exige haber validado la identidad.

## Espera, límite y nueva ejecución

1. Sin identificación o con identidad no encontrada, el padre incrementa los fallos consecutivos. Con menos de 3 pide identificación y pausa en «Esperar siguiente mensaje».
2. El usuario envía otro JSON mediante una acción separada. El padre conserva la solicitud y vuelve a evaluar la identificación. El recorrido continúa desde la espera.
3. Al tercer fallo, el padre llega a «Límite alcanzado». La simulación termina y deja de aceptar mensajes para esa ejecución. El valor 3 se usa en este ejemplo.
4. Una pausa se guarda en el navegador por proyecto y lienzo. Al recargar o reabrir en el mismo navegador y origen, se recuperan la entrada, los mensajes aceptados y el modelo con el que se inició. Se elimina la pausa al terminar.
5. **Iniciar simulación** después del cierre inicia una ejecución nueva con el JSON actual, el turno 1 y el contador en 0. El identificador en curso se toma de esa nueva entrada.

## Casos de aceptación

| Entrada y secuencia | Comportamiento comprobado | Evidencia |
|---|---|---|
| `REQ-104` + `CLI-88`, `CLI-99` o `CLI-503` | Entrega de estado, espera tras el primer fallo o validación técnica pendiente, respectivamente. | Casos `c1`, `c6`, `c7` y navegador. |
| `CLI-88` + `REQ-104`, `REQ-404` o `REQ-503` | Estado «En revisión», solicitud no encontrada o consulta pendiente de definición, respectivamente. | Casos `c1`, `c8`, `c9` y navegador. |
| `REQ-104` + `CLI-99`. Luego `CLI-88` como mensaje posterior. | Conserva `REQ-104`, entrega «En revisión», queda en turno 2 y reinicia el contador. | Caso `retry-recovers`, ejecución interactiva y regresión. |
| `REQ-104` + `CLI-99`, seguido por `CLI-404`. Cerrar y abrir la pestaña. | Recupera la pausa con dos fallos. Con `CLI-88` entrega «En revisión». Con `CLI-777` en una ejecución separada, termina en «Límite alcanzado» y la pausa ya no aparece al volver a abrir. | Dos pruebas de navegador y regresiones de recuperación. |
| Tras alcanzar el límite con `REQ-104`, iniciar `REQ-404` + `CLI-503` en la misma pestaña. | Muestra turno 1, contador 0 y solo `REQ-404` en la salida. La rama técnica permite observar el cero inicial antes de cualquier reinicio por identidad válida. | Navegador y regresión de aislamiento de ejecuciones. |
| Omitir `idSolicitud`, usar un número como `clienteId` o enviar `texto` numérico en el seguimiento. | El contrato correspondiente detecta cada entrada inválida. La interfaz conserva la espera cuando rechaza el mensaje posterior. | Casos `c5`, `c13`, `c14` y regresiones de contratos y de espera interactiva. |

Los 16 casos incorporados coinciden y cubren las 19 conexiones del padre. Cada subflujo tiene cuatro conexiones internas cubiertas. La matriz conserva el alcance y la evidencia de las pruebas de navegador. [Matriz de trazabilidad](SPEC_TRACEABILITY.md)

## Decisiones del sistema pendientes

| Punto | Hechos y restricciones ya definidos | Decisión abierta |
|---|---|---|
| Validar identidad | Se recibe `clienteId` cuando el usuario lo conoce. Solo una identidad validada permite consultar la solicitud. Un fallo de coincidencia cuenta para el límite y un error técnico toma su propia salida. | Fuente, reglas de coincidencia, evidencias adicionales y tratamiento del error técnico. |
| Consultar solicitud | La consulta usa la solicitud en curso y el cliente validado. Conserva resultados separados para hallazgo, ausencia y error técnico. | Fuente de verdad, API, base de datos o intervención humana, permisos, criterios de búsqueda y recuperación tras un error. |
| Agotar intentos | El límite detiene la repetición y conserva la referencia de la solicitud en el resultado. | Umbral definitivo y acción posterior, como cierre o derivación. |

## Hallazgos del prototipo

El contrato de estado incorporado en el proyecto autónomo todavía omite `turnosUsuario`, `completada` y `solicitud_no_encontrada`. Falta editar y exportar ese contrato como pieza separada. Una comprobación del motor confirmó que, después de un ID erróneo, un seguimiento que omite `clienteId` vuelve a validar el identificador anterior y suma un segundo fallo. Queda pendiente contrastar en navegador ese caso específico y definir si la condición debe evaluar solo el identificador del nuevo mensaje.

Este proyecto sirve para ejercitar las funciones de la herramienta. [Especificación de la plataforma](SPECIFICATION.md) · [Abrir el HTML de ejemplo](dist/prototipo-proyecto.html)
