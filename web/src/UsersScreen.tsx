import { useEffect, useState } from "react";
import { authClient } from "./auth-client";

type LoggedInUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  loggedInAt: string;
  sessions: number;
};

export function UsersScreen({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<LoggedInUser[]>([]);

  useEffect(() => {
    const load = () =>
      fetch("/api/users/logged-in")
        .then((res) => (res.ok ? res.json() : []))
        .then(setUsers);
    load();
    // Poll so people logging in from other browsers show up without a refresh.
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="wide">
      <header>
        <h1>Logged-in users ({users.length})</h1>
        <button onClick={() => authClient.signOut()}>Log out</button>
      </header>
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
                {u.name}
                {u.id === currentUserId && " (you)"}
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
