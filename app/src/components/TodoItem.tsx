import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { Member } from "./TodoApp";
import { addToCalendar } from "../lib/calendar";

interface Todo {
  _id: Id<"todos">;
  title: string;
  notes?: string;
  done: boolean;
  dueAt?: number;
  assigneeId?: Id<"members">;
  suggestedToId?: Id<"members">;
  suggestedById?: Id<"members">;
}

function dueLabel(dueAt: number): { text: string; overdue: boolean } {
  const now = Date.now();
  const overdue = dueAt < now;
  const d = new Date(dueAt);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const text = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    year: sameYear ? undefined : "numeric",
  });
  return { text, overdue };
}

export default function TodoItem({
  token,
  todo,
  members,
  meId,
}: {
  token: string;
  todo: Todo;
  members: Member[];
  meId: Id<"members">;
}) {
  const toggle = useMutation(api.todos.toggle);
  const remove = useMutation(api.todos.remove);
  const suggest = useMutation(api.todos.suggest);
  const [picking, setPicking] = useState(false);

  const assignee = members.find((m) => m._id === todo.assigneeId);
  const due = todo.dueAt ? dueLabel(todo.dueAt) : null;
  const suggestedToMe = todo.suggestedToId === meId && !todo.done;

  return (
    <li className={`todo ${todo.done ? "done" : ""}`}>
      <button
        className={`check ${todo.done ? "checked" : ""}`}
        onClick={() => toggle({ token, id: todo._id })}
        aria-label={todo.done ? "Mark not done" : "Mark done"}
      >
        {todo.done ? "✓" : ""}
      </button>

      <div className="todo-body">
        <span className="todo-title">{todo.title}</span>
        <div className="todo-meta">
          {assignee && (
            <span className="chip">
              {assignee.emoji} {assignee.name}
            </span>
          )}
          {due && (
            <span className={`chip ${due.overdue && !todo.done ? "danger" : ""}`}>
              {due.overdue && !todo.done ? "⏰ " : "📅 "}
              {due.text}
            </span>
          )}
          {suggestedToMe && <span className="chip accent">👉 suggested for you</span>}
        </div>
      </div>

      <div className="todo-actions">
        {todo.dueAt && !todo.done && (
          <button
            className="icon"
            title="Add to calendar / reminder"
            onClick={() => addToCalendar(todo)}
          >
            📆
          </button>
        )}
        {!todo.done && members.length > 1 && (
          <button
            className="icon"
            title="Suggest to someone"
            onClick={() => setPicking((v) => !v)}
          >
            👉
          </button>
        )}
        <button
          className="icon"
          title="Delete"
          onClick={() => remove({ token, id: todo._id })}
        >
          🗑️
        </button>
      </div>

      {picking && (
        <div className="picker">
          <span className="muted small">Suggest to…</span>
          {members
            .filter((m) => m._id !== meId)
            .map((m) => (
              <button
                key={m._id}
                onClick={async () => {
                  await suggest({ token, id: todo._id, toMemberId: m._id });
                  setPicking(false);
                }}
              >
                {m.emoji} {m.name}
              </button>
            ))}
        </div>
      )}
    </li>
  );
}
