# Backend Error #15 — Cambiar contraseña no guarda y el usuario cree que rotó sin rotar — P0

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/users/users.service.ts:123 — changePassword()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/users/users.service.ts:123 — función changePassword()` que asigna `passwordHash` y `passwordChangedAt` pero retorna sin `save()`, frente a `src/users/users.service.ts:145 — setPassword()` que sí guarda. Esta pieza es la rotación voluntaria de credenciales, por lo que olvidar persistir deja la seguridad en una ilusión.

**[Síntoma Detectado]:** Hoy el usuario cambia su clave, recibe un token nuevo con `200` y asume que la anterior quedó inválida, pero la base conserva el resumen viejo porque nunca se guardó. El sistema hoy se comporta así: verifica la actual, calcula el nuevo resumen en memoria, actualiza la fecha en memoria y devuelve éxito sin escribir. Es incorrecto porque la rotación debe ser atómica entre la escritura del resumen y la emisión del token, y la fecha de cambio que invalida tokens previos queda solo en memoria efímera.

**[Gravedad / Impacto]:** La gravedad es crítica de nivel P0 porque deja credenciales comprometidas vigentes en el escenario de rotación por sospecha, con el usuario creyendo lo contrario. Además los tokens previos, que deberían invalidarse por `passwordChangedAt`, siguen válidos. Se viola el principio de fallo seguro en gestión de credenciales y la expectativa del estándar OWASP sobre invalidación de sesiones tras cambio de clave.

**Evidencia Postman:** Evidencia estática por lectura del flujo más réplica `curl` a `PATCH /api/v1/auth/change-password` seguida de login con la nueva y la vieja. Tras el cambio, la vieja sigue entrando con `200` y la nueva falla con `401`, lo que demuestra la falta de escritura.

```text
curl -i -X PATCH http://localhost:3000/api/v1/auth/change-password -H "Authorization: Bearer <token>"
  -H "Content-Type: application/json" -d '{"currentPassword":"Clave12345","newPassword":"NuevaClave123"}'
  -> 200 {accessToken} (éxito aparente)
curl login con nueva -> 401 (anómalo; esperado 200)
curl login con vieja -> 200 (anómalo; esperado 401)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en persistir antes de emitir, reutilizando el camino que ya guarda. El cambio se hace en el servicio de usuarios. Primero se reemplaza la asignación manual por la llamada al método privado `setPassword`, o se agrega `await user.save()` tras fijar el resumen y la fecha. Después se mantiene la emisión del token en `AuthService` posterior al guardado, con lo que la invalidación por fecha ya opera sobre dato persistido. Desde ese momento la rotación escribe y luego habla. La robustez viene de que un solo camino guarda todas las rotaciones, evitando la divergencia entre cambio propio y restablecimiento por admin.

**[Patrón Aplicado]:** Escritura antes de emisión con reutilización del método de persistencia. Este patrón encaja aquí porque el defecto era la omisión del guardado en una de dos rutas, y unificarlas elimina la divergencia sin nueva lógica condicional.

```ts
// BackendProyecto1_Fork/src/users/users.service.ts — listo para pegar
async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<UserDocument> {
  const user = await this.userModel.findById(userId).select('+passwordHash').exec();
  if (!user) throw new NotFoundException('Usuario no encontrado');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new BadRequestException('La contrasena actual es incorrecta');
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new BadRequestException('La nueva contrasena debe ser distinta de la actual');
  }
  // antes (mal): asignar sin save y retornar; después (bien): persistir
  return this.setPassword(user, newPassword);
}
```

Tras el cambio, la nueva entra con `200` y la vieja queda en `401`, con tokens previos invalidados por fecha. Es robusto porque toda rotación pasa por el mismo guardado y la emisión solo ocurre sobre dato escrito.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La función calculaba el nuevo resumen y la fecha pero retornaba el documento sin guardar, mientras la ruta hermana de restablecimiento sí guardaba. La consecuencia encadenada era éxito aparente con secreto viejo vigente y sesiones previas nunca invalidadas.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: cambio con `200` y token nuevo.
2. `curl` de cambio con actual y nueva — devuelve `200`, que es lo aparente.
3. `curl` de login con la nueva — devuelve `401` anómalo frente al `200` esperado, y con la vieja devuelve `200` anómalo frente al `401` esperado.

**[Cómo lo arregló]:** El guardado actúa entre la verificación y la emisión, escribiendo resumen y fecha en la misma operación. Al persistir primero, la validación de `passwordChangedAt` en la estrategia JWT ya ve la fecha real y rechaza tokens previos. La emisión posterior solo anuncia lo ya escrito, con lo que el éxito deja de ser una promesa en memoria.

**[Argumento para el profesor]:** "Profesor, encontramos que el cambio de contraseña no guardaba, por lo que devolvía token nuevo con el secreto viejo vigente y sesiones previas sin invalidar. El impacto es crítico porque deja credenciales comprometidas activas tras una rotación por sospecha. Aplicamos escritura antes de emisión, reutilizando el guardado común sin tocar la emisión, con lo que la rotación escribe y luego habla. Lo evidenciamos con cambio seguido de logins con nueva y vieja, mostrando la inversión frente al `200` y `401` esperados. Esto garantiza rotaciones reales, sesiones previas invalidadas y una sola ruta de guardado auditable."
