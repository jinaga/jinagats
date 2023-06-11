import { Specification } from "../specification/specification";
import { FactReference, Storage } from "../storage";
import { DistributionRules } from "./distribution-rules";
import { Walk, WalkStep, walkFromSpecification } from "./walk";

interface DistributionAssessmentPermit {
  outcome: "permit";
}

interface DistributionAssessmentDeny {
  outcome: "deny";
  reason: string;
  depth: number;
}

export type DistributionAssessment = DistributionAssessmentPermit | DistributionAssessmentDeny;

export class DistributionEngine {
  constructor(
    private distributionRules: DistributionRules,
    private store: Storage
  ) { }

  async assess(specification: Specification, start: FactReference[], user: FactReference | null): Promise<DistributionAssessment> {
    // If there are no rules, then permit any specification.
    if (this.distributionRules.rules.length === 0) {
      return {
        outcome: "permit"
      };
    }

    const targetWalk = walkFromSpecification(specification);

    // Assess the target walk against each distribution rule.
    const assessments = this.distributionRules.rules
      .filter(rule => rule.user === null) // TODO: Support user-specific rules.
      .map(rule =>
        assessWalk(targetWalk, rule.walk, 0)
      );
    return summarizeAssessments(assessments);
  }
}

function assessWalk(
  targetWalk: Walk,
  candidateWalk: Walk,
  depth: number): DistributionAssessment {

  if (candidateWalk.type !== targetWalk.type) {
    return {
      outcome: "deny",
      reason: `The distribution rule expects ${candidateWalk.type}, not ${targetWalk.type}.`,
      depth: depth
    };
  }

  // We have reached the end of the walk.
  if (targetWalk.steps.length === 0) {
    // If the candidate walk ends here, then the walk is permitted.
    if (candidateWalk.steps.length === 0) {
      return {
        outcome: "permit"
      };
    }
    // Otherwise, the walk is not permitted.
    else {
      const step = describeTargetStep(candidateWalk.steps[0], candidateWalk);
      return {
        outcome: "deny",
        reason: `Must continue to ${step}.`,
        depth: depth
      };
    }
  }

  // Assess each step in the target walk.
  const assessments: DistributionAssessment[] = targetWalk.steps.flatMap(targetStep => {
    // Find all candidate steps that match the target step.
    const candidateSteps = candidateWalk.steps
      .filter(candidateStep =>
        candidateStep.direction === targetStep.direction &&
        candidateStep.role === targetStep.role);

    // If there are no candidate steps, then the walk is not permitted.
    if (candidateSteps.length === 0) {
      const step = describeTargetStep(targetStep, targetWalk);
      return [
        {
          outcome: "deny",
          reason: `Cannot ${step}.`,
          depth: depth
        }
      ];
    }

    // Filter out candidate steps that have conditions.
    const candidateStepsMatchingCondition = candidateSteps.filter(candidateStep =>
      candidateStep.next.conditions.length === 0);

    // If there are no candidate steps, then the walk is not permitted.
    if (candidateStepsMatchingCondition.length === 0) {
      const step = describeTargetStep(targetStep, targetWalk);
      const conditions = candidateSteps
        .map(candidateStep =>
          candidateStep.next.conditions
            .map(condition => condition.step.direction === "predecessor"
              ? `predecessor ${condition.step.role} ${condition.step.next.type} ${condition.exists ? "exists" : "not exists"}`
              : `successor ${condition.step.next.type} ${condition.exists ? "exists" : "not exists"}`)
            .join(" and ")
        )
        .join(", or ");
      return [
        {
          outcome: "deny",
          reason: `Cannot ${step} without the condition that ${conditions}.`,
          depth: depth + 1
        }
      ];
    }

    // Assess each candidate step.
    return candidateStepsMatchingCondition.map(candidateStep =>
      assessWalk(targetStep.next, candidateStep.next, depth + 1)
    );
  });

  return summarizeAssessments(assessments);
}

function describeTargetStep(step: WalkStep, walk: Walk) {
  return step.direction === "predecessor"
    ? `follow predecessor ${walk.type}.${step.role} to ${step.next.type}`
    : `join to ${step.next.type}.${step.role}`;
}

function summarizeAssessments(assessments: DistributionAssessment[]): DistributionAssessment {
  // If any assessment permits the walk, then the walk is permitted.
  const deniedAssessments: DistributionAssessmentDeny[] = [];
  for (const assessment of assessments) {
    if (assessment.outcome === "permit") {
      return {
        outcome: "permit"
      };
    }
    deniedAssessments.push(assessment);
  }

  const maxDepth = deniedAssessments
    .reduce((max, assessment) =>
      assessment.depth > max ? assessment.depth : max, 0);
  const deepestDeniedAssessments = deniedAssessments
    .filter(assessment => assessment.depth === maxDepth);

  // Use one of those assessments as the reason for the failure.
  return {
    outcome: "deny",
    reason: deepestDeniedAssessments[0].reason,
    depth: maxDepth
  };
}