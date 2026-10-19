# TraceBoard backend

API NestJS para investigaciones, tableros y archivos con adaptadores PostgreSQL o memoria efímera.

Aplicación separada del [frontend](https://github.com/Alejandrom199/trace-board-frontend). Requisitos: Node.js >=24.11.0 y npm 11.

## Iniciar

```powershell
npm ci
npm run db:setup
npm run db:migrate
npm run dev
```

API en http://127.0.0.1:4000. PostgreSQL 18 instalado; PG_BIN permite indicar los binarios. db:setup crea/reutiliza la instancia dedicada .local/postgres en 55432 con contraseñas aleatorias. DATABASE_URL y TEST_DATABASE_URL pueden suministrarse al proceso para una instancia propia. apps/api/.env.example es documentación; no se carga automáticamente. No ejecutar setup de dos copias simultáneas en el mismo puerto.

Producción local: npm run build y npm start. Netlify usa netlify.toml; Railway usa apps/api/railway.json. El despliegue Railway selecciona TRACEBOARD_STORAGE=memory y su estado remoto es efímero. Mantener el host/puerto del frontend conserva sus investigaciones locales.

## Calidad

```powershell
npm run check:secrets
npm run typecheck
npm run lint
npm test
npm run check:architecture
npm run build
```

Integración: npm run test:integration utiliza exclusivamente traceboard_test. El CI crea PostgreSQL efímero con contraseña aleatoria. No se borran registros de bases existentes.

## Contratos y seguridad

packages/contracts contiene únicamente DTO/esquemas HTTP. contracts-manifest.json identifica el snapshot común con el otro repositorio; sincronizar ambos al cambiar contratos. No publicar credenciales, bases, documentos reales ni capturas. Solo ejemplos ficticios en código/pruebas. En producción, Netlify y Railway comparten TRACEBOARD_API_TOKEN mediante variables protegidas; el valor no se versiona ni llega al navegador.

Ver [arquitectura](docs/ARCHITECTURE.md), [publicación](docs/GITHUB.md), [reglas](AGENTS.md) y [detalle de la aplicación](apps/api/README.md). El workspace de desarrollo conserva ambas apps; este repositorio contiene solo apps/api.
