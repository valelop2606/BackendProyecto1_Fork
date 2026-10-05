# Backend Error #14 — Crear usuario no normaliza el correo y rompe el login con mayúsculas — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/users/users.service.ts:40 — create()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/users/users.service.ts:40 — función create()` que persiste `dto.email` tal cual, frente a `BackendProyecto1_Fork/src/users/users.service.ts:83 — findByEmailWithPassword()` que busca con `email.toLowerCase()`. Esta pieza decide la identidad canónica del usuario, porque el esquema declara `lowercase: true` pero la escritura manual puede adelantarse a la normalización según el camino.

**[Síntoma Detectado]:** Hoy crear `Maria@Universidad.edu` guarda una variante sin normalizar en el camino del servicio, mientras el login busca `maria@universidad.edu` en minúsculas. El sistema hoy se comporta así: el alta devuelve éxito, el usuario intenta entrar con la misma dirección en minúsculas y recibe `401 Credenciales invalidas`, aunque la contraseña es correcta. Es incorrecto porque el correo debe tener una sola forma canónica en escritura y lectura, y la divergencia deja cuentas que existen pero no entran.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque bloquea el acceso en el escenario de registro con mayúsculas, que es común al copiar desde formularios. Además permite duplicados lógicos que el índice único insensible no siempre frena según la colación. Se viola el principio de normalización en frontera y la regla de identidad única del dominio de usuarios.

**Evidencia Postman:** Evidencia estática por lectura cruzada de escritura y lectura más réplica `curl` de alta con mayúsculas seguida de login en minúsculas. El alta devuelve éxito y el login devuelve `401`, lo que demuestra la divergencia.

```text
curl -i -X POST http://localhost:3000/api/v1/users -H "Authorization: Bearer <admin>"
  -H "Content-Type: application/json" -d '{"name":"Maria","email":"Maria@Universidad.edu","password":"Clave12345"}'
  -> éxito (anómalo por no normalizar)
curl -i -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json"
  -d '{"email":"maria@universidad.edu","password":"Clave12345"}'
  -> 401 (anómalo; esperado 200 con token)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en canonalizar una sola vez en la escritura, antes de persistir, y recortar espacios. El cambio se hace en el servicio de usuarios. Primero se normaliza con `dto.email.toLowerCase().trim()` al construir el documento. Después se mantiene la búsqueda en minúsculas ya existente, con lo que ambos caminos coinciden. Desde ese momento cualquier variante de mayúsculas colapsa a la misma identidad y el índice único la protege. La robustez viene de que la normalización vive junto a la persistencia y no depende de que el cliente la haga.

**[Patrón Aplicado]:** Normalización en frontera con identidad canónica única. Este patrón encaja aquí porque el defecto era la divergencia entre escritura y lectura, y canonalizar en el origen elimina la clase completa de duplicados y fallos de acceso.

```ts
// BackendProyecto1_Fork/src/users/users.service.ts — listo para pegar
async create(dto: CreateUserDto): Promise<UserDocument> {
  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
  // antes (mal): email: dto.email; después (bien): canónico
  return this.userModel.create({
    name: dto.name.trim(),
    email: dto.email.toLowerCase().trim(),
    role: dto.role ?? Role.Estudiante,
    passwordHash,
  });
}
```

Tras el cambio, el alta con mayúsculas y el login en minúsculas convergen a `200` con token. Es robusto porque una sola forma viaja a la base y el índice la hace cumplir.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La escritura guardaba sin canonalizar mientras la lectura buscaba en minúsculas, dejando identidades que existían pero no se encontraban. La consecuencia encadenada era altas exitosas con logins fallidos y duplicados lógicos por capitalización.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: alta con mayúsculas aceptada.
2. `curl` de alta con `Maria@Universidad.edu` — devuelve éxito, que es lo a normalizar.
3. `curl` de login con `maria@universidad.edu` — devuelve `401`, que es lo anómalo, frente al `200` con token esperado.

**[Cómo lo arregló]:** La normalización actúa antes de la persistencia, convirtiendo cualquier variante a minúsculas recortadas. Al coincidir con la búsqueda, el índice único y la comparación encuentran la misma fila siempre. El esquema con `lowercase: true` queda como segunda red, pero la decisión ya se tomó en el servicio.

**[Argumento para el profesor]:** "Profesor, encontramos que el alta guardaba el correo sin normalizar mientras el login buscaba en minúsculas, por lo que cuentas creadas con mayúsculas no podían entrar. El impacto es alto porque bloquea accesos legítimos y permite duplicados lógicos. Aplicamos identidad canónica, normalizando a minúsculas recortadas en la escritura sin tocar la lectura, con lo que ambos caminos coinciden. Lo evidenciamos con alta en mayúsculas seguida de login en minúsculas, mostrando éxito seguido de `401` anómalo frente al `200` con token esperado. Esto garantiza una sola identidad por correo, logins predecibles y unicidad exigible."
