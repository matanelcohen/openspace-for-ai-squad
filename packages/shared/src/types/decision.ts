/**
 * Decision types — represents a recorded team decision.
 */

/** Lifecycle status of a decision. */
export type DecisionStatus = 'active' | 'superseded' | 'reversed';

/** A decision recorded in the squad's decision log. */
export interface Decision {
  /** Unique identifier. */
  id: string;
  /** Short title summarising the decision. */
  title: string;
  /** Agent or user who authored the decision. */
  author: string;
  /** ISO-8601 date the decision was made. */
  date: string;
  /** Explanation of why this decision was made. */
  rationale: string;
  /** Current lifecycle status. */
  status: DecisionStatus;
  /** File paths affected by the decision. */
  affectedFiles: string[];
}
