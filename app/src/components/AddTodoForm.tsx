import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { Member } from "./TodoApp";

export default function AddTodoForm({
  token,
  members,
  meId,
}: {
  token: string;
  members: Member[];
  meId: Id<"members">;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [due, setDue] = useState<string>("");
  const [expanded, setExpanded] = useState(false);
  const add = useMutation(api.todos.add);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await add({
      token,
      title,
      assigneeId: assignee ? (assignee as Id<"members">) : undefined,
      dueAt: due ? new Date(due).getTime() : undefined,
    });
    setTitle("");
    setAssignee("");
    setDue("");
    setExpanded(false);
  }

  return (
    <form className="add" onSubmit={submit}>
      <div className="add-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder="Add a task…"
          aria-label="Task title"
        />
        <button type="submit" className="primary" disabled={!title.trim()}>
          Add
        </button>
      </div>
      {expanded && (
        <div className="add-extra">
          <label className="inline">
            For
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Anyone</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.emoji} {m.name}
                  {m._id === meId ? " (me)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="inline">
            Due
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
        </div>
      )}
    </form>
  );
}
