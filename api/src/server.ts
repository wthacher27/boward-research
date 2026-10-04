import Fastify from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { count, desc, eq, gt, max } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { session, user } from "./schema";

const app = Fastify({ logger: true });

// Hand every /api/auth/* request (sign-up, sign-in, sign-out, get-session) to Better Auth.
app.register(async (authRoutes) => {
  // Pass the raw body through untouched; Better Auth parses it itself.
  authRoutes.removeAllContentTypeParsers();
  authRoutes.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  authRoutes.all("/api/auth/*", async (request, reply) => {
    const body = request.body as Buffer | undefined;
    const response = await auth.handler(
      new Request(new URL(request.url, `http://${request.headers.host}`), {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        body: body?.length ? new Uint8Array(body) : undefined,
      }),
    );
    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(await response.text());
  });
});

app.get("/api/users/logged-in", async (request, reply) => {
  const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!current) return reply.code(401).send({ error: "Not logged in" });

  // A user counts as logged in while they have at least one unexpired session.
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      loggedInAt: max(session.createdAt),
      sessions: count(session.id),
    })
    .from(user)
    .innerJoin(session, eq(session.userId, user.id))
    .where(gt(session.expiresAt, new Date()))
    .groupBy(user.id)
    .orderBy(desc(max(session.createdAt)));
});

await app.listen({ host: "0.0.0.0", port: 3000 });
