import { useEffect, useRef, useState, type FormEvent } from "react";

type Person = { id: string; name: string; email: string };
type FriendLists = { friends: Person[]; requests: Person[]; pending: Person[] };
type Message = { id: string; senderId: string; text: string; createdAt: string };

// POSTs JSON and resolves to the API's error message, or "" on success.
async function post(url: string, data: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.ok) return "";
  const { error } = await res.json().catch(() => ({}));
  return error ?? "Something went wrong";
}

export function FriendsScreen({ currentUserId, onBack }: { currentUserId: string; onBack: () => void }) {
  const [lists, setLists] = useState<FriendLists>({ friends: [], requests: [], pending: [] });
  const [chatId, setChatId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Person | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  // Looked up on every load, so the chat closes by itself if the friendship ends.
  const chatFriend = lists.friends.find((f) => f.id === chatId);

  const load = () =>
    fetch("/api/friends")
      .then((res) => (res.ok ? res.json() : { friends: [], requests: [], pending: [] }))
      .then(setLists);

  const suggest = (skip?: string) =>
    fetch(`/api/friends/suggestion${skip ? `?skip=${skip}` : ""}`)
      .then((res) => (res.ok ? res.json() : { suggestion: null }))
      .then((data) => setSuggestion(data.suggestion));

  useEffect(() => {
    load();
    // Not polled, so the suggestion only changes when you add or skip it.
    suggest();
    // Poll so friend requests and accepts from other people show up without a refresh.
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  async function addFriend(email: string) {
    const error = await post("/api/friends", { email });
    setError(error);
    load();
    return !error;
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await addFriend(email)) setEmail("");
  }

  async function addSuggestion(person: Person) {
    if (await addFriend(person.email)) suggest();
  }

  async function remove(id: string) {
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="wide">
      <header>
        <h1>Friends</h1>
        <button onClick={onBack}>Back</button>
      </header>
      <div className="friends">
        <section>
          <form className="inline" onSubmit={submitEmail}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Friend's email"
              aria-label="Friend's email"
              required
            />
            <button>Add</button>
          </form>
          {error && <p className="error">{error}</p>}

          {suggestion && (
            <>
              <h2>Suggested friend</h2>
              <ul className="people">
                <li>
                  <PersonLabel person={suggestion} />
                  <button onClick={() => addSuggestion(suggestion)}>Add</button>
                  <button className="link" onClick={() => suggest(suggestion.id)}>
                    Skip
                  </button>
                </li>
              </ul>
            </>
          )}

          {lists.requests.length > 0 && (
            <>
              <h2>Added you</h2>
              <ul className="people">
                {lists.requests.map((p) => (
                  <li key={p.id}>
                    <PersonLabel person={p} />
                    <button onClick={() => addFriend(p.email)}>Add back</button>
                    <button className="link" onClick={() => remove(p.id)}>
                      Decline
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2>Your friends</h2>
          {lists.friends.length === 0 && <p className="muted">No friends yet. Add someone by their email.</p>}
          <ul className="people">
            {lists.friends.map((p) => (
              <li key={p.id}>
                <button className={p.id === chatId ? "person selected" : "person"} onClick={() => setChatId(p.id)}>
                  <PersonLabel person={p} />
                </button>
              </li>
            ))}
          </ul>

          {lists.pending.length > 0 && (
            <>
              <h2>Waiting for them to add you back</h2>
              <ul className="people">
                {lists.pending.map((p) => (
                  <li key={p.id}>
                    <PersonLabel person={p} />
                    <button className="link" onClick={() => remove(p.id)}>
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          {chatFriend ? (
            <Chat key={chatFriend.id} friend={chatFriend} currentUserId={currentUserId} onRemove={remove} />
          ) : (
            <p className="muted">Pick a friend to start chatting.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function PersonLabel({ person }: { person: Person }) {
  return (
    <span className="person-label">
      {person.name}
      <small>{person.email}</small>
    </span>
  );
}

function Chat({
  friend,
  currentUserId,
  onRemove,
}: {
  friend: Person;
  currentUserId: string;
  onRemove: (id: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch(`/api/messages/${friend.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setMessages);

  useEffect(() => {
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, []);

  // Keep the newest message in view, but only when one arrives, so polling doesn't fight your scrolling.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = await post(`/api/messages/${friend.id}`, { text: draft });
    setError(error);
    if (error) return;
    setDraft("");
    load();
  }

  return (
    <div className="chat">
      <header>
        <h2>{friend.name}</h2>
        <button className="link" onClick={() => onRemove(friend.id)}>
          Remove friend
        </button>
      </header>
      <div className="messages" ref={listRef}>
        {messages.length === 0 && <p className="muted">No messages yet. Say hi!</p>}
        {messages.map((m) => (
          <p
            key={m.id}
            className={m.senderId === currentUserId ? "bubble mine" : "bubble"}
            title={new Date(m.createdAt).toLocaleString()}
          >
            {m.text}
          </p>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <form className="inline" onSubmit={send}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${friend.name}`}
          aria-label="Message"
          autoFocus
          required
        />
        <button>Send</button>
      </form>
    </div>
  );
}
