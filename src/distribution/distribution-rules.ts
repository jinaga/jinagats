import { User } from "../model/user";
import { SpecificationOf } from "../specification/model";

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