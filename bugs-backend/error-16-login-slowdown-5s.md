# Backend Error #16 — Login con retardo fijo de 5 segundos sin límite de intentos (auto-denegación) — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/auth/auth.service.ts:36 — slowDownAttempts()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/auth/auth.service.ts:36 — método privado slowDownAttempts()` invocado en `src/auth/auth.service.ts:18` al inicio de cada `login()`. Esta pieza pretende frenar fuerza bruta, pero al aplicarse a todo intento legítimo sin contador ni bloqueo, convierte la protección en un impuesto global.

**[Síntoma Detectado]:** Hoy cada login, válido o no, espera 5 segundos por un `setTimeout` prometido antes de tocar la base. El sistema hoy se comporta así: el usuario envía credenciales correctas, el servidor duerme, y la respuesta llega en más de 5 segundos aunque la base esté sana. Es incorrecto porque la defensa debe ser progresiva por origen y cuenta, no un retardo fijo universal, y porque mantiene promesas dormidas que consumen concurrencia bajo carga. Además no distingue entre error de usuario y ataque, castigando al legítimo.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque degrada el acceso en el escenario pico de inicio de jornada, donde cientos de logins serializan 5 segundos cada uno y agotan el bucle de eventos. Un atacante puede además amplificar el costo abriendo intentos en paralelo. Se viola el principio de defensa proporcional con limitación de tasa del estándar OWASP y la guía de diseño que pide respuestas rápidas en el camino feliz.

**Evidencia Postman:** Evidencia dinámica por tiempo de respuesta del login al prefijo vivo, ya que Newman no aserta latencia fina. Con credenciales cualesquiera, el tiempo medio supera 5000 milisegundos, lo que demuestra el impuesto fijo.

```text
time curl -s -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json"
  -d '{"email":"x@y.edu","password":"Clave12345"}' -> >5000ms (anómalo; esperado <500ms en fallo rápido)
Newman auth/Login -> latencia dominada por el sleep, no por la base.
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en sustituir el sueño global por limitación de tasa con retroceso por origen. El cambio se hace en el módulo y el servicio. Primero se retira el `await slowDownAttempts()` del camino feliz y se elimina el método. Después se instala `ThrottlerModule` con ventana corta y máximo de intentos, más un guardia en el controlador de login. Desde ese momento los intentos legítimos responden rápido y los abusivos reciben `429` con reintento. La robustez viene de que el costo lo paga quien abusa, no toda la población.

**[Patrón Aplicado]:** Limitación de tasa con retroceso exponencial y guardia dedicado. Este patrón encaja aquí porque el defecto era la penalización indiscriminada, y mover el costo al abusador restaura velocidad legítima con protección real.

```ts
// BackendProyecto1_Fork/src/auth/auth.service.ts — listo para pegar (retiro)
async login({ email, password }: LoginDto): Promise<{ accessToken: string }> {
  // antes (mal): await this.slowDownAttempts();
  const user = await this.usersService.findByEmailWithPassword(email);
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid || !user.active) {
    throw new UnauthorizedException('Credenciales invalidas');
  }
  return this.issueToken(user);
}
// + en auth.controller.ts: @UseGuards(ThrottlerGuard) sobre login con ThrottlerModule en app
```

Tras el cambio, el login válido responde en milisegundos y el abuso recibe `429`. Es robusto porque la protección es medible por IP y cuenta, no un sueño global.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** Cada login dormía 5 segundos antes de validar, de modo que la protección castigaba al legítimo y retenía concurrencia. La consecuencia encadenada era accesos lentos en hora pico y una superficie amplificable por el atacante con intentos paralelos.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: login con `slowDownAttempts`.
2. `time curl -s -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"x@y.edu","password":"Clave12345"}'` — supera 5 segundos, que es lo anómalo.
3. Esperado tras el fix: fallo rápido en milisegundos y `429` solo bajo abuso reiterado.

**[Cómo lo arregló]:** El limitador actúa en la entrada contando intentos por ventana y denegando con `429` al exceder, sin dormir al resto. Al retirar el sueño, el camino feliz vuelve a la velocidad de la base y `bcrypt`, y el ataque se contiene por conteo. El costo se traslada de todos a quien abusa.

**[Argumento para el profesor]:** "Profesor, encontramos que cada login dormía 5 segundos sin contador, castigando al usuario legítimo y reteniendo concurrencia bajo carga. El impacto es alto porque degrada el pico de accesos y es amplificable. Aplicamos limitación de tasa con guardia, retirando el sueño global y denegando con `429` solo al abuso, con lo que lo legítimo vuelve a milisegundos. Lo evidenciamos midiendo la latencia del login vivo, mostrando más de 5 segundos frente a los milisegundos esperados. Esto garantiza accesos rápidos, protección proporcional y un costo que paga el atacante, no la población."
