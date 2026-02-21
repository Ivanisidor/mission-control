import { TEAM_MEMBERS } from "./team";

export type Status = "todo" | "in_progress" | "blocked" | "done";

export type Task = {
  id: string;
  title: string;
  status: Status;
  assignee: string;
  createdAt: string;
  updatedAt: string;
};

export const TASK_STORAGE_KEY = "mission-control-task-board-v2";

export const ASSIGNEE_OPTIONS = [
  { id: "ivan", name: "Ivan", type: "owner" as const },
  ...TEAM_MEMBERS.map((m) => ({ id: m.id, name: m.name, type: m.type })),
];

export function assigneeName(id: string) {
  return ASSIGNEE_OPTIONS.find((a) => a.id === id)?.name ?? id;
}
