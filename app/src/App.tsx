import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { getToken } from "./lib/session";
import JoinScreen from "./components/JoinScreen";
import TodoApp from "./components/TodoApp";

export default function App() {
  const token = getToken();
  const me = useQuery(api.families.me, token ? { token } : "skip");
  const heartbeat = useMutation(api.families.heartbeat);

  useEffect(() => {
    if (token && me) heartbeat({ token }).catch(() => {});
  }, [token, me, heartbeat]);

  // No token yet → onboarding.
  if (!token) return <JoinScreen />;

  // Token present but still loading.
  if (me === undefined) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    );
  }

  // Token is stale/invalid (e.g. data reset) → back to join.
  if (me === null) return <JoinScreen />;

  return <TodoApp token={token} me={me} />;
}
