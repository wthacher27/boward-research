import { authClient } from "./auth-client";
import { LoginScreen } from "./LoginScreen";
import { UsersScreen } from "./UsersScreen";

export function App() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return null;
  return data ? <UsersScreen currentUserId={data.user.id} /> : <LoginScreen />;
}
