# Backend Error #18 — `JWT_SECRET` vacío en `.env` deja el arranque a merced del operador — P0

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `.env:5 — JWT_SECRET=` y `src/config/env.validation.ts:24 — @MinLength(16)`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/.env:5 — variable JWT_SECRET vacía` frente a `BackendProyecto1_Fork/src/config/env.validation.ts:24 — regla @MinLength(16)`. Esta pieza es la raíz de confianza de los tokens, porque el secreto firma cada acceso, de modo que un ejemplo vacío traslada la seguridad al recuerdo del operador.

**[Síntoma Detectado]:** Hoy quien sigue el `README.md` con `cp .env.example .env` y `npm run start` ve caer el arranque con `Variables de entorno invalidas -> JWT_SECRET`, salvo que adivine que debe inventar un secreto largo. El sistema hoy se comporta así: la validación exige 16, el ejemplo trae vacío a propósito, y el arranque no ofrece generación ni mensaje de cómo producirlo. Es incorrecto porque el ejemplo debe arrancar con lo mínimo documentado o guiar la generación, y porque cada operador improvisando secretos produce valores débiles o compartidos.

**[Gravedad / Impacto]:** La gravedad es crítica de nivel P0 porque bloquea el despliegue en el escenario guiado del examen, donde cada grupo pierde tiempo en configuración en lugar de probar. Si el operador relaja la validación para avanzar, firma con secreto débil. Se viola el principio de arranque guiado sin secretos en claro y la guía de gestión de secretos del estándar OWASP sobre aleatoriedad y longitud mínima.

**Evidencia Postman:** Evidencia estática por arranque sin secreto más `curl` que nunca llega, ya que sin secreto no hay backend que probar. El log muestra el error de validación y la ausencia de `Nest application successfully started`, lo que demuestra la dependencia no guiada.

```text
JWT_SECRET="" npm run start -> Error: Variables de entorno invalidas -> JWT_SECRET (anómalo guiado)
cat .env | grep JWT_SECRET -> JWT_SECRET= (vacío)
JWT_SECRET="test-secret-supersecreto-1234567890" node dist/main.js -> arranca (prueba con secreto largo)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en guiar la provisión sin bajar la exigencia, separando ejemplo y arranque. El cambio se hace en documentación y arranque. Primero se mantiene `@MinLength(16)` pero se agrega al `README.md` un comando de generación con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y se documenta que el ejemplo viene vacío a propósito. Después se evalúa un asistente de arranque que, solo en desarrollo y sin variable, genera un secreto efímero con advertencia, nunca en producción. Desde ese momento el operador genera en un paso y la validación sigue exigiendo 16. La robustez viene de que lo seguro se vuelve lo fácil.

**[Patrón Aplicado]:** Secreto provisionado con validación en frontera y generación guiada. Este patrón encaja aquí porque el defecto era la exigencia sin guía, y agregar el comando cierra la brecha sin debilitar la firma.

```ts
// BackendProyecto1_Fork/src/config/env.validation.ts — se mantiene (16), solo guía
// README.md — agregar (listo para pegar):
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   # pega el valor en JWT_SECRET de .env (mínimo 16 caracteres)
```

```bash
# Generar secreto largo (listo para pegar)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Tras el cambio, el arranque guiado produce un secreto fuerte en un paso y la validación sigue en 16. Es robusto porque elimina la improvisación sin abrir la puerta a secretos débiles.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El ejemplo traía el secreto vacío y la validación lo rechazaba, sin ofrecer el comando para producirlo. La consecuencia encadenada era arranques caídos en el camino documentado y operadores inventando secretos cortos o desactivando la validación.

**[Cómo se replicaba]:**

1. `cp .env.example .env` en `BackendProyecto1_Fork/` — deja `JWT_SECRET` vacío, resultado observado: ejemplo sin secreto.
2. `npm run start` — devuelve `Variables de entorno invalidas -> JWT_SECRET`, que es lo anómalo guiado.
3. Esperado tras el fix: `README.md` con comando de generación y arranque en `Nest application successfully started` tras pegar el valor.

**[Cómo lo arregló]:** La guía actúa antes del arranque, produciendo aleatoriedad criptográfica de 32 bytes en hexadecimal. Al pegar ese valor, la validación de 16 lo acepta y la firma usa entropía real. La exigencia no baja, pero el camino para cumplirla se vuelve de un paso.

**[Argumento para el profesor]:** "Profesor, encontramos que el secreto de firma venía vacío en el ejemplo mientras la validación exige 16, por lo que el arranque guiado caía sin decir cómo generarlo. El impacto es crítico porque bloquea el despliegue y empuja a secretos débiles. Aplicamos provisión guiada, manteniendo los 16 y agregando el comando de generación al `README.md`, con lo que lo seguro se vuelve lo fácil. Lo evidenciamos con arranque sin secreto en error frente al arranque con secreto largo en éxito. Esto garantiza despliegues que arrancan, firmas con entropía real y una exigencia que se mantiene."
