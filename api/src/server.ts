import Fastify, { type FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { and, asc, count, desc, eq, gt, max, ne, notInArray, or, sql } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { friend, message, session, user } from "./schema";

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

async function getUserId(request: FastifyRequest) {
  const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  return current?.user.id;
}

app.get("/api/users/logged-in", async (request, reply) => {
  if (!(await getUserId(request))) return reply.code(401).send({ error: "Not logged in" });

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

// The friend rows between a and b, in either direction. Both rows present means they're friends.
const friendRows = (a: string, b: string) =>
  or(and(eq(friend.userId, a), eq(friend.friendId, b)), and(eq(friend.userId, b), eq(friend.friendId, a)));

const person = { id: user.id, name: user.name, email: user.email };

app.get("/api/friends", async (request, reply) => {
  const me = await getUserId(request);
  if (!me) return reply.code(401).send({ error: "Not logged in" });

  const added = await db.select(person).from(friend).innerJoin(user, eq(user.id, friend.friendId))
    .where(eq(friend.userId, me)).orderBy(user.name);
  const addedMe = await db.select(person).from(friend).innerJoin(user, eq(user.id, friend.userId))
    .where(eq(friend.friendId, me)).orderBy(user.name);
  const addedIds = new Set(added.map((u) => u.id));
  const addedMeIds = new Set(addedMe.map((u) => u.id));
  return {
    friends: added.filter((u) => addedMeIds.has(u.id)),
    requests: addedMe.filter((u) => !addedIds.has(u.id)),
    pending: added.filter((u) => !addedMeIds.has(u.id)),
  };
});

app.post<{ Body: { email?: string } }>("/api/friends", async (request, reply) => {
  const me = await getUserId(request);
  if (!me) return reply.code(401).send({ error: "Not logged in" });

  const email = String(request.body?.email ?? "").trim().toLowerCase();
  const [other] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!other) return reply.code(404).send({ error: "No one has signed up with that email." });
  if (other.id === me) return reply.code(400).send({ error: "You can't add yourself." });
  await db.insert(friend).values({ userId: me, friendId: other.id }).onConflictDoNothing();
  return reply.code(204).send();
});

// One random person you have no friend row with in either direction (so not a friend or a request).
app.get<{ Querystring: { skip?: string } }>("/api/friends/suggestion", async (request, reply) => {
  const me = await getUserId(request);
  if (!me) return reply.code(401).send({ error: "Not logged in" });

  const [suggestion] = await db
    .select(person)
    .from(user)
    .where(and(
      ne(user.id, me),
      notInArray(user.id, db.select({ id: friend.friendId }).from(friend).where(eq(friend.userId, me))),
      notInArray(user.id, db.select({ id: friend.userId }).from(friend).where(eq(friend.friendId, me))),
    ))
    // Sort the person you just skipped last, so Skip shows someone new whenever there's anyone else.
    .orderBy(sql`${user.id} = ${request.query.skip ?? ""}`, sql`random()`)
    .limit(1);
  return { suggestion: suggestion ?? null };
});

// Unfriend, cancel a request you sent, or decline one you received: all clear both directions.
app.delete<{ Params: { id: string } }>("/api/friends/:id", async (request, reply) => {
  const me = await getUserId(request);
  if (!me) return reply.code(401).send({ error: "Not logged in" });

  await db.delete(friend).where(friendRows(me, request.params.id));
  return reply.code(204).send();
});

app.get<{ Params: { friendId: string } }>("/api/messages/:friendId", async (request, reply) => {
  const me = await getUserId(request);
  if (!me) return reply.code(401).send({ error: "Not logged in" });

  const them = request.params.friendId;
  return db
    .select({ id: message.id, senderId: message.senderId, text: message.text, createdAt: message.createdAt })
    .from(message)
    .where(or(
      and(eq(message.senderId, me), eq(message.recipientId, them)),
      and(eq(message.senderId, them), eq(message.recipientId, me)),
    ))
    .orderBy(asc(message.createdAt));
});

app.post<{ Params: { friendId: string }; Body: { text?: string } }>("/api/messages/:friendId", async (request, reply) => {
  const me = await getUserId(request);
  if (!me) return reply.code(401).send({ error: "Not logged in" });

  const text = String(request.body?.text ?? "").trim();
  if (!text) return reply.code(400).send({ error: "Message can't be empty." });
  const rows = await db.select().from(friend).where(friendRows(me, request.params.friendId));
  if (rows.length < 2) return reply.code(403).send({ error: "You can only message friends." });

  await db.insert(message).values({ senderId: me, recipientId: request.params.friendId, text });
  return reply.code(204).send();
});

await app.listen({ host: "0.0.0.0", port: 3000 });
