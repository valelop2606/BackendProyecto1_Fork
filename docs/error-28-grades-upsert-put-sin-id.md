# Backend Error #28 — Notas con `PUT` sin identificador en la ruta rompe idempotencia direccionable — P2

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/grades/grades.controller.ts:22 — upsert()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/grades/grades.controller.ts:22 — función upsert()` con `@Put()` sin segmento de identificador, que recibe `enrollment` y `evaluation` en el cuerpo. Esta pieza crea o corrige notas de forma idempotente, por lo que la dirección del recurso debería viajar en la ruta según la semántica del método.

**[Síntoma Detectado]:** Hoy registrar o corregir una nota se hace a `PUT /api/v1/grades` con los identificadores en el cuerpo, de modo que reintentos, cachés y registros intermedios no ven la misma dirección. El sistema hoy se comporta así: el docente envía el par matrícula-evaluación en el cuerpo, el servicio busca por la tupla y crea o actualiza, pero la ruta no nombra el recurso. Es incoherente porque `PUT` promete idempotencia sobre una dirección, y aquí la dirección está escondida en el cuerpo. Además `PUT /grades/bulk` convive con `PUT /grades` sin jerarquía clara.

**[Gravedad / Impacto]:** La gravedad es media de nivel P2 porque no pierde datos hoy, pero rompe la direccionabilidad en el escenario de reintentos y auditoría, donde dos cuerpos iguales a la misma ruta son indistinguibles en el registro. Además confunde a clientes generados que esperan `PUT /grades/:id`. Se viola la semántica de métodos de la especificación HTTP RFC 9110 y la convención REST de recursos direccionables.

**Evidencia Postman:** Evidencia estática por firma de la ruta más réplica `curl` con el mismo cuerpo dos veces. Ambas devuelven éxito con el mismo efecto, pero la ruta no nombra la tupla, lo que demuestra la idempotencia sin dirección.

```text
curl -i -X PUT http://localhost:3000/api/v1/grades -H "Authorization: Bearer <docente>"
  -H "Content-Type: application/json" -d '{"enrollment":"<id>","evaluation":"<id>","value":4.2}'
  -> 200 dos veces mismo efecto (idempotente pero sin dirección; esperado PUT /grades/:enrollment/:evaluation)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en exponer la tupla en la ruta manteniendo el cuerpo para el valor, sin cambiar el servicio. El cambio se hace en el controlador. Primero se declara `@Put(':enrollment/:evaluation')` con ambos parámetros validados por `ParseObjectIdPipe`, y el cuerpo queda solo con `value`. Después se deja `bulk` como `PUT /bulk` antes de la parametrizada para que no sea capturado. Desde ese momento cada nota tiene dirección, los reintentos son visibles y el registro distingue recursos. La robustez viene de que la idempotencia se vuelve direccionable y auditable.

**[Patrón Aplicado]:** Recurso direccionable con `PUT` sobre identificador compuesto en ruta. Este patrón encaja aquí porque el defecto era la dirección en el cuerpo, y subirla a la ruta restaura la semántica sin tocar la lógica de creación o corrección.

```ts
// BackendProyecto1_Fork/src/grades/grades.controller.ts — listo para pegar (esquema)
// Debe ir antes de cualquier ruta con parámetro
@Put('bulk')
bulk(@Body() dto: BulkGradesDto, @CurrentUser() user: AuthUser) {
  return this.gradesService.bulkUpsert(dto, user);
}

// Crea la nota, o la corrige si ya existia (idempotente y direccionable)
@Put(':enrollment/:evaluation')
upsert(
  @Param('enrollment', ParseObjectIdPipe) enrollment: string,
  @Param('evaluation', ParseObjectIdPipe) evaluation: string,
  @Body() body: { value: number },
  @CurrentUser() user: AuthUser,
): Promise<Grade> {
  return this.gradesService.upsert({ enrollment, evaluation, value: body.value }, user);
}
```

Tras el cambio, la misma tupla en ruta con el mismo valor es idempotente y visible. Es robusto porque cada recurso tiene dirección y el `bulk` queda jerarquizado.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La tupla vivía en el cuerpo bajo un `PUT` sin dirección, dejando idempotencia sin domicilio. La consecuencia encadenada era reintentos indistinguibles en el registro y clientes que no podían enlazar la nota.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: `PUT /grades` sin parámetros.
2. `curl` dos veces con el mismo cuerpo a `PUT /api/v1/grades` — mismo efecto sin dirección, que es lo a direccionar.
3. Esperado tras el fix: `PUT /api/v1/grades/<mat>/<eval>` con `value` en cuerpo y mismo efecto auditable.

**[Cómo lo arregló]:** Los parámetros actúan como domicilio evaluado por el tubo antes de llegar al servicio. Al subir la tupla a la ruta, cada petición nombra su recurso y los reintentos se reconocen. El servicio recibe lo mismo pero por canales con significado distinto.

**[Argumento para el profesor]:** "Profesor, encontramos que registrar notas usaba `PUT` sin dirección con la tupla en el cuerpo, dejando idempotencia sin domicilio auditable. El impacto es medio pero estructural, porque rompe direccionabilidad y registros. Aplicamos recurso direccionable, subiendo matrícula y evaluación a la ruta y dejando el valor en el cuerpo, sin tocar el servicio. Lo evidenciamos con doble `curl` al `PUT` actual mostrando efecto sin dirección frente a la ruta con tupla esperada. Esto garantiza reintentos visibles, recursos enlazables y semántica de método correcta."
