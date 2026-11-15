import type { z } from "zod";
import type { Role } from "@prisma/client";

/** What the operator sees for one step, before confirming and again in the receipt. */
export type StepView = {
  /** One line: what will happen, with real names taken from the database. */
  title: string;
  /** Extra lines (quantities, serial numbers, stock before/after…). */
  details: string[];
  /**
   * Consequences the operator should read before confirming: side effects on other
   * records, things that will be left in an odd state, and the safer alternative.
   * Written by the server from live data, never by the model.
   */
  warnings?: string[];
};

/** "draft": the model is building a plan. "execute": the operator confirmed and this step is about to run. */
export type PreviewPhase = "draft" | "execute";

/**
 * What a preview may take into account besides the database: the steps already in
 * the plan, which will have run by the time this one does. Without it, a step
 * would warn about units that an earlier step of the same plan removes.
 */
export type PreviewContext = { phase: PreviewPhase; earlierSteps: readonly { action: string; params: Record<string, unknown> }[] };

/** A step an action asks to have planned before itself (e.g. empty the boxes, then change the template). */
export type PrerequisiteStep = { action: string; params: Record<string, unknown> };

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
  preview(params: z.infer<S>, actor: AgentActor, ctx: PreviewContext): Promise<StepView>;
  /**
   * Optional: clean-up steps to plan before this one, built from live data. They are
   * ordinary steps of other actions, so each gets its own line on the plan and receipt.
   */
  prerequisites?(params: z.infer<S>, actor: AgentActor, ctx: PreviewContext): Promise<PrerequisiteStep[]>;
  /** Run the site's own server action. Throws on failure. */
  execute(params: z.infer<S>, actor: AgentActor): Promise<void>;
};
