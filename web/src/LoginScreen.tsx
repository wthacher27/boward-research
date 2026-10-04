import { useState, type FormEvent } from "react";
import { authClient } from "./auth-client";

export function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    setBusy(true);
    setError("");
    // On success the session updates and App switches to the users screen.
    const { error } =
      mode === "login"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(form.get("name")) });
    setBusy(false);
    if (error) setError(error.message ?? "Something went wrong");
  }

  function toggleMode() {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
  }

  return (
    <main>
      <h1>{mode === "login" ? "Log in" : "Create an account"}</h1>
      <form onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label>
            Name
            <input name="name" autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{mode === "login" ? "Log in" : "Sign up"}</button>
      </form>
      <button className="link" onClick={toggleMode}>
        {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
      </button>
    </main>
  );
}
