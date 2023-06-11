import { User } from "../model/user";
import { SpecificationOf } from "../specification/model";
import { Specification } from "../specification/specification";
import { Walk } from "./walk";

export interface DistributionRule {
  walk: Walk;
  user: Specification;
}

export class DistributionRules {
  with(rules: (r: DistributionRules) => DistributionRules): DistributionRules {
    return rules(this);
  }

  everyone<T, U>(specification: SpecificationOf<T, U>): DistributionRules {
    return this;
  }

  only<T, U>(specification: SpecificationOf<T, U>, user: SpecificationOf<T, User>): DistributionRules {
    return this;
  }
}