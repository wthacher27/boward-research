import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "./auth-client";

type LoggedInUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  loggedInAt: string;
  sessions: number;
};

export function UsersScreen({
  currentUserId,
  onOpenAccount,
  onOpenFriends,
}: {
  currentUserId: string;
  onOpenAccount: () => void;
  onOpenFriends: () => void;
}) {
  const [users, setUsers] = useState<LoggedInUser[]>([]);
  // The name being typed while you edit your own row; null when not editing.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/users/logged-in")
      .then((res) => (res.ok ? res.json() : []))
      .then(setUsers);

  useEffect(() => {
    load();
    // Poll so people logging in from other browsers show up without a refresh.
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  function startEditing(name: string) {
    setDraftName(name);
    setError("");
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Better Auth only lets you update your own user, so no extra API route is needed.
    const { error } = await authClient.updateUser({ name: draftName!.trim() });
    if (error) return setError(error.message ?? "Couldn't save your name");
    setDraftName(null);
    load();
  }

  return (
    <main className="wide">
      <header>
        <h1>Logged-in users ({users.length})</h1>
        <div className="actions">
          <button onClick={onOpenFriends}>Friends</button>
          <button onClick={onOpenAccount}>Account settings</button>
          <button onClick={() => authClient.signOut()}>Log out</button>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Last logged in</th>
            <th>Active sessions</th>
            <th>Member since</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.id === currentUserId && draftName !== null ? (
                  <form onSubmit={saveName}>
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      aria-label="Name"
                      autoFocus
                      required
                    />
                    <button>Save</button>
                    <button type="button" className="link" onClick={() => setDraftName(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    {u.name}
                    {u.id === currentUserId && (
                      <>
                        {" (you) "}
                        <button className="link" onClick={() => startEditing(u.name)}>
                          Edit
                        </button>
                      </>
                    )}
                  </>
                )}
              </td>
              <td>{u.email}</td>
              <td>{new Date(u.loggedInAt).toLocaleString()}</td>
              <td>{u.sessions}</td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
