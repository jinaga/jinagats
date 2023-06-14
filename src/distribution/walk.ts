import { ExistentialCondition, Match, Role, Specification, isExistentialCondition, isPathCondition } from "../specification/specification";

export interface WalkStep {
  direction: "predecessor" | "successor";
  role: string;
  next: Walk;
}

export interface Walk {
  type: string;
  steps: WalkStep[];
  conditions: WalkStep[];
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

  const walk = walks[label.name];
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

  const pathConditions = match.conditions.filter(isPathCondition);

  // TODO: Support multiple path conditions.
  if (pathConditions.length !== 1)
    throw new Error("Match must have exactly one path condition");
  const condition = pathConditions[0];

  // Get the continuation from the unknown. If no later match
  // wants to continue from this unknown, then we stop there.
  const initialWalk = walks[match.unknown.name] || {
    type: match.unknown.type,
    steps: [],
    conditions: []
  };

  // Apply existential conditions to the continuation.
  const existentialConditions = match.conditions.filter(isExistentialCondition);
  const next = existentialConditions.reduce((walk, condition) => {
    return walkFromExistentialCondition(walk, condition, match.unknown.name, labels);
  }, initialWalk);

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
        role: role.name,
        next: next
      }
    ],
    conditions: []
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
        role: role.name,
        next: next
      }
    ],
    conditions: []
  };
  return walkRolesLeft(roles.slice(1), role.predecessorType, walk);
}

function walkFromExistentialCondition(walk: Walk, condition: ExistentialCondition, label: string, labels: LabeledTypes): Walk {
  if (condition.exists) {
    throw new Error("Positive existential conditions are not supported");
  }
  const childWalks = walksFromMatches(condition.matches, labels);
  const childWalk = childWalks[label];
  if (!childWalk) {
    throw new Error(`Could not find walk for label ${label}`);
  }
  if (childWalk.conditions.length !== 0) {
    throw new Error("Existential conditions cannot themselves have conditions");
  }
  return {
    type: walk.type,
    steps: walk.steps,
    conditions: [
      ...walk.conditions,
      ...childWalk.steps,
    ]
  };
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
    ],
    conditions: [
      ...left.conditions,
      ...right.conditions
    ]
  };
}

