# Backend Error #13 — `UpdateUserDto` trae `namesssss` y hace imposible editar el nombre por API — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/users/dto/user.dto.ts:14 — UpdateUserDto.namesssss`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/users/dto/user.dto.ts:14 — propiedad namesssss` dentro de `UpdateUserDto`. Esta pieza es el contrato de edición por el administrador, y como el tubo global usa `whitelist` con `forbidNonWhitelisted`, cualquier clave no declarada se rechaza, de modo que un nombre de propiedad erróneo convierte la operación en imposible.

**[Síntoma Detectado]:** Hoy el administrador envía `PATCH /api/v1/users/:id` con `{"name":"Nuevo Nombre"}` y recibe `400 property name should not exist`, porque el DTO solo conoce `namesssss`. Si envía `{"namesssss":"Nuevo Nombre"}` pasa el tubo pero el servicio hace `user.set(dto)` sobre un campo inexistente en el esquema, sin cambiar el nombre real. El sistema hoy se comporta así: el cliente correcto es castigado y el cliente que adivina el error no logra el efecto. Es incorrecto porque el contrato debe exponer `name` como en la creación y el perfil.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque anula la edición de nombres en el escenario de corrección de datos, obligando a edición directa en base. Además confunde la telemetría con `400` en cuerpos correctos. Se viola el principio de contratos veraces de la interfaz y la regla de validación estricta que exige que lo declarado coincida con el modelo.

**Evidencia Postman:** Evidencia estática por lectura del DTO más réplica `curl` al prefijo vivo con token de administrador. Con cuerpo `{"name":"..."}`, la respuesta es `400` por propiedad desconocida en lugar de `200` con el usuario actualizado.

```text
curl -i -X PATCH http://localhost:3000/api/v1/users/<id> -H "Authorization: Bearer <admin>"
  -H "Content-Type: application/json" -d '{"name":"Nuevo Nombre"}'
  -> 400 {"message":["property name should not exist"]} (anómalo; esperado 200 con name actualizado)
grep -n "namesssss" src/users/dto/user.dto.ts -> línea 14 con el typo
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en devolver al contrato su nombre real en una sola propiedad, sin tocar el servicio. El cambio se hace en el DTO. Primero se renombra `namesssss` a `name` manteniendo `@IsOptional()`, `@IsString()` y `@IsNotEmpty()`. Después se verifica que `UsersService.update` ya hace `user.set(dto)`, por lo que el nombre vuelve a persistirse sin más cambios. Desde ese momento el cuerpo correcto pasa el tubo y el nombre se actualiza, mientras las claves extra siguen rechazadas. La robustez viene de que el contrato y el esquema vuelven a compartir el mismo vocabulario.

**[Patrón Aplicado]:** Contrato veraz con transferencia validada y lista blanca estricta. Este patrón encaja aquí porque el defecto era léxico en la frontera, y corregir el literal restaura la operación sin abrir la puerta a asignación masiva.

```ts
// BackendProyecto1_Fork/src/users/dto/user.dto.ts — listo para pegar
export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  // antes (mal): namesssss?: string; después (bien): name
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
  // role y active sin cambios
}
```

Tras el cambio, `PATCH` con `{"name":"..."}` devuelve `200` con el nombre cambiado y `{"namesssss":"..."}` devuelve `400`. Es robusto porque la lista blanca vuelve a proteger sin castigar lo legítimo.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El DTO exponía un nombre corrupto, de modo que el tubo rechazaba lo correcto y el servicio ignoraba lo corrupto. La consecuencia encadenada era una operación documentada como editar usuario que no podía editar el campo más básico.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: DTO con `namesssss`.
2. `curl -i -X PATCH http://localhost:3000/api/v1/users/<id> -H "Authorization: Bearer <admin>" -H "Content-Type: application/json" -d '{"name":"Nuevo Nombre"}'` — devuelve `400`, que es lo anómalo.
3. Esperado tras el fix: `200` con `{"name":"Nuevo Nombre", ...}` persistido.

**[Cómo lo arregló]:** El decorador actúa en el tubo antes de llegar al servicio, comparando claves del cuerpo con las declaradas. Al corregir el literal, la clave legítima pasa la lista blanca y `user.set(dto)` la aplica al documento. Las claves extra siguen rechazadas, por lo que la protección contra asignación masiva se mantiene.

**[Argumento para el profesor]:** "Profesor, encontramos que la edición de usuarios declaraba `namesssss` en lugar de `name`, por lo que el cuerpo correcto era rechazado con `400` y el cuerpo con el error no cambiaba nada. El impacto es alto porque anula la corrección de nombres por API. Aplicamos contrato veraz, renombrando la propiedad en el DTO sin tocar el servicio, con lo que la lista blanca vuelve a distinguir lo legítimo de lo extra. Lo evidenciamos con lectura del DTO y con `curl` de administrador, mostrando el `400` anómalo frente al `200` con nombre actualizado esperado. Esto garantiza ediciones posibles, validación estricta intacta y un contrato que coincide con el modelo."
