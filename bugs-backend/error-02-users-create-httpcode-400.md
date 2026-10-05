# Backend Error #02 — Crear usuario responde `400` en éxito cuando debería responder `201` — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/users/users.controller.ts:28 — create()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/users/users.controller.ts:28 — función create()`, con el decorador `@HttpCode(400)` sobre el manejador `POST /users`. Esta pieza es la puerta de creación de identidades, por lo que su código de estado define si los clientes distinguen una creación exitosa de un error de validación.

**[Síntoma Detectado]:** Hoy el sistema crea el usuario en MongoDB pero devuelve `400 Bad Request` aunque todo salió bien, porque el decorador fuerza ese código de forma incondicional. Un cliente que siga la especificación HTTP interpreta el `400` como fallo y reintenta o muestra error, cuando en realidad el registro ya existe. El comportamiento es incorrecto porque invierte la semántica del protocolo: el éxito de creación debe anunciarse con `201 Created`, y el `400` debe reservarse para cuerpos inválidos detectados por el tubo de validación.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque rompe la automatización de altas y contamina la telemetría, ya que cada alta exitosa cuenta como error en los tableros. Cualquier flujo de aprovisionamiento que valide el código de estado falla en el escenario feliz. Se viola la especificación HTTP RFC 9110, que asigna el `201` a la creación con cuerpo de representación, y el principio de menor sorpresa para el consumidor de la interfaz.

**Evidencia Postman:** Se usó la colección real `postman/proyecto1-simple.postman_collection.json`, folder `users/Crear`, con `POST {{baseUrl}}/api/users` y cuerpo de ejemplo de la colección. Con el prefijo corregido a `/api/v1`, la respuesta observada en éxito es `400` en lugar de `201`, lo que demuestra la inversión del código. El humo Newman del folder `users` ya mostró `404` por el prefijo, por lo que la prueba fina se replica con `curl` directo al prefijo vivo.

```text
curl -i -X POST http://localhost:3000/api/v1/users -H "Authorization: Bearer <admin>"
  -H "Content-Type: application/json"
  -d '{"name":"Maria Lopez","email":"maria@universidad.edu","password":"Clave12345","role":"estudiante"}'
  -> 400 (anómalo en éxito; esperado 201 con {id,name,email,role})
Newman users/Listar+Crear con baseUrl=http://localhost:3000 -> 404 por #01 (prefijo),
  que enmascara este #02 hasta alinear el contrato.
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en devolver el código que corresponde a la semántica de la operación, dejando que los errores reales los produzca la capa de validación. El cambio se hace en un solo decorador del controlador, sin tocar el servicio. Primero se sustituye `@HttpCode(400)` por `@HttpCode(201)` en el manejador de creación. Después se mantiene el cuerpo de respuesta mínima con `id`, `name`, `email` y `role`, sin exponer el resumen de la contraseña. Desde ese momento el camino feliz devuelve `201` y el camino de cuerpo inválido sigue devolviendo `400` desde el tubo global, con lo que ambos caminos quedan distinguibles. La robustez viene de no codificar el error a mano, sino de dejar que cada capa emita su propio código.

**[Patrón Aplicado]:** Códigos HTTP semánticos según RFC 9110 más delegación al tubo de validación. Este patrón encaja aquí porque el defecto original era la suplantación del código de error en el controlador, y al devolver la responsabilidad a quien corresponde se restaura el contrato sin lógica condicional adicional.

```ts
// BackendProyecto1_Fork/src/users/users.controller.ts — listo para pegar
@ApiOperation({ summary: 'Crear un usuario' })
@Post()
@HttpCode(201)
async create(@Body() dto: CreateUserDto): Promise<{ id: string; name: string; email: string; role: Role }> {
  const user = await this.usersService.create(dto);
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
```

Tras el cambio, el éxito se anuncia con `201` y el cuerpo sigue sin filtrar el resumen secreto, por lo que los clientes pueden ramificar sin ambigüedad. Es robusto porque elimina una rama falsa de error y deja un único origen para cada código.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El controlador forzaba `@HttpCode(400)` sobre la creación, de modo que Nest devolvía `400` incluso cuando el servicio persistía el documento y retornaba el usuario. La consecuencia encadenada era que el cliente veía un error, el registro existía, y un reintento producía un `409` por correo duplicado que parecía un segundo error distinto.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: `Nest application successfully started` con `{/api/v1/users, POST}`.
2. `curl -i -X POST http://localhost:3000/api/v1/users -H "Authorization: Bearer <admin>" -H "Content-Type: application/json" -d '{"name":"Maria Lopez","email":"maria@universidad.edu","password":"Clave12345","role":"estudiante"}'` — devuelve `400` con el usuario ya creado, que es lo anómalo.
3. Esperado tras el fix: `201` con `{"id":"...","name":"Maria Lopez","email":"maria@universidad.edu","role":"estudiante"}` y `Location` implícita en el cuerpo.

**[Cómo lo arregló]:** El cambio actúa en la capa de presentación, que es donde Nest decide el código de la respuesta. Al declarar `201`, el interceptor de la respuesta ya no necesita inspeccionar el cuerpo para saber si hubo éxito, porque el propio protocolo lo transporta. El tubo global de validación sigue interceptando los cuerpos inválidos antes de llegar al servicio y emitiendo `400` genuinos, de modo que cada código recupera su significado y el cliente puede confiar en la primera cifra.

**[Argumento para el profesor]:** "Profesor, encontramos que la creación de usuarios devolvía `400` en éxito por un decorador fijo en el controlador, lo que hacía que cada alta pareciera un error y provocaba reintentos que terminaban en `409` por duplicado. El impacto es alto porque rompe el aprovisionamiento automático y ensucia las métricas. Aplicamos códigos semánticos según la especificación HTTP RFC 9110, cambiando a `201` en el camino feliz y dejando el `400` genuino en el tubo de validación, con lo que cada capa emite su propio código. Lo evidenciamos con `curl` al endpoint vivo de creación y con la colección Postman del folder `users`, mostrando el `400` anómalo frente al `201` esperado. Esto garantiza altas predecibles, clientes sin ramas adivinadas y tableros que vuelven a distinguir éxito de error."
