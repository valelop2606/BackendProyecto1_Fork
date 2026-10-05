# Backend Error #01 — Prefijo global `api/v1` y Swagger `api/doc` no coinciden con la colección (`/api`) ni el README (`/api/docs`) — P0

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/main.ts:10 — bootstrap()` y `src/main.ts:26 — SwaggerModule.setup()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/main.ts:10 — app.setGlobalPrefix('api/v1')` y `BackendProyecto1_Fork/src/main.ts:26 — SwaggerModule.setup('api/doc', ...)`. Esta pieza es la puerta de entrada de toda la API, porque el prefijo global se antepone a cada controlador y la ruta de Swagger es la única documentación viva, de modo que un desajuste aquí rompe todos los clientes de golpe.

**[Síntoma Detectado]:** El backend vivo responde en `/api/v1/*`, mientras la colección Postman real y el archivo `README.md` hablan en `/api/*`. Concretamente, `GET /api/v1/health` devuelve `200 {"status":"ok","database":"up"}`, pero `GET /api/health` devuelve `404 Cannot GET /api/health`. De igual modo, `GET /api/doc` devuelve `200` con el HTML de Swagger, mientras `GET /api/docs` devuelve `404`. El sistema hoy obliga a elegir entre lo que el código sirve y lo que la colección y la documentación prometen, por lo que cualquier cliente que siga la colección falla en todas sus llamadas aunque el servidor esté sano.

**[Gravedad / Impacto]:** Se trata de un error crítico de nivel P0 porque afecta a todos los consumidores sin excepción, en el escenario más común que existe, que es seguir el `README.md` y la colección oficial. Todo el frontend y toda la batería Postman reciben `404 Not Found` aunque las credenciales y la base de datos estén correctas. Se viola el principio de contrato estable de la interfaz de programación de aplicaciones y la regla de la especificación HTTP RFC 9110 que reserva el `404` para recursos inexistentes, no para un versionado mal alineado con la documentación.

**Evidencia Postman:** Se ejecutó la colección real `postman/proyecto1-simple.postman_collection.json` con `baseUrl=http://localhost:3000` en los folders `auth` y `users`, con el backend levantado desde `dist/main.js` y MongoDB sano. Ambas carpetas devolvieron `404 Not Found` en cada request, lo que demuestra que la colección y el servidor no hablan el mismo prefijo.

```text
newman — folder auth (baseUrl=http://localhost:3000)
  POST http://localhost:3000/api/auth/login [404 Not Found]
  GET  http://localhost:3000/api/auth/me    [404 Not Found]
newman — folder users
  GET  http://localhost:3000/api/users?page=1&limit=20 [404 Not Found]
  POST http://localhost:3000/api/users                [404 Not Found]
curl equivalente:
  curl -i http://localhost:3000/api/health       -> 404 Cannot GET /api/health
  curl -i http://localhost:3000/api/v1/health    -> 200 {"status":"ok","database":"up"}
  curl -o /dev/null -w "%{http_code}" http://localhost:3000/api/doc  -> 200
  curl -o /dev/null -w "%{http_code}" http://localhost:3000/api/docs -> 404
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en alinear una sola fuente de verdad entre el código, la colección y el `README.md`. El cambio se hace en un único punto del arranque, que es la función `bootstrap()` de `src/main.ts`, sin tocar ningún controlador. Primero se decide el contrato oficial, que en este repositorio es `/api` con documentación en `/api/docs` según el `README.md` y el frontend. Después se cambia el prefijo global de `'api/v1'` a `'api'` y la ruta de Swagger de `'api/doc'` a `'api/docs'`. Desde ese momento todas las rutas registradas en el arranque, que hoy aparecen en el log como `{/api/v1/health}`, pasan a registrarse como `{/api/health}` y la colección vuelve a coincidir sin reescribirla. Como alternativa válida, si se prefiere versionar, se mantiene `api/v1` pero se actualizan el `README.md`, el frontend y la variable `baseUrl` de la colección al mismo valor, porque lo que no puede existir es un contrato doble.

**[Patrón Aplicado]:** Punto único de configuración y convención sobre configuración (principio de no repetirse, DRY, y responsabilidad única, SRP). El prefijo y la ruta de documentación viven en una sola línea del arranque en lugar de repetirse en cada controlador, de modo que el defecto original, que era la dispersión entre código y documentación, queda resuelto cambiando un solo lugar con efecto predecible en toda la superficie.

```ts
// BackendProyecto1_Fork/src/main.ts — listo para pegar (opción README: /api + /api/docs)
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // antes (mal): app.setGlobalPrefix('api/v1');
  app.setGlobalPrefix('api');
  // ... pipes y filtros sin cambios ...
  // antes (mal): SwaggerModule.setup('api/doc', app, ...);
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
```

Tras el cambio, el arranque registra `{/api/health}` y Swagger responde en `/api/docs`, por lo que la colección oficial y el frontend vuelven a funcionar sin parches por request. Es robusto porque centraliza el contrato y cualquier desvío futuro se detecta en el primer `curl` del humo.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** Tanto la rama `main` como la rama `backend` traían el prefijo `'api/v1'` y Swagger en `'api/doc'`, como lo prueba el comando `git diff main..backend -- src/main.ts`, que solo muestra el arreglo del puerto (`APP_PORT ?? 3001` hacia `PORT ?? 3000`) y ningún cambio de prefijo. Esa configuración dejaba al servidor sano en `/api/v1/health` pero sordo a la colección, que pide `/api/*`, y dejaba la documentación en `/api/doc` mientras el `README.md` promete `/api/docs`. La consecuencia encadenada era un `404` masivo con el servidor en verde.

**[Cómo se replicaba]:**

1. `npm run db:up` en `BackendProyecto1_Fork/` — deja MongoDB sano en `27017`, resultado observado: contenedor `proyecto1-mongo` en estado saludable.
2. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — arranca sin variables forzadas del puerto, resultado observado: `Nest application successfully started` con rutas `{/api/v1/health}`.
3. `curl -i http://localhost:3000/api/v1/health` — devuelve `200 {"status":"ok","database":"up"}`, que es lo esperado cuando el prefijo coincide.
4. `curl -i http://localhost:3000/api/health` — devuelve `404 Cannot GET /api/health`, que es lo anómalo que ve la colección.
5. `npx newman run "postman/proyecto1-simple.postman_collection.json" --env-var baseUrl=http://localhost:3000 --folder "auth" --reporters cli` — devuelve `404` en `Login` y `Me`, que es el fallo masivo a demostrar.

**[Cómo lo arregló]:** El ajuste actúa en la frontera del arranque, antes de que se registre ninguna ruta. Al cambiar el prefijo global, el explorador de rutas de Nest antepone el nuevo valor a cada controlador, de modo que la misma clase `HealthController` pasa de exponerse en `/api/v1/health` a exponerse en `/api/health` sin tocar su código. En paralelo, mover la ruta de Swagger de `api/doc` a `api/docs` reconcilia la documentación viva con el `README.md`. El mecanismo neutraliza el `404` en origen, porque ya no existe una ruta fantasma entre lo documentado y lo servido.

**[Argumento para el profesor]:** "Profesor, encontramos que el backend servía `/api/v1` con Swagger en `/api/doc`, mientras la colección oficial y el `README.md` prometen `/api` con Swagger en `/api/docs`, por lo que todo cliente que sigue la documentación recibe `404` con el servidor en verde. El impacto es total, porque no falla un endpoint sino el contrato completo. Aplicamos punto único de configuración en `src/main.ts`, cambiando el prefijo y la ruta de Swagger en el arranque según la convención del proyecto, con lo que el explorador de rutas re-registra todo bajo el contrato oficial. Lo evidenciamos con `curl` a `/api/v1/health` en `200` frente a `/api/health` en `404`, más Newman en `auth` y `users` con `404` sistemático usando la colección real, y con el `git diff main..backend` que muestra que el prefijo seguía sin alinear. Esto garantiza que colección, frontend y servidor vuelvan a hablar el mismo contrato y que cualquier desvío futuro se detecte en el primer humo. Este error número uno queda así cerrado y no se repite en el resto del informe."
