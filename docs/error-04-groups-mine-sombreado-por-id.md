# Backend Error #04 — `GET /groups/mine` queda sombreado por `GET /groups/:id` para el docente — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/groups/groups.controller.ts:32 — findOne()` frente a `src/groups/groups.controller.ts:40 — mine()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/groups/groups.controller.ts:32 — función findOne()` con `@Get(':id')` registrada antes que `BackendProyecto1_Fork/src/groups/groups.controller.ts:40 — función mine()` con `@Get('mine')`. Esta pieza atiende el horario del docente, por lo que su alcance determina si el docente ve sus grupos o recibe un error de identificador.

**[Síntoma Detectado]:** Hoy una petición autenticada como docente a `GET /api/v1/groups/mine` no llega a `findMine`, sino que cae en `findOne()` con `id = "mine"`. El tubo rechaza `"mine"` con `400 ID invalido`, cuando lo esperado es una lista paginada con `200` y los grupos del docente. El sistema hoy se comporta así: el docente pide sus grupos, el enrutador lo confunde con un grupo llamado `mine`, y la validación lo expulsa. Es incorrecto porque la ruta fija debe evaluarse primero, y el propio comentario del archivo lo exige pero el orden lo incumple.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque deja sin vista de grupos al rol docente, en el escenario diario de preparar clases. El administrador no lo nota porque usa el listado general, pero el docente queda sin alternativa. Se viola la convención de precedencia del enrutador Express y NestJS y el principio de diseño que reserva los literales para accesos directos del usuario autenticado.

**Evidencia Postman:** Evidencia estática por log de arranque más réplica `curl` al prefijo vivo, ya que la colección simple no trae el folder `groups`. El log muestra `{/api/v1/groups/:id, GET}` mapeado antes que `{/api/v1/groups/mine, GET}`, y el `curl` con token docente devuelve `400` en lugar de `200` paginado.

```text
log: Mapped {/api/v1/groups/:id, GET} antes que Mapped {/api/v1/groups/mine, GET}
curl -i "http://localhost:3000/api/v1/groups/mine" -H "Authorization: Bearer <docente>"
  -> 400 {"message":"ID invalido"} (anómalo; esperado 200 {data, meta})
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en mover el manejador literal por encima del parametrizado, manteniendo intactos los servicios y los guardias. El cambio se hace en el controlador con un simple reordenamiento. Primero se coloca el bloque `@Get('mine')` con `@Roles(Role.Docente)` antes del bloque `@Get(':id')`. Después se verifica que `mine` reciba al usuario autenticado y los filtros de consulta, sin tocar `findOne`. Desde ese momento el docente obtiene su lista y las búsquedas por identificador siguen validadas por el tubo. La robustez viene de que el orden queda explícito y no depende de recordar la sutileza en cada revisión.

**[Patrón Aplicado]:** Ruta específica antes que parametrizada de Express y NestJS. Este patrón encaja aquí porque el defecto era ordinal y el comentario ya lo documentaba, de modo que alinear código y comentario elimina la captura sin nueva lógica.

```ts
// BackendProyecto1_Fork/src/groups/groups.controller.ts — listo para pegar (orden)
// Debe ir antes de ':id' para que 'mine' no se interprete como un ID
@ApiOperation({ summary: 'Mis grupos (docente)' })
@Roles(Role.Docente)
@Get('mine')
mine(@CurrentUser() user: AuthUser, @Query() query: GroupsQueryDto): Promise<Paginated<Group>> {
  return this.groupsService.findMine(user.id, query);
}

@ApiOperation({ summary: 'Ver un grupo por ID' })
@Get(':id')
findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<Group> {
  return this.groupsService.findOne(id);
}
```

Tras el cambio, el docente recibe `200` paginado y los identificadores malformados siguen devolviendo `400` solo en su ruta. Es robusto porque el orden se vuelve autoevidente y cualquier regresión se detecta con un humo a `/mine`.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El literal `mine` estaba después del parámetro `:id`, por lo que el enrutador nunca lo alcanzaba y el tubo lo trataba como identificador inválido. La consecuencia encadenada era un docente autenticado que veía un error de validación al pedir su recurso más básico, mientras el listado general seguía funcionando para el administrador.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: `mine` mapeado después de `:id`.
2. `curl -i "http://localhost:3000/api/v1/groups/mine" -H "Authorization: Bearer <docente>"` — devuelve `400 ID invalido`, que es lo anómalo.
3. Esperado tras el fix: `200` con `{data:[...], meta:{total, page, limit, totalPages}}` filtrado por docente.

**[Cómo lo arregló]:** El reordenamiento actúa en el registro, que es previo a cualquier petición. Al evaluar el literal primero, la coincidencia exacta reclama la petición y el parámetro queda libre para identificadores reales. El tubo sigue protegiendo `findOne` sin interferir en `mine`, con lo que cada ruta recupera su validación natural.

**[Argumento para el profesor]:** "Profesor, encontramos que `GET /groups/mine` era inalcanzable para el docente porque `GET /groups/:id` estaba antes y capturaba el literal, devolviendo `400` en lugar de la lista paginada con `200`. El impacto es alto porque el docente pierde su vista principal de trabajo. Aplicamos la convención de específica antes que parametrizada, reordenando los manejadores y manteniendo el tubo solo en el identificador, con lo que cada ruta resuelve en su manejador. Lo evidenciamos con el log de arranque y con `curl` autenticado como docente, comparando el `400` anómalo con el `200` paginado esperado. Esto garantiza horarios docentes accesibles y validación de identificadores sin falsos positivos."
