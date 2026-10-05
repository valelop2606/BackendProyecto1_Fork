# Backend Error #11 — JWT `expiresIn` como cadena `"3600"` sin unidad deja expiración ambigua — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/auth/auth.module.ts:22 — JwtModule.registerAsync`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/auth/auth.module.ts:22 — signOptions: { expiresIn: String(...) as StringValue }` dentro de la factoría del módulo JWT. Esta pieza decide cuánto vive cada token de acceso, por lo que una unidad ambigua convierte la sesión en impredecible.

**[Síntoma Detectado]:** Hoy el sistema convierte los segundos configurados a cadena con `String(3600)`, es decir `"3600"` sin sufijo, y lo entrega a la librería `ms` a través de `jsonwebtoken`. La librería espera número de segundos o cadena con unidad como `"3600s"`, por lo que `"3600"` puede interpretarse como milisegundos o rechazarse según la versión, dejando tokens que viven 3.6 segundos o que nunca expiran de forma controlada. El sistema hoy narra el riesgo así: el administrador configura una hora, el código la serializa sin unidad, y la sesión real dura otro tiempo. Es incorrecto porque la expiración debe ser explícita y probada.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque afecta la ventana de robo de tokens en el escenario de sesión robada, donde minutos de más son explotación y segundos de menos son expulsiones. Además rompe la trazabilidad entre configuración y comportamiento. Se viola el principio de configuración explícita y la guía de la librería `jsonwebtoken` sobre el formato de `expiresIn`, con impacto directo en la gestión de sesiones del estándar OWASP.

**Evidencia Postman:** Evidencia estática por lectura de la factoría más réplica `curl` de login con decodificación del `exp`, ya que Newman no aserta expiración. Con `JWT_EXPIRES_IN_SECONDS=3600`, el `exp - iat` observado difiere de `3600` segundos, lo que demuestra la ambigüedad de la unidad.

```text
grep -n "expiresIn" src/auth/auth.module.ts -> String(...) as StringValue sin sufijo
curl -s -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json"
  -d '{"email":"...","password":"..."}' | decodificar JWT -> exp-iat != 3600 (anómalo)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en entregar la expiración en el tipo que la librería espera, sin pasar por cadena sin unidad. El cambio se hace en la factoría del módulo. Primero se lee el número con `getOrThrow<number>` y se entrega como número de segundos o como cadena con sufijo `"s"`, por ejemplo `` `${seconds}s` ``. Después se mantiene la validación de entorno que ya exige mínimo de `60`. Desde ese momento el `exp` del token es `iat + seconds` exactos y la configuración vuelve a mandar. La robustez viene de que el tipo deja de depender de la interpretación de la librería.

**[Patrón Aplicado]:** Configuración tipada con factoría explícita y validación en frontera. Este patrón encaja aquí porque el defecto era la serialización implícita, y al tipar la unidad se elimina la ambigüedad en el único punto donde nace el token.

```ts
// BackendProyecto1_Fork/src/auth/auth.module.ts — listo para pegar
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const seconds = config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS');
    return {
      secret: config.getOrThrow<string>('JWT_SECRET'),
      // antes (mal): String(seconds) sin unidad; después (bien): segundos explícitos
      signOptions: { expiresIn: seconds },
    };
  },
}),
```

Tras el cambio, `exp - iat` equals a los segundos configurados y la sesión es predecible. Es robusto porque el número viaja sin conversiones y la validación de mínimo sigue en el arranque.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La factoría convertía el número a cadena sin sufijo, dejando la unidad a criterio de la librería. La consecuencia encadenada era una expiración que no coincidía con lo configurado, con sesiones demasiado cortas o demasiado largas según la versión.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: factoría con `String(...)`.
2. `curl -s -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"...","password":"..."}'` — token con `exp-iat` distinto de `3600`, que es lo anómalo.
3. Esperado tras el fix: `exp - iat = 3600` exactos y documentados.

**[Cómo lo arregló]:** El tipo actúa en la firma del token, que se calcula una vez al emitir. Al entregar segundos numéricos, `jsonwebtoken` suma la duración sin interpretar texto, por lo que la configuración y el token coinciden. La expiración deja de ser una adivinanza de la librería y vuelve a ser una decisión del operador.

**[Argumento para el profesor]:** "Profesor, encontramos que la expiración del JWT se entregaba como cadena sin unidad, por lo que la sesión real no coincidía con los segundos configurados. El impacto es alto porque alarga o acorta la ventana de robo de tokens. Aplicamos configuración tipada en la factoría, entregando segundos numéricos con validación de mínimo, sin tocar el resto del flujo. Lo evidenciamos con lectura de la factoría y con `curl` de login decodificando `exp`, mostrando la diferencia frente a los `3600` esperados. Esto garantiza sesiones predecibles, configuración que manda y gestión de tokens auditable."
