import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { clearToken } from "../lib/session";
import AddTodoForm from "./AddTodoForm";
import TodoItem from "./TodoItem";
import NotificationsBanner from "./NotificationsBanner";

export interface Member {
  _id: Id<"members">;
  name: string;
  emoji: string;
}

interface Me {
  member: { _id: Id<"members">; name: string; emoji: string };
  family: { name: string } | null;
  members: Member[];
}

export default function TodoApp({ token, me }: { token: string; me: Me }) {
  const todos = useQuery(api.todos.list, { token });
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [menuOpen, setMenuOpen] = useState(false);

  const openCount = todos?.filter((t) => !t.done).length ?? 0;
  const shown = (todos ?? []).filter((t) => (filter === "open" ? !t.done : true));

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>{me.family?.name ?? "Family"}</h1>
          <p className="muted small">
            {openCount} {openCount === 1 ? "thing" : "things"} to do
          </p>
        </div>
        <button
          className="avatar-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Account menu"
        >
          {me.member.emoji}
        </button>
        {menuOpen && (
          <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
            <p className="menu-name">
              {me.member.emoji} {me.member.name}
            </p>
            <button
              onClick={() => {
                clearToken();
                window.location.reload();
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <NotificationsBanner token={token} />

      <AddTodoForm token={token} members={me.members} meId={me.member._id} />

      <div className="filters">
        <button
          className={filter === "open" ? "active" : ""}
          onClick={() => setFilter("open")}
        >
          To do
        </button>
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      <ul className="todos">
        {todos === undefined && (
          <li className="empty">
            <div className="spinner" />
          </li>
        )}
        {todos !== undefined && shown.length === 0 && (
          <li className="empty">
            {filter === "open" ? "🎉 All done! Nothing left." : "No tasks yet."}
          </li>
        )}
        {shown.map((todo) => (
          <TodoItem
            key={todo._id}
            token={token}
            todo={todo}
            members={me.members}
            meId={me.member._id}
          />
        ))}
      </ul>

      <footer className="foot muted small">
        Add to Home Screen for the full app + push notifications.
      </footer>
    </div>
  );
}
