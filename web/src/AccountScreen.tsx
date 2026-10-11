import { useState, type FormEvent } from "react";
import { authClient } from "./auth-client";

type Status = { error?: string; success?: string };

export function AccountScreen({
  user,
  onBack,
}: {
  user: { name: string; email: string };
  onBack: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileStatus, setProfileStatus] = useState<Status>({});
  const [passwordStatus, setPasswordStatus] = useState<Status>({});
  const [busy, setBusy] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProfileStatus({});
    setProfileStatus(await updateProfile(name.trim(), email.trim().toLowerCase()));
    setBusy(false);
  }

  async function updateProfile(name: string, email: string): Promise<Status> {
    if (name !== user.name) {
      const { error } = await authClient.updateUser({ name });
      if (error) return { error: error.message ?? "Couldn't save your name" };
    }
    if (email !== user.email) {
      const { error } = await authClient.changeEmail({ newEmail: email });
      if (error) return { error: error.message ?? "Couldn't change your email" };
      // Better Auth reports success even when the email is taken (so it can't be probed), so check it stuck.
      const { data } = await authClient.getSession();
      if (data?.user.email !== email) return { error: "That email can't be used. It may already be taken." };
    }
    return { success: "Profile saved." };
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword"));
    if (newPassword !== form.get("confirmPassword")) {
      return setPasswordStatus({ error: "New passwords don't match." });
    }

    setBusy(true);
    setPasswordStatus({});
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("currentPassword")),
      newPassword,
      // Log out every other device, in case the old password leaked.
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) return setPasswordStatus({ error: error.message ?? "Couldn't change your password" });
    formElement.reset();
    setPasswordStatus({ success: "Password changed. Other devices have been logged out." });
  }

  return (
    <main>
      <header>
        <h1>Account settings</h1>
        <button onClick={onBack}>Back</button>
      </header>

      <h2>Profile</h2>
      <form onSubmit={saveProfile}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <StatusMessage status={profileStatus} />
        <button disabled={busy}>Save profile</button>
      </form>

      <h2>Change password</h2>
      <form onSubmit={changePassword}>
        <label>
          Current password
          <input name="currentPassword" type="password" autoComplete="current-password" required />
        </label>
        <label>
          New password
          <input name="newPassword" type="password" minLength={8} autoComplete="new-password" required />
        </label>
        <label>
          Confirm new password
          <input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
        </label>
        <StatusMessage status={passwordStatus} />
        <button disabled={busy}>Change password</button>
      </form>
    </main>
  );
}

function StatusMessage({ status }: { status: Status }) {
  if (status.error) return <p className="error">{status.error}</p>;
  if (status.success) return <p className="success">{status.success}</p>;
  return null;
}
