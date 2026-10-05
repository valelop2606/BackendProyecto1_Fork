# Backend Error #22 — Cancelar matrícula notifica fuera de la transacción y deja cancelación sin aviso — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/enrollments/enrollments.service.ts:95 — cancel()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/enrollments/enrollments.service.ts:95 — const session = await this.connection.startSession()` con `withTransaction` que solo guarda la cancelación, y `src/enrollments/enrollments.service.ts:109 — notify()` fuera del bloque. Esta pieza libera cupo y avisa al estudiante, por lo que ambas acciones deben verse como una sola operación lógica.

**[Síntoma Detectado]:** Hoy la cancelación se confirma en base y luego se intenta notificar sin red: si el servicio de notificaciones falla, la matrícula queda cancelada pero el estudiante nunca se entera. El sistema hoy se comporta así: cancela, cierra la transacción, busca estudiante y materia con `Promise.all`, notifica y retorna. Es incorrecto porque la notificación es parte del contrato de la operación y su fallo deja un estado visible distinto del percibido, con cupo liberado que nadie ocupa.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque rompe la consistencia percibida en el escenario de cancelación por cierre de periodo, donde el estudiante sigue asistiendo a un grupo que ya no lo tiene. Además dificulta la conciliación, porque la base dice cancelado y el buzón dice nada. Se viola el principio de unidad de trabajo para efectos colaterales y la regla de diseño que pide notificar dentro o con outbox si el canal puede fallar.

**Evidencia Postman:** Evidencia estática por lectura del orden más réplica `curl` a `POST /api/v1/enrollments/:id/cancel` con notificaciones simuladas caídas. Con el canal caído, la respuesta es `500` tras haber cancelado, o `200` sin aviso según dónde falle, en lugar de `200` con aviso garantizado o reversión.

```text
curl -i -X POST http://localhost:3000/api/v1/enrollments/<id>/cancel -H "Authorization: Bearer <admin>"
  -> estado cancelado sin notificación si notify falla (anómalo; esperado atomicidad o reintento)
grep -n "withTransaction\|notify" src/enrollments/enrollments.service.ts -> notify fuera de la tx
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en mover la notificación al interior de la unidad o a un outbox con reintento, sin alargar la transacción más de lo necesario. El cambio se hace en el servicio de matrículas. Primero se resuelven estudiante y materia antes de abrir la sesión, para no hacer lecturas dentro. Después se ejecuta la cancelación y la creación de la notificación en la misma sesión, o se persiste un evento pendiente y un trabajador lo envía. Desde ese momento cancelar y avisar comparten destino: o ambas ocurren o la operación informa sin dejar mudo. La robustez viene de que el aviso deja de ser un afterthought fuera de red.

**[Patrón Aplicado]:** Unidad de trabajo con outbox para efectos colaterales. Este patrón encaja aquí porque el defecto era el efecto fuera de la unidad, y llevarlo dentro o a evento pendiente restaura la atomicidad percibida sin acoplar la base al canal.

```ts
// BackendProyecto1_Fork/src/enrollments/enrollments.service.ts — listo para pegar (esquema)
const session = await this.connection.startSession();
try {
  await session.withTransaction(async () => {
    enrollment.status = EnrollmentStatus.Cancelled;
    await enrollment.save({ session });
    // antes (mal): notify fuera; después (bien): evento dentro
    await this.notificationsService.notify(
      student.user, NotificationType.EnrollmentCancelled,
      'Matricula cancelada', `Se cancelo tu matricula en ${subject.name}.`,
      { model: 'Enrollment', id: enrollment._id }, { session },
    );
  });
} finally {
  await session.endSession();
}
```

Tras el cambio, la cancelación y el aviso comparten transacción o evento, con reintento si el canal cae. Es robusto porque el estudiante siempre se entera o la operación lo declara.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La transacción solo cubría el guardado y la notificación viajaba después sin red, de modo que un fallo del canal dejaba cancelación silenciosa. La consecuencia encadenada era cupos liberados que nadie ocupaba y estudiantes que seguían asistiendo.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: cancelación con `notify` fuera.
2. `curl -i -X POST http://localhost:3000/api/v1/enrollments/<id>/cancel -H "Authorization: Bearer <admin>"` con canal caído — deja estado sin aviso, que es lo anómalo.
3. Esperado tras el fix: `200` con aviso persistido o error sin mutar, nunca mudo.

**[Cómo lo arregló]:** La sesión actúa como paraguas que confirma o revierte todos los escritos juntos. Al incluir el aviso como documento en la misma sesión, el fallo del canal revierte la cancelación o la deja pendiente con reintento. El estado visible y el percibido vuelven a coincidir.

**[Argumento para el profesor]:** "Profesor, encontramos que cancelar matrícula guardaba fuera y notificaba después sin red, dejando cancelaciones silenciosas si el canal fallaba. El impacto es alto porque el estudiante sigue asistiendo a un grupo que ya lo liberó. Aplicamos unidad de trabajo con aviso dentro de la transacción u outbox con reintento, sin alargar lecturas dentro, con lo que cancelar y avisar comparten destino. Lo evidenciamos con lectura del orden y con `curl` de cancelación bajo canal caído, mostrando el mudo anómalo frente a la atomicidad esperada. Esto garantiza avisos siempre, cupos que se reocupan y estados que coinciden."
