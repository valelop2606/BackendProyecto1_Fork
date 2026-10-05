# Gestión Académica — Backend

API (NestJS + MongoDB) de gestión académica universitaria. El frontend vive en `proyectoFrontend1`.

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para MongoDB)

## Cómo correrlo

```
cp .env.example .env   # variables de entorno
# Genera el secreto de firma (minimo 16 caracteres) y pegalo en JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm install
npm run db:up          # levanta MongoDB con Docker
npm run db:import      # carga los datos de prueba (database/*.json)
npm run start          # API en http://localhost:3000/api
```

Luego levanta el frontend (`proyectoFrontend1`), que corre en http://localhost:3001.

## Direcciones

| Qué | URL |
|---|---|
| API | http://localhost:3000/api |
| Documentación Swagger | http://localhost:3000/api/docs |
| Frontend | http://localhost:3001 |

## Usuarios de prueba

Todos con la clave `Secret123!`:

| Rol | Nombre | Email |
|---|---|---|
| Administrador | Administrador | `admin@universidad.edu` |
| Docente | Laura López | `laura.lopez89@universidad.edu` |
| Estudiante | Juliana Herrera | `juliana.herrera147@universidad.edu` |

## Documentación y pruebas

- Swagger: http://localhost:3000/api/docs
- `postman/proyecto1-simple.postman_collection.json`: colección de Postman.

## Actividad

Cada grupo deberá revisar de manera integral el proyecto, incluyendo:

Frontend: revisar interfaces, formularios, validaciones, navegación, manejo de errores, consumo de APIs y funcionamiento general.

Backend: revisar lógica de negocio, validaciones, manejo de errores, servicios, controladores y funcionamiento general.

Base de datos: revisar modelos, relaciones, restricciones, consultas, integridad y consistencia de los datos.

Endpoints: probar los endpoints utilizando Postman, verificando métodos HTTP, parámetros, datos enviados, respuestas, códigos de estado y posibles errores.

Swagger: revisar la documentación de la API y comprobar que los endpoints estén correctamente documentados y que coincidan con el comportamiento real del backend.

## Bugs

El proyecto contiene un total de 90 bugs distribuidos entre:

- Frontend
- Backend
- Base de datos

El objetivo del grupo será encontrar, analizar y corregir la mayor cantidad posible de estos errores.

Importante: No es suficiente identificar visualmente un error. Cada corrección debe ser comprobada para verificar que no afecte otras funcionalidades del sistema, La lista de bugs la tendra el docente de la materia y la revisaran uno por uno el Martes y Miercoles

## Entrega

La versión final del proyecto deberá estar subida al repositorio Git en la rama:

- main

## Hora límite

- 14:14

Después de esta hora, los cambios realizados o subidos al repositorio no serán considerados para la evaluación.
Antes de finalizar, verifiquen que:
Todos los cambios estén correctamente guardados mediante commits.
Los cambios estén subidos al repositorio remoto.
La rama main contenga la versión final del examen.
El proyecto pueda ejecutarse correctamente desde la versión disponible en el repositorio.

## Entrega por WhatsApp

Una vez finalizado el examen, un integrante del grupo deberá enviar por WhatsApp:
Link del repositorio.

Nombres completos de todos los integrantes del grupo.

Formato de entrega

Grupo: [Número o nombre del grupo]
Integrantes:

Nombre completo 1
Nombre completo 2
Nombre completo 3

Repositorio: [Link del repositorio]