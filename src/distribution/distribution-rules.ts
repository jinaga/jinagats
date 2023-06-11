import { User } from "../model/user";
import { SpecificationOf } from "../specification/model";
import { Specification } from "../specification/specification";
import { Walk, walkFromSpecification } from "./walk";

export interface DistributionRule {
  walk: Walk;
  user: Specification | null;
}

export class DistributionRules {
  constructor(
    public rules: DistributionRule[]
  ) { }

  with(rules: (r: DistributionRules) => DistributionRules): DistributionRules {
    return new DistributionRules([
      ...this.rules,
      ...rules(new DistributionRules([])).rules
    ]);
  }

  everyone<T, U>(specification: SpecificationOf<T, U>): DistributionRules {
    return new DistributionRules([
      ...this.rules,
      {
        walk: walkFromSpecification(specification.specification),
        user: null
      }
    ]);
  }

  only<T, U>(specification: SpecificationOf<T, U>, user: SpecificationOf<T, User>): DistributionRules {
    return new DistributionRules([
      ...this.rules,
      {
        walk: walkFromSpecification(specification.specification),
        user: user.specification
      }
    ]);
  }
}