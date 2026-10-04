import { createAuthClient } from "better-auth/react";

// Talks to /api/auth on the current origin (proxied to the api by Vite).
export const authClient = createAuthClient();
