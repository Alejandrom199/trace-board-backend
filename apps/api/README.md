# TraceBoard API

La API puede usar PostgreSQL (`TRACEBOARD_STORAGE=postgres`) o memoria efímera (`TRACEBOARD_STORAGE=memory`). Railway usa memoria: no necesita base de datos y puede perder todos los datos remotos al suspenderse o reiniciarse. El tablero durable permanece en IndexedDB del frontend.

En producción son obligatorios `TRACEBOARD_API_TOKEN` (mínimo 32 caracteres), `HOST=0.0.0.0` y el puerto asignado por la plataforma. `/api/health` permanece público; `/api/investigations` exige `Authorization: Bearer` cuando hay token configurado.

NestJS en aplicación independiente. Dominio y casos de uso en `src/features/investigations`, adaptador PostgreSQL y composición en `src/app.ts`. Comparte únicamente DTO/esquemas HTTP con `@traceboard/contracts`.

Desde la raíz del proyecto:

```powershell
npm ci
npm run db:setup
npm run db:migrate
npm run dev
```

El setup usa PostgreSQL 18 instalado en `C:/Program Files/PostgreSQL/18/bin`. Puedes definir `PG_BIN` para otra ubicación. Crea un cluster dedicado en `.local/postgres`, ligado a 127.0.0.1:55432, con administrador y rol de aplicación separados y contraseñas aleatorias ignoradas por Git. Nunca reutiliza las bases existentes del equipo. Se conserva la información al detener y volver a iniciar el cluster. `npm run db:stop` detiene solo ese cluster sin borrar sus datos.

La API escucha en http://127.0.0.1:4000. Lee la conexión de `.local/database.json` o la variable `DATABASE_URL`, cuando se configure explícitamente en el proceso. `.env.example` es una referencia; no se cargan archivos `.env` automáticamente. No copiar credenciales a variables públicas del frontend.

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | /api/investigations | 201, investigación creada. JSON `{ "name": "Compras", "description": "Análisis del abastecimiento" }` |
| GET | /api/investigations | Lista de hasta 500 investigaciones, más recientes primero |
| GET | /api/investigations/:id | Metadatos por UUID público |
| GET | /api/investigations/:id/board | Investigación, revisión y contenido; null si nunca se guardó |
| PUT | /api/investigations/:id/board | JSON `{ "expectedRevision": 0, "content": { "entities": [], "edges": [], "elements": [], "assets": [] } }`; revisión incrementada y contenido confirmado |
| POST | /api/investigations/:id/files | Bytes application/octet-stream, X-File-Name codificado con encodeURIComponent y X-File-Mime; 201 con UUID, nombre, MIME, tamaño y SHA-256. Hasta 10 MiB. |
| GET | /api/investigations/:id/files/:fileId | Bytes originales; ?download=1 genera Content-Disposition attachment. 404 para archivo ajeno/inexistente. |

Errores: 400 entrada inválida, 404 inexistente, 415 contenido distinto de JSON al crear y 503 base no disponible. Las consultas son parametrizadas; no se exponen contraseñas, SQL ni stack traces en esas respuestas.

Este incremento guarda metadatos y contenido del tablero (tarjetas, relaciones, posiciones, viewport y metadatos de archivos). Un snapshot JSONB validado se actualiza atómicamente con su revisión en la misma fila. Una revisión obsoleta produce 409; una entrada de más de 8 MiB produce 413. Los binarios y las URLs no se aceptan. La validación también comprueba referencias, posiciones, IDs/códigos únicos y propiedades de requisitos. No tiene autenticación y está ligado a loopback para uso local; no es un servicio público listo para desplegar.

Los binarios se aceptan solo en /files, separados del snapshot, y se guardan como bytea en investigation_files. PDF, PNG, JPEG, GIF y WebP: nombre sin rutas/control, MIME/extensión/firma básica coincidentes, hash SHA-256 y restricciones SQL de tamaño. Subidas inmutables, deduplicadas por investigación/nombre/hash. La referencia asset.file={id,sha256} de un PUT debe pertenecer a la investigación y coincidir con nombre/MIME/tamaño/hash. No hay borrado, S3 ni limpieza automática; archivos no referenciados se retienen para no romper copias/historial. No se afirma antimalware ni validez profunda de PDF. Ver ADR-005.

## Verificación

`npm run build`, `npm run typecheck`, `npm run lint`, `npm test` y `npm run test:integration` desde la raíz. Las pruebas de integración usan exclusivamente `traceboard_test`, con PostgreSQL real, y no eliminan registros existentes. Verifican que los datos se recuperan al recrear la API y su pool.

Las migraciones son SQL versionado y se aplican de forma transaccional bajo advisory lock; se registra cada nombre aplicado. No modificar una migración ya aplicada: añadir una nueva. No ejecutar migraciones contra bases ajenas al proyecto.
