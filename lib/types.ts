export type MemoryStatus = "verified" | "quarantined" | "superseded";

export type ServiceState = {
  service: string;
  environment: string;
  version: string;
  health: "healthy" | "degraded";
  updatedAt?: string;
};

export type MemoryState = {
  id: string;
  content: string;
  type: "policy";
  status: MemoryStatus;
  trust: number;
  source: string;
  createdAt: string;
  supersededAt?: string;
  supersedes?: string;
  supersededBy?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  quarantinedAt?: string;
  adjudication?: MemoryCourtAdjudication;
};

export type MemoryCourtAdjudication = {
  relationship: "contradiction" | "supporting" | "unrelated";
  existingArgument: string;
  incomingArgument: string;
  judgeReasoning: string;
  recommendedVerdict: "accept" | "quarantine" | "supersede";
  confidence: number;
  provider: "fireworks" | "deterministic";
};

export type ContextEventState = {
  id: string;
  type: string;
  detail: string;
  createdAt: string;
};

export type AppState = {
  service: ServiceState;
  verifiedMemory: MemoryState;
  quarantinedMemory: MemoryState | null;
  memories: MemoryState[];
  events: ContextEventState[];
};

export type DeployResult = {
  outcome: "blocked" | "deployed";
  reason: string;
  state: AppState;
  trace: AgentTraceEntry[];
};

export type AgentTraceKind =
  | "user"
  | "model"
  | "tool_call"
  | "mongodb"
  | "guard"
  | "tool_result";

export type AgentTraceEntry = {
  id: string;
  kind: AgentTraceKind;
  label: string;
  detail: string;
  status?: "neutral" | "success" | "warning";
};
