/**
 * TeamMember types — represents a human team member managed by the HR system.
 */

/** Employment status of a team member. */
export type TeamMemberStatus = 'active' | 'inactive' | 'on-leave';

/** Rank/seniority level of a team member. */
export type TeamMemberRank = 'junior' | 'mid' | 'senior' | 'lead' | 'principal';

/** A human team member in the organization. */
export interface TeamMember {
  /** Unique identifier. */
  id: string;
  /** Full name. */
  name: string;
  /** Email address. */
  email: string;
  /** Job title / role (e.g., "Frontend Developer", "DevOps Engineer"). */
  role: string;
  /** Department (e.g., "Engineering", "Design", "Product"). */
  department: string;
  /** Skill tags describing the member's capabilities. */
  skills: string[];
  /** Seniority rank. */
  rank: TeamMemberRank;
  /** Employment status. */
  status: TeamMemberStatus;
  /** ISO-8601 date the member joined. */
  joinedAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
}
