# Backend Error #27 — Borrar notificación sin `@Roles()` confía solo en el chequeo interior (IDOR al límite) — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/deletions/deletions.controller.ts:37 — notification()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/deletions/deletions.controller.ts:37 — función notification()` con `@Delete('notifications/:id')` sin `@Roles()`, que delega a `src/deletions/deletions.service.ts:78 — removeNotification()` con `if (String(notification.user) !== userId) throw Forbidden`. Esta pieza borra avisos personales, por lo que la frontera debería declarar audiencia aunque el interior verifique dueño.

**[Síntoma Detectado]:** Hoy cualquier autenticado puede invocar el borrado de cualquier identificador, y solo el chequeo interior lo frena si no es dueño. El sistema hoy se comporta así: el atacante enumera identificadores, el servicio los carga y compara, y devuelve `403` si no coinciden o borra si coinciden por error de dato. Es riesgoso porque la defensa vive en una sola capa y cada olvido futuro es borrado ajeno, además de permitir sondeo por diferencia entre `404` y `403`.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque habilita sondeo y borrado al límite en el escenario de enumeración de identificadores, donde el atacante distingue existentes de inexistentes por el código. Aunque hoy el interior frena, la frontera no ayuda. Se viola el principio de defensa en profundidad del estándar OWASP y la guía que pide audiencia explícita en mutaciones personales.

**Evidencia Postman:** Evidencia estática por ausencia de `@Roles` más réplica `curl` con token ajeno a notificación ajena. Con identificador ajeno, la respuesta es `403` del interior en lugar de `403` de frontera con audiencia, y con identificador inexistente es `404`, lo que demuestra el sondeo.

```text
curl -i -X DELETE http://localhost:3000/api/v1/notifications/<ajeno> -H "Authorization: Bearer <otro>"
  -> 403 del interior (correcto hoy pero sin frontera; esperado 403 con audiencia + dueño)
curl -i -X DELETE http://localhost:3000/api/v1/notifications/<inexistente> -H "Authorization: Bearer <x>"
  -> 404 (permite sondeo por diferencia)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en declarar audiencia en la frontera y mantener el chequeo de dueño en el interior, con respuestas indistinguibles para ajenos. El cambio se hace en controlador y servicio. Primero se agrega `@Roles(Role.Admin, Role.Docente, Role.Estudiante)` para exigir rol conocido, sin abrir a anónimos. Después se mantiene `removeNotification` con comparación de dueño, pero devolviendo `404` genérico para ajenos e inexistentes a fin de no revelar existencia. Desde ese momento hay dos capas y el sondeo se ciega. La robustez viene de que la frontera filtra y el interior decide, sin que una sustituya a la otra.

**[Patrón Aplicado]:** Defensa en profundidad con audiencia en frontera y propiedad en dominio. Este patrón encaja aquí porque el defecto era la capa única, y duplicarla con semántica de no revelación cierra el sondeo sin cambiar el éxito del dueño.

```ts
// BackendProyecto1_Fork/src/deletions/deletions.controller.ts — listo para pegar
@ApiOperation({ summary: 'Elimina una de mis notificaciones' })
@Roles(Role.Admin, Role.Docente, Role.Estudiante)
@Delete('notifications/:id')
notification(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser): Promise<Deleted> {
  return this.deletionsService.removeNotification(id, user.id);
}
```

```ts
// BackendProyecto1_Fork/src/deletions/deletions.service.ts — fragmento listo para pegar
async removeNotification(id: string, userId: string): Promise<Deleted> {
  const notification = await this.mustExist<NotificationDocument>(this.notificationModel, id, 'Notificacion');
  // antes (mal): 403 revela existencia; después (bien): 404 genérico para ajenos
  if (String(notification.user) !== userId) throw new NotFoundException('Notificacion no encontrada');
  await this.notificationModel.deleteOne({ _id: id });
  return this.done('notifications', id);
}
```

Tras el cambio, el dueño borra con éxito y el ajeno recibe `404` indistinguible. Es robusto porque el sondeo deja de distinguir y el borrado sigue para su dueño.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La ruta no declaraba audiencia y el servicio distinguía `403` de `404`, permitiendo inferir existencia. La consecuencia encadenada era enumeración de avisos ajenos por diferencia de códigos, con borrado a un error de dato de distancia.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: ruta sin `@Roles`.
2. `curl` ajeno a notificación ajena — devuelve `403`, que es lo a cegar, frente al `404` genérico esperado.
3. Esperado tras el fix: dueño con éxito y ajeno con `404` indistinguible.

**[Cómo lo arregló]:** La audiencia actúa como primer filtro que exige rol conocido, y el `404` genérico actúa como segundo que no revela existencia. Al unificar la respuesta para ajenos e inexistentes, el atacante deja de aprender por código. El dueño no nota el cambio porque su camino sigue intacto.

**[Argumento para el profesor]:** "Profesor, encontramos que borrar notificaciones no declaraba audiencia y distinguía `403` de `404`, permitiendo sondeo de avisos ajenos con una sola capa de defensa. El impacto es alto por enumeración y borrado al límite. Aplicamos defensa en profundidad, con audiencia en frontera y `404` genérico para ajenos, manteniendo el éxito del dueño. Lo evidenciamos con `curl` ajeno mostrando `403` revelador frente al `404` ciego esperado. Esto garantiza avisos solo para su dueño, sondeo sin señal y dos capas en lugar de una."
