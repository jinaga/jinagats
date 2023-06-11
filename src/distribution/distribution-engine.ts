import { Specification } from "../specification/specification";
import { FactReference, Storage } from "../storage";
import { DistributionRules } from "./distribution-rules";
import { Walk, walkFromSpecification } from "./walk";

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
    const assessments = this.distributionRules.rules.map(rule =>
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

  // If the target walk is empty, then we have reached the end of the walk.
  if (targetWalk.steps.length === 0) {
    return {
      outcome: "permit"
    };
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
      return [
        {
          outcome: "deny",
          reason: `Cannot follow ${targetStep.direction} of ${targetWalk.type} ${targetStep.next.type}.${targetStep.role}`,
          depth: depth
        }
      ];
    }

    // Assess each candidate step.
    return candidateSteps.map(candidateStep =>
      assessWalk(targetStep.next, candidateStep.next, depth + 1)
    );
  });

  return summarizeAssessments(assessments);
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