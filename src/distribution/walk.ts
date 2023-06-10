import { Role, Specification } from "../specification/specification";

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
    
  return walkRolesLeft(condition.rolesLeft, match.unknown.type,
    walkRolesRight(condition.rolesRight, label.type));
}

function walkRolesRight(roles: Role[], type: string): Walk {
  if (roles.length === 0) {
    return { steps: [] };
  }

  const role = roles[0];
  const next = walkRolesRight(roles.slice(1), role.predecessorType);

  const walk: Walk = {
    steps: [
      {
        direction: "predecessor",
        role: {
          successorType: type,
          name: role.name,
          predecessorType: role.predecessorType
        },
        next: next
      }
    ]
  };
  return walk;
}

function walkRolesLeft(roles: Role[], type: string, next: Walk): Walk {
  if (roles.length === 0) {
    return next;
  }

  const role = roles[0];

  const walk: Walk = {
    steps: [
      {
        direction: "successor",
        role: {
          successorType: type,
          name: role.name,
          predecessorType: role.predecessorType
        },
        next: next
      }
    ]
  };
  return walkRolesLeft(roles.slice(1), role.predecessorType, walk);
}
