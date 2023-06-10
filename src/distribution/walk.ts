import { Specification } from "../specification/specification";

export interface WalkRole {
  successorType: string;
  name: string;
  predecessorType: string;
}

export interface WalkStep {
  direction: "predecessor" | "successor";
  role: WalkRole;
  next: Walk;
}

export interface Walk {
  steps: WalkStep[];
}

export function walkFromSpecification(specification: Specification): Walk {
  if (specification.given.length !== 1)
    throw new Error("Specification must have exactly one given");
  const label = specification.given[0];

  if (specification.matches.length !== 1)
    throw new Error("Specification must have exactly one match");
  const match = specification.matches[0];

  if (match.conditions.length !== 1)
    throw new Error("Match must have exactly one condition");
  const condition = match.conditions[0];

  if (condition.type !== "path")
    throw new Error("Condition must be a path");
  if (condition.rolesRight.length !== 0)
    throw new Error("Path must not have roles on the right");
  if (condition.rolesLeft.length !== 1)
    throw new Error("Path must have exactly one role on the left");
  const role = condition.rolesLeft[0];

  const walk: Walk = {
    steps: [
      {
        direction: "successor",
        role: {
          successorType: match.unknown.type,
          name: role.name,
          predecessorType: label.type
        },
        next: {
          steps: []
        }
      }
    ]
  };
  return walk;
}