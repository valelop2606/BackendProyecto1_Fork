# Backend Error #30 — Arranque registra el correo del admin en el log (PII en texto plano) — P2

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/users/users.service.ts:37 — onModuleInit()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/users/users.service.ts:37 — this.logger.log(`Administrador inicial creado: ${email}`)` dentro de `onModuleInit()`. Esta pieza crea el primer administrador si no existe, y al registrar el correo en informativo deja dato personal en cada despliegue fresco.

**[Síntoma Detectado]:** Hoy cada arranque sin admin imprime el correo del administrador en el log agregable, donde queda retenido por el sistema de observabilidad y visible para quien lee tableros. El sistema hoy se comporta así: verifica ausencia de admin, crea con la semilla, e informa con el identificador en claro. Es incorrecto porque los registros deben ser operativos sin datos personales, y el correo es identificador directo según la normativa de protección de datos.

**[Gravedad / Impacto]:** La gravedad es media-baja de nivel P2 porque no expone secretos, pero sí identificadores en el escenario de logs centralizados con retención larga y acceso amplio. Además normaliza registrar PII en informativo. Se viola el principio de minimización de datos en observabilidad y la guía del estándar OWASP sobre no registrar identificadores en claro en niveles bajos.

**Evidencia Postman:** Evidencia estática por lectura del log más arranque fresco, ya que Newman no cubre siembra. Con base sin admin, el log muestra el correo en claro en lugar de un resumen o un identificador opaco.

```text
JWT_SECRET="test-secret-supersecreto-1234567890" node dist/main.js (base sin admin)
  -> LOG Administrador inicial creado: admin@universidad.edu (anómalo por PII; esperado sin correo)
grep -n "Administrador inicial creado" src/users/users.service.ts -> línea 37 con email
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en informar el evento sin el identificador, manteniendo la trazabilidad por rol y tiempo. El cambio se hace en el servicio de usuarios. Primero se sustituye el mensaje con correo por `Administrador inicial creado` sin interpolación, o con un resumen irreversible si se necesita correlacionar. Después se deja la creación intacta, porque el dato sigue en base con acceso controlado. Desde ese momento el log dice que ocurrió sin decir a quién, y la auditoría vive en base con permiso. La robustez viene de que lo operativo y lo identificable dejan de viajar juntos.

**[Patrón Aplicado]:** Observabilidad sin datos personales con minimización en logs. Este patrón encaja aquí porque el defecto era la interpolación del identificador en informativo, y retirarla mantiene la señal sin el dato.

```ts
// BackendProyecto1_Fork/src/users/users.service.ts — listo para pegar
async onModuleInit(): Promise<void> {
  if (await this.userModel.exists({ role: Role.Admin })) return;
  const email = this.config.getOrThrow<string>('ADMIN_EMAIL');
  const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');
  await this.create({ name: 'Administrador', email, password, role: Role.Admin });
  // antes (mal): this.logger.log(`Administrador inicial creado: ${email}`);
  this.logger.log('Administrador inicial creado');
}
```

Tras el cambio, el arranque informa sin exponer y la base conserva el correo con acceso. Es robusto porque los tableros dejan de retener identificadores por defecto.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La siembra informaba con el correo en claro en cada despliegue fresco, reteniendo identificador en la plataforma de logs. La consecuencia encadenada era PII en retención larga con acceso amplio, sin necesidad operativa.

**[Cómo se replicaba]:**

1. Vaciar admins y `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — resultado observado: log con correo.
2. Revisar la línea agregada — muestra `admin@universidad.edu`, que es lo anómalo.
3. Esperado tras el fix: `Administrador inicial creado` sin identificador.

**[Cómo lo arregló]:** El mensaje actúa como señal operativa que no necesita el quién para saber que ocurrió. Al retirar la interpolación, la información sensible deja de emitirse y la correlación vive en base con permiso. La observabilidad conserva el evento sin el dato.

**[Argumento para el profesor]:** "Profesor, encontramos que la siembra del admin registraba su correo en el log informativo, reteniendo identificador en la observabilidad sin necesidad. El impacto es medio en privacidad, porque normaliza PII en tableros con retención larga. Aplicamos minimización en logs, informando el evento sin el correo y manteniendo el dato solo en base, sin tocar la creación. Lo evidenciamos con el arranque fresco mostrando el correo frente al mensaje sin identificador esperado. Esto garantiza logs operativos sin datos personales, auditoría en base con permiso y una observabilidad que no retiene de más."
