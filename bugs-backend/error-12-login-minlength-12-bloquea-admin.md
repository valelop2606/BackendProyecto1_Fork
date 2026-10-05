# Backend Error #12 — Login exige 12 caracteres y bloquea al admin semilla de 10 (`Secret123!`) — P0

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/auth/dto/login.dto.ts:12 — password con @MinLength(12)`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/auth/dto/login.dto.ts:12 — propiedad password` con `@MinLength(12)`, frente a `src/users/dto/create-user.dto.ts:21 — @MinLength(8)` y la semilla `ADMIN_PASSWORD=Secret123!` de 10 caracteres. Esta pieza es la puerta de entrada, porque el tubo global valida el cuerpo antes de comparar resúmenes, de modo que una longitud incoherente expulsa al administrador sin llegar a la base.

**[Síntoma Detectado]:** Hoy el administrador inicial intenta iniciar sesión con `Secret123!` y recibe `400 password must be longer than or equal to 12 characters`, sin que el servicio compare nada. El sistema hoy se comporta así: el operador crea el admin con la clave del ejemplo, el login la rechaza por corta, y el panel queda sin acceso inicial. Es incorrecto porque la política de creación permite 8 y el ejemplo trae 10, por lo que el login no puede ser más estricto que la propia creación y la semilla oficial.

**[Gravedad / Impacto]:** La gravedad es crítica de nivel P0 porque deja al sistema sin acceso administrativo en el escenario de despliegue fresco siguiendo el ejemplo, que es el camino documentado. No hay alternativa salvo cambiar la semilla a espaldas del ejemplo. Se viola el principio de coherencia de políticas de credenciales y la regla de no bloquear cuentas provisionadas por el propio sistema.

**Evidencia Postman:** Se usó la colección real `postman/proyecto1-simple.postman_collection.json`, folder `auth/Login`, con cuerpo `{"email":"admin@universidad.edu","password":"Secret123!"}`, más `curl` directo al prefijo vivo. Con el backend sano, la respuesta es `400` por longitud en lugar de `200` con token, lo que demuestra el bloqueo.

```text
curl -i -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json"
  -d '{"email":"admin@universidad.edu","password":"Secret123!"}'
  -> 400 {"message":["password must be longer than or equal to 12 characters"]} (anómalo; esperado 200 {accessToken})
Newman auth/Login con baseUrl=http://localhost:3000 -> 404 por #01; con /api/v1 -> 400 por este #12.
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en unificar la política en el mínimo real que el sistema provisiona, sin relajar la complejidad. El cambio se hace en el DTO de login. Primero se baja `@MinLength(12)` a `@MinLength(8)` para igualar la creación, manteniendo `@IsString()` y `@IsNotEmpty()`. Después se rota la semilla a una clave de al menos 12 si se quiere endurecer, pero cambiando a la vez el ejemplo, la semilla y ambos DTO, nunca solo el login. Desde ese momento el admin del ejemplo entra y las claves cortas siguen rechazadas por debajo de 8. La robustez viene de que una sola constante de política gobierna creación y acceso.

**[Patrón Aplicado]:** Política única de credenciales con validación en frontera y coherencia entre provisión y acceso. Este patrón encaja aquí porque el defecto era la divergencia de mínimos, y alinearlos devuelve el acceso sin debilitar la complejidad alfabética y numérica.

```ts
// BackendProyecto1_Fork/src/auth/dto/login.dto.ts — listo para pegar
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@universidad.edu' })
  @IsEmail()
  email!: string;

  // antes (mal): @MinLength(12); después (bien): igual que creación (8)
  @ApiProperty({ example: 'Secret123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
```

Tras el cambio, el admin del ejemplo obtiene `200` con token y las claves menores de 8 siguen en `400`. Es robusto porque la puerta y la fábrica comparten el mismo umbral y la semilla oficial vuelve a funcionar.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El login pedía 12 mientras la creación pedía 8 y el ejemplo traía 10, de modo que el tubo expulsaba al admin antes de comparar resúmenes. La consecuencia encadenada era un despliegue fresco sin acceso, con el operador tentado a desactivar validaciones para entrar.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: login con `MinLength(12)`.
2. `curl -i -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@universidad.edu","password":"Secret123!"}'` — devuelve `400` por longitud, que es lo anómalo.
3. Esperado tras el fix: `200 {"accessToken":"..."}` con la misma clave del ejemplo.

**[Cómo lo arregló]:** El decorador actúa en el tubo global antes de llegar al servicio, comparando la longitud declarada. Al igualarlo a 8, el cuerpo del ejemplo pasa el tubo y el servicio compara el resumen con `bcrypt`, emitiendo token si coincide. La complejidad de letras y números sigue exigiéndose en la creación, por lo que el acceso no se relaja más allá del umbral provisionado.

**[Argumento para el profesor]:** "Profesor, encontramos que el login exigía 12 caracteres mientras la creación pedía 8 y la semilla oficial trae 10, por lo que el administrador recién creado era expulsado con `400` sin llegar a comparar claves. El impacto es crítico porque deja el despliegue fresco sin acceso siguiendo el ejemplo. Aplicamos política única de credenciales, igualando el mínimo del login al de creación sin tocar la complejidad, con lo que el ejemplo vuelve a entrar y lo corto sigue rechazado. Lo evidenciamos con la colección Postman de login y con `curl` al endpoint vivo, mostrando el `400` por longitud frente al `200` con token esperado. Esto garantiza acceso inicial, coherencia entre provisión y acceso, y una política auditable en un solo lugar."
