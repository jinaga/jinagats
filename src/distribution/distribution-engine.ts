import { Specification } from "../specification/specification";
import { FactReference, Storage } from "../storage";
import { DistributionRules } from "./distribution-rules";

export type DistributionAssessment = {
  outcome: "permit";
} | {
  outcome: "deny";
  reason: string;
};

export class DistributionEngine {
  constructor(
    private distributionRules: DistributionRules,
    private store: Storage
  ) { }

  async assess(specification: Specification, start: FactReference[], user: FactReference | null): Promise<DistributionAssessment> {
    return {
      outcome: "permit"
    };
  }
}