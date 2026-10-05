# Backend Error #03 — `GET /users/me` queda sombreado por `GET /users/:id` y nunca se alcanza — P0

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/users/users.controller.ts:42 — findOne()` frente a `src/users/users.controller.ts:50 — me()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/users/users.controller.ts:42 — función findOne()` declarada con `@Get(':id')` antes que `BackendProyecto1_Fork/src/users/users.controller.ts:50 — función me()` con `@Get('me')`. Esta pieza define el orden de registro del enrutador, y en Nest el primer patrón parametrizado captura el segmento literal `me` si se declara primero, de modo que el orden es contrato funcional.

**[Síntoma Detectado]:** Hoy una petición a `GET /api/v1/users/me` con token válido no llega al perfil propio, sino que cae en `findOne()` con `id = "me"`. El tubo `ParseObjectIdPipe` rechaza `"me"` con `400 ID invalido`, cuando lo esperado es el documento del usuario autenticado con `200`. El sistema hoy narra el fallo así: el cliente pide su perfil, el enrutador lo confunde con un identificador, y la validación lo castiga. Es incorrecto porque la ruta fija `me` debe tener precedencia sobre el parámetro, y el propio comentario del archivo lo advierte pero el código hace lo contrario.

**[Gravedad / Impacto]:** La gravedad es crítica de nivel P0 porque inutiliza el perfil propio para todos los roles, en el escenario más cotidiano que es abrir la sesión y pedir `me`. Cualquier pantalla de cuenta queda rota aunque el token sea válido. Se viola el principio de enrutamiento específico antes que genérico de los marcos Express y NestJS, y la expectativa de la especificación HTTP de que una ruta documentada responda según su contrato.

**Evidencia Postman:** La colección real no trae `users/Me`, pero el patrón se replica con `curl` directo al prefijo vivo y con el log de arranque, que lista `{/api/v1/users/:id, GET}` antes que `{/api/v1/users/me, GET}`. La prueba con token de administrador muestra el `400` anómalo en lugar del `200` con el perfil.

```text
curl -i http://localhost:3000/api/v1/users/me -H "Authorization: Bearer <token>"
  -> 400 {"message":"ID invalido"} (anómalo; esperado 200 con el usuario)
log de arranque: Mapped {/api/v1/users/:id, GET} antes que Mapped {/api/v1/users/me, GET}
Newman users con baseUrl=http://localhost:3000 -> 404 por #01; tras alinear a /api/v1,
  este #03 emerge como 400 en /me.
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en registrar primero lo específico y después lo genérico, sin cambiar firmas ni lógica de negocio. El cambio se hace solo reordenando dos manejadores dentro de la clase del controlador. Primero se mueve el bloque `@Get('me')` con su guardia de roles por encima del bloque `@Get(':id')`. Después se deja el tubo `ParseObjectIdPipe` únicamente en el parámetro, donde sí tiene sentido. Desde ese momento el enrutador prueba `me` antes de intentar el identificador, y las peticiones con `ObjectId` real siguen cayendo en `findOne`. La robustez viene de que no se agrega lógica condicional, solo se respeta la precedencia del marco.

**[Patrón Aplicado]:** Ruta específica antes que parametrizada, que es la convención de enrutamiento de Express y NestJS. Este patrón encaja aquí porque el defecto original era puramente ordinal, y mover el bloque elimina la captura sin introducir ramas ni expresiones regulares adicionales.

```ts
// BackendProyecto1_Fork/src/users/users.controller.ts — listo para pegar (orden)
// Perfil propio: disponible para cualquier rol. Debe ir antes de ':id'
@ApiOperation({ summary: 'Mi perfil de usuario' })
@Roles(Role.Admin, Role.Docente, Role.Estudiante)
@Get('me')
me(@CurrentUser() user: AuthUser): Promise<User> {
  return this.usersService.findOne(user.id);
}

@ApiOperation({ summary: 'Ver un usuario por ID' })
@Get(':id')
findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<User> {
  return this.usersService.findOne(id);
}
```

Tras el cambio, `GET /me` devuelve `200` con el perfil y `GET /:id` sigue validando identificadores con `400` solo cuando corresponde. Es robusto porque el orden queda blindado por el propio comentario y por una prueba de humo a ambas rutas.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El manejador `@Get(':id')` estaba registrado antes que `@Get('me')`, de modo que el segmento `me` se interpretaba como identificador y el tubo lo rechazaba. La consecuencia encadenada era que ningún usuario podía ver su perfil por la ruta documentada, aunque `PATCH /me` sí existía para editarlo, dejando una asimetría visible.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: log con `:id` mapeado antes que `me`.
2. `curl -i http://localhost:3000/api/v1/users/me -H "Authorization: Bearer <token>"` — devuelve `400 ID invalido`, que es lo anómalo.
3. Esperado tras el fix: `200` con `{"_id":"...","name":"...","email":"...","role":"..."}` sin exponer el resumen secreto.

**[Cómo lo arregló]:** El reordenamiento actúa en el momento del registro de rutas, que ocurre una sola vez al arrancar. Al probar el literal `me` antes que el parámetro, el enrutador ya no necesita adivinar la intención, porque la coincidencia exacta gana por diseño. El tubo de identificador queda confinado a donde pertenece y deja de castigar la ruta fija, con lo que ambos contratos coexisten sin interferencia.

**[Argumento para el profesor]:** "Profesor, encontramos que `GET /users/me` era inalcanzable porque `GET /users/:id` estaba declarado antes y capturaba el segmento `me`, devolviendo `400` en lugar del perfil con `200`. El impacto es crítico porque rompe la pantalla de cuenta para todos los roles con token válido. Aplicamos la convención de ruta específica antes que parametrizada de Express y NestJS, reordenando los manejadores sin tocar la lógica, con lo que el enrutador resuelve cada caso en su manejador. Lo evidenciamos con el log de arranque que muestra el orden invertido y con `curl` al endpoint vivo de perfil, comparando el `400` anómalo con el `200` esperado. Esto garantiza perfiles accesibles, identificadores seguir validados y un orden que ya no depende de la memoria del lector sino del propio registro."
