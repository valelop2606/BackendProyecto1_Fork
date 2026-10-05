# Backend Error #05 — Controlador de evaluaciones apunta a `evaluationslalala` y deja la funcionalidad en 404 — P0

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/evaluations/evaluations.controller.ts:14 — EvaluationsController`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/evaluations/evaluations.controller.ts:14 — decorador @Controller('evaluationslalala')` de la clase `EvaluationsController`. Esta pieza define el prefijo de todas las evaluaciones, por lo que un error tipográfico aquí desplaza la funcionalidad completa fuera del contrato.

**[Síntoma Detectado]:** Hoy crear, listar, ver y editar evaluaciones solo existen bajo `/api/v1/evaluationslalala`, mientras la colección, el frontend y la documentación esperan `/api/v1/evaluations`. El sistema hoy se comporta así: el cliente pide `POST /api/v1/evaluations` con cuerpo válido y recibe `404 Cannot POST`, aunque el servicio y el esquema están sanos. Es incorrecto porque el nombre del recurso debe ser estable y predecible, y un sufijo de prueba convierte una funcionalidad principal en inalcanzable sin que ningún tubo o guardia pueda compensarlo.

**[Gravedad / Impacto]:** La gravedad es crítica de nivel P0 porque anula por completo las evaluaciones, que alimentan promedios, planillas y finales, en el escenario central de registrar un parcial. No hay alternativa salvo adivinar la ruta corrupta. Se viola el principio de denominación consistente de recursos de las interfaces REST y la expectativa de la especificación HTTP de que un recurso documentado exista bajo su nombre.

**Evidencia Postman:** Evidencia estática por log de arranque más réplica `curl`, ya que la colección simple no trae folder `evaluations`. El log lista `EvaluationsController {/api/v1/evaluationslalala}` y el `curl` a la ruta oficial devuelve `404`, mientras la ruta corrupta responde.

```text
log: RoutesResolver EvaluationsController {/api/v1/evaluationslalala}
curl -i -X POST http://localhost:3000/api/v1/evaluations -H "Authorization: Bearer <docente>"
  -H "Content-Type: application/json" -d '{"group":"<id>","name":"Parcial 1","weight":25}'
  -> 404 Cannot POST /api/v1/evaluations (anómalo; esperado 201)
curl -i http://localhost:3000/api/v1/evaluationslalala -> responde (ruta corrupta)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en devolver al recurso su nombre oficial en un único decorador, sin tocar manejadores ni servicios. El cambio se hace en la línea del controlador. Primero se sustituye `'evaluationslalala'` por `'evaluations'`. Después se reinicia y se verifica en el log que el resolutor registra `{/api/v1/evaluations}`. Desde ese momento las cuatro operaciones vuelven al contrato y la colección coincide sin reescribirla. La robustez viene de que el nombre queda en un solo lugar y cualquier desvío se detecta en el humo de rutas del arranque.

**[Patrón Aplicado]:** Nombre de recurso canónico y punto único de enrutamiento, con responsabilidad única del controlador. Este patrón encaja aquí porque el defecto era léxico y centralizado, de modo que corregir el literal restaura las cuatro operaciones de una vez sin ramas adicionales.

```ts
// BackendProyecto1_Fork/src/evaluations/evaluations.controller.ts — listo para pegar
@ApiTags('evaluations')
@ApiBearerAuth()
@Controller('evaluations')
export class EvaluationsController {
  // manejadores sin cambios
}
```

Tras el cambio, el log muestra `Mapped {/api/v1/evaluations, POST}` y la funcionalidad vuelve al contrato documentado. Es robusto porque elimina la ruta fantasma y deja una sola superficie auditable.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El controlador vivía bajo un literal de prueba con `lalala`, de modo que toda la funcionalidad estaba desplazada. La consecuencia encadenada era que planillas, promedios y finales no tenían evaluaciones que promediar, aunque la base y los servicios estaban listos.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: `EvaluationsController {/api/v1/evaluationslalala}`.
2. `curl -i -X POST http://localhost:3000/api/v1/evaluations -H "Authorization: Bearer <docente>" -H "Content-Type: application/json" -d '{"group":"<id>","name":"Parcial 1","weight":25}'` — devuelve `404`, que es lo anómalo.
3. Esperado tras el fix: `201` con la evaluación persistida y rutas `{/api/v1/evaluations}` en el log.

**[Cómo lo arregló]:** El cambio actúa en el registro del prefijo, que se antepone a cada manejador al arrancar. Al corregir el literal, el explorador de rutas reubica las cuatro operaciones bajo el nombre oficial de una sola vez. La colección y el frontend vuelven a coincidir sin parches, porque el mecanismo no distingue entre operaciones una vez fijado el prefijo.

**[Argumento para el profesor]:** "Profesor, encontramos que el controlador de evaluaciones servía bajo `evaluationslalala`, dejando `404` en la ruta oficial y anulando parciales, planillas y finales. El impacto es crítico porque no falla un caso borde sino la funcionalidad completa. Aplicamos nombre canónico de recurso en el decorador del controlador, con lo que las cuatro operaciones vuelven al contrato de una vez. Lo evidenciamos con el log de arranque que muestra el prefijo corrupto y con `curl` a la ruta oficial en `404` frente al `201` esperado. Esto garantiza evaluaciones alcanzables, documentación veraz y una superficie sin rutas fantasmas."
