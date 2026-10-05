# Backend Error #06 — Crear evaluación responde `400` en éxito cuando debería responder `201` — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/evaluations/evaluations.controller.ts:21 — create()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/evaluations/evaluations.controller.ts:21 — función create()` con `@HttpCode(HttpStatus.BAD_REQUEST)` sobre `POST /evaluations`. Esta pieza decide el código de la creación de parciales, por lo que su valor determina si el docente distingue un parcial guardado de un error.

**[Síntoma Detectado]:** Hoy el sistema persiste la evaluación pero anuncia `400 Bad Request` aunque el cuerpo era válido y el peso sumaba. El docente ve un error, duda si reintentar, y un reintento puede duplicar la evaluación si no hay idempotencia. El sistema hoy invierte el protocolo: el éxito se viste de error y el error real del tubo queda indistinguible. Es incorrecto porque la creación exitosa debe anunciarse con `201 Created`, reservando el `400` para validaciones fallidas.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque contamina el flujo de calificaciones en el escenario de registrar un parcial, que es el insumo de promedios y finales. Cada parcial exitoso cuenta como fallo en la telemetría y empuja a duplicados. Se viola la especificación HTTP RFC 9110 sobre el significado del `201` y el principio de menor sorpresa para el cliente docente.

**Evidencia Postman:** Evidencia estática por lectura del decorador más réplica `curl` a la ruta corrupta actual y a la oficial tras el fix del #05, ya que la colección simple no trae `evaluations`. Con cuerpo válido de la documentación del DTO, la respuesta observada es `400` en éxito en lugar de `201`.

```text
curl -i -X POST http://localhost:3000/api/v1/evaluationslalala -H "Authorization: Bearer <docente>"
  -H "Content-Type: application/json" -d '{"group":"<id>","name":"Parcial 1","weight":25}'
  -> 400 (anómalo en éxito; esperado 201)
Tras #05: misma prueba en /api/v1/evaluations -> debe dar 201.
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en alinear el código con la semántica de creación y dejar los errores al tubo de validación. El cambio se hace en un decorador del controlador. Primero se sustituye `@HttpCode(HttpStatus.BAD_REQUEST)` por `@HttpCode(HttpStatus.CREATED)`. Después se mantiene el retorno de la entidad creada sin envoltorios de error. Desde ese momento el éxito devuelve `201` y los cuerpos inválidos siguen devolviendo `400` desde el tubo global, con lo que el docente distingue ambos casos. La robustez viene de no codificar errores a mano y de importar el enumerado ya usado en el archivo.

**[Patrón Aplicado]:** Códigos HTTP semánticos según RFC 9110 con delegación al tubo de validación. Este patrón encaja aquí porque el defecto era la suplantación del error en la presentación, y devolver cada código a su origen restaura el contrato sin condicionales.

```ts
// BackendProyecto1_Fork/src/evaluations/evaluations.controller.ts — listo para pegar
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';

@ApiOperation({ summary: 'Crear una evaluacion' })
@Roles(Role.Admin, Role.Docente)
@Post()
@HttpCode(HttpStatus.CREATED)
create(@Body() dto: CreateEvaluationDto, @CurrentUser() user: AuthUser): Promise<Evaluation> {
  return this.evaluationsService.create(dto, user);
}
```

Tras el cambio, el parcial guardado se anuncia con `201` y el cuerpo inválido sigue en `400` desde el tubo. Es robusto porque elimina la rama falsa y deja una sola fuente por código.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El manejador forzaba `400` en todos los casos, de modo que el éxito y el error compartían código. La consecuencia encadenada era docentes que reintentaban parciales ya guardados y tableros que contaban éxitos como fallos.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: ruta de creación registrada.
2. `curl -i -X POST http://localhost:3000/api/v1/evaluationslalala -H "Authorization: Bearer <docente>" -H "Content-Type: application/json" -d '{"group":"<id>","name":"Parcial 1","weight":25}'` — devuelve `400` con la evaluación creada, que es lo anómalo.
3. Esperado tras el fix y tras el #05: `201` con la evaluación en `/api/v1/evaluations`.

**[Cómo lo arregló]:** El decorador actúa en la presentación antes de serializar, fijando el código del camino feliz. Al declarar `201`, Nest ya no necesita inferir el resultado del cuerpo, y el tubo sigue interceptando lo inválido con `400` genuino. Cada camino recupera su señal y el docente puede confiar en la primera cifra.

**[Argumento para el profesor]:** "Profesor, encontramos que crear evaluaciones devolvía `400` en éxito por un decorador fijo, haciendo que cada parcial pareciera un error e invitando a duplicados. El impacto es alto porque alimenta promedios y finales con ruido. Aplicamos códigos semánticos según la especificación HTTP, con `201` en el éxito y `400` genuino en el tubo, sin tocar el servicio. Lo evidenciamos con `curl` a la ruta de creación mostrando el `400` anómalo frente al `201` esperado. Esto garantiza parciales predecibles, sin reintentos ciegos y con métricas que vuelven a distinguir éxito de error."
