import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { setToken } from "../lib/session";

const EMOJIS = ["🐢", "🦊", "🐼", "🐙", "🦉", "🐝", "🦄", "🐳", "🦔", "🐧"];

export default function JoinScreen() {
  const [mode, setMode] = useState<"join" | "create">("join");
  const [familyName, setFamilyName] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createFamily = useMutation(api.families.createFamily);
  const joinFamily = useMutation(api.families.joinFamily);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "create"
          ? await createFamily({
              familyName,
              code,
              memberName: name,
              emoji,
            })
          : await joinFamily({ code, memberName: name, emoji });
      setToken(result.token);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="join">
      <div className="join-card">
        <h1>
          <span className="logo">🏡</span> Family Todo
        </h1>
        <p className="muted">
          A shared list for the family — with friendly nudges.
        </p>

        <div className="segmented">
          <button
            type="button"
            className={mode === "join" ? "active" : ""}
            onClick={() => setMode("join")}
          >
            Join family
          </button>
          <button
            type="button"
            className={mode === "create" ? "active" : ""}
            onClick={() => setMode("create")}
          >
            Create family
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === "create" && (
            <label>
              Family name
              <input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="The Smiths"
                required
              />
            </label>
          )}

          <label>
            Family code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. smith-house"
              autoCapitalize="none"
              required
            />
          </label>
          <p className="hint">
            {mode === "create"
              ? "Pick a secret code and share it with your family."
              : "Ask whoever set up the family for the code."}
          </p>

          <label>
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Olivier"
              required
            />
          </label>

          <label>
            Pick an avatar
            <div className="emoji-row">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  className={`emoji ${emoji === e ? "active" : ""}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="primary" disabled={busy}>
            {busy
              ? "…"
              : mode === "create"
                ? "Create & enter"
                : "Join & enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
