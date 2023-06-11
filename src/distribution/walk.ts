import { Match, Role, Specification } from "../specification/specification";

export interface WalkRole {
  name: string;
}

export interface WalkStep {
  direction: "predecessor" | "successor";
  role: WalkRole;
  next: Walk;
}

export interface Walk {
  type: string;
  steps: WalkStep[];
}

interface LabeledWalks {
  [name: string]: Walk;
}

interface LabeledTypes {
  [name: string]: string;
}

export function walkFromSpecification(specification: Specification): Walk {
  if (specification.given.length !== 1)
    throw new Error("Specification must have exactly one given");
  const label = specification.given[0];

  const walks = walksFromMatches(specification.matches, {
    [label.name]: label.type
  });

  const walk = walks[label.name] || { steps: [] };
  return walk;
}

function walksFromMatches(matches: Match[], labels: LabeledTypes): LabeledWalks {
  // This recursive function visits all of the matches in a specification.
  // It builds a set of walks. These represent the continuations from labeled
  // positions of the specification.

  // If we have reached the end of the matches, start with an empty set of walks.
  if (matches.length === 0) {
    return {};
  }

  // Add the unknown type to the labels.
  labels = {
    ...labels,
    [matches[0].unknown.name]: matches[0].unknown.type
  };
  // Then recursively get the continuations from the remaining matches.
  let walks = walksFromMatches(matches.slice(1), labels);

  // Now focus on the current match.
  const match = matches[0];

  if (match.conditions.length !== 1)
    throw new Error("Match must have exactly one condition");
  const condition = match.conditions[0];

  if (condition.type !== "path")
    throw new Error("Condition must be a path");

  // Get the continuation from the unknown. If no later match
  // wants to continue from this unknown, then we stop there.
  const next = walks[match.unknown.name] || { type: match.unknown.type, steps: [] };

  // Walk from the label to the unknown.
  const type = labels[condition.labelRight];
  const walk = walkRolesLeft(condition.rolesLeft, match.unknown.type,
    walkRolesRight(condition.rolesRight, type, next));

  // The continuation from the unknown has been satisfied.
  walks = Object.keys(walks).reduce((result, key) => {
    if (key !== match.unknown.name) {
      result[key] = walks[key];
    }
    return result;
  }, {} as LabeledWalks);

  // We want to continue from the label.
  const otherWalk = walks[condition.labelRight];
  walks = {
    ...walks,
    [condition.labelRight]: mergeWalks(walk, otherWalk)
  };

  return walks;
}

function walkRolesRight(roles: Role[], type: string, next: Walk): Walk {
  if (roles.length === 0) {
    return next;
  }

  const role = roles[0];
  next = walkRolesRight(roles.slice(1), role.predecessorType, next);

  const walk: Walk = {
    type: type,
    steps: [
      {
        direction: "predecessor",
        role: {
          name: role.name
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
    type: role.predecessorType,
    steps: [
      {
        direction: "successor",
        role: {
          name: role.name
        },
        next: next
      }
    ]
  };
  return walkRolesLeft(roles.slice(1), role.predecessorType, walk);
}

function mergeWalks(left: Walk, right: Walk | undefined): Walk {
  if (!right) {
    return left;
  }
  if (left.type !== right.type) {
    throw new Error(`Cannot merge walks of different types: ${left.type} and ${right.type}`);
  }
  return {
    type: left.type,
    steps: [
      ...left.steps,
      ...right.steps
    ]
  };
}

