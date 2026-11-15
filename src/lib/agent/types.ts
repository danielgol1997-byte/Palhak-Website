import type { z } from "zod";
import type { Role } from "@prisma/client";

/** What the operator sees for one step, before confirming and again in the receipt. */
export type StepView = {
  /** One line: what will happen, with real names taken from the database. */
  title: string;
  /** Extra lines (quantities, serial numbers, stock before/after…). */
  details: string[];
};

/** A step as stored on AgentRun.plan. */
export type PlanStep = StepView & {
  action: string;
  params: Record<string, unknown>;
};

/** One line of the receipt stored on AgentRun.receipt. */
export type ReceiptStep = StepView & {
  index: number;
  action: string;
  status: "done" | "failed" | "skipped";
  error?: string;
};

export type AgentActor = { id: string; name: string; role: Role };

/**
 * Raised when a step cannot be planned (unknown id, not enough stock…).
 * The message goes back to the model so it can fix the step or explain to the operator.
 */
export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanError";
  }
}

export type AgentAction<S extends z.ZodType = z.ZodType> = {
  name: string;
  /** Explains to the model when to use it. */
  description: string;
  schema: S;
  /** Roles allowed to plan and run this action (default: every privileged operator). */
  superAdminOnly?: boolean;
  /** Check against live data and describe the step. Throws PlanError when it cannot work. */
  preview(params: z.infer<S>, actor: AgentActor): Promise<StepView>;
  /** Run the site's own server action. Throws on failure. */
  execute(params: z.infer<S>, actor: AgentActor): Promise<void>;
};
