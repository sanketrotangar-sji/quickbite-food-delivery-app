export type AgentId = "order" | "dispatch" | "support" | "clarify";

export type RouteResult = {
  agent: AgentId;
  confidence: number;
  reason: string;
};

export type SpecialistDef = {
  id: Exclude<AgentId, "clarify">;
  systemPrompt: string;
  toolNames: string[];
};
