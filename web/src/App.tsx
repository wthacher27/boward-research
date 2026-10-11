import { useState } from "react";
import { AccountScreen } from "./AccountScreen";
import { authClient } from "./auth-client";
import { FriendsScreen } from "./FriendsScreen";
import { LoginScreen } from "./LoginScreen";
import { UsersScreen } from "./UsersScreen";

export function App() {
  const { data, isPending } = authClient.useSession();
  const [screen, setScreen] = useState<"users" | "account" | "friends">("users");
  if (isPending) return null;
  if (!data) return <LoginScreen />;
  const back = () => setScreen("users");
  if (screen === "account") return <AccountScreen user={data.user} onBack={back} />;
  if (screen === "friends") return <FriendsScreen currentUserId={data.user.id} onBack={back} />;
  return (
    <UsersScreen
      currentUserId={data.user.id}
      onOpenAccount={() => setScreen("account")}
      onOpenFriends={() => setScreen("friends")}
    />
  );
}
