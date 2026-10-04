3# boward-research
a demo app to familiarize with tools

React + TypeScript (Vite) frontend, Fastify + TypeScript API, PostgreSQL/PostGIS, Drizzle ORM, Better Auth.
Everything runs in Docker, so the only thing you need installed is Docker Desktop.

## Run it

```sh
docker compose up --watch
go to
 http://localhost:5173

 close:
 docker compose down -v
 docker compose restart api