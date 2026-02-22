import type { TeamMember } from "./team";

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

export type AssigneeOption = { id: string; name: string; type: "owner" | "core" | "subagent" };

export function assigneeOptionsFromTeam(teamMembers: TeamMember[]): AssigneeOption[] {
  return [{ id: "ivan", name: "Ivan", type: "owner" }, ...teamMembers.map((m) => ({ id: m.id, name: m.name, type: m.type }))];
}

export function assigneeName(id: string, options: AssigneeOption[]) {
  return options.find((a) => a.id === id)?.name ?? id;
}
