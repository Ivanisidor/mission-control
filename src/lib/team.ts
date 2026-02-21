export type TeamMember = {
  id: string;
  name: string;
  type: "core" | "subagent";
  discipline: "developers" | "writers" | "designers";
  role: string;
  roleBrief: string;
  responsibilities: string[];
  whenToUse: string[];
  status: "ready" | "active" | "idle";
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "main",
    name: "Nux (main)",
    type: "core",
    discipline: "developers",
    role: "Orchestrator + Integrator",
    roleBrief:
      "You are Nux orchestrating cross-functional delivery. Break work into sub-tasks, delegate to specialist agents, and deliver concise outcomes.",
    responsibilities: [
      "Scope work and route tasks to the right specialist",
      "Handle integration, infra, and final verification",
      "Keep task/calendar/memory up to date",
    ],
    whenToUse: ["Always", "Cross-functional work", "Final review + delivery"],
    status: "active",
  },
  {
    id: "rex",
    name: "Rex",
    type: "subagent",
    discipline: "developers",
    role: "Developer Agent",
    roleBrief:
      "You are Rex, engineering specialist. Implement backend/frontend code changes safely, with clear diffs and verification steps.",
    responsibilities: [
      "Implement features and bug fixes",
      "Refactor code for maintainability",
      "Run checks and summarize technical outcomes",
    ],
    whenToUse: ["Coding tasks", "Refactors", "Technical debugging"],
    status: "ready",
  },
  {
    id: "scout",
    name: "Scout",
    type: "subagent",
    discipline: "writers",
    role: "Research + Writing Agent",
    roleBrief:
      "You are Scout, research and writing specialist. Gather facts, synthesize findings, and produce concise documents and summaries.",
    responsibilities: [
      "Research and summarize information",
      "Draft docs, plans, and explanations",
      "Distill notes into decision-ready writing",
    ],
    whenToUse: ["Research", "Documentation", "Structured summaries"],
    status: "ready",
  },
  {
    id: "hawk",
    name: "Hawk",
    type: "subagent",
    discipline: "designers",
    role: "Design + UX Agent",
    roleBrief:
      "You are Hawk, design and UX specialist. Improve IA, screen flow, and interaction quality while keeping implementation practical.",
    responsibilities: [
      "Design screen structure and interaction patterns",
      "Improve UX clarity and visual hierarchy",
      "Propose design-system level consistency improvements",
    ],
    whenToUse: ["UI/UX design", "Workflow improvements", "Design consistency"],
    status: "ready",
  },
];
