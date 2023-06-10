import { Walk, WalkStep, walkFromSpecification } from "../../src/distribution/walk";
import { Company, Office, model } from "../model";

describe("walkFromSpecification", () => {
  it("should generate a successor walk", () => {
    const specification = model.given(Company).match((company, facts) => {
      return facts.ofType(Office)
        .join(office => office.company, company)
    }).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("Company")
      .successor("company", "Office")
      .build();
    expect(walk).toEqual(expected);
  });

  it("should generate a predecessor walk", () => {
    const specification = model.given(Office).match((office, facts) => {
      return facts.ofType(Company)
        .join(company => company, office.company)
    }).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("Office")
      .predecessor("company", "Company")
      .build();
    expect(walk).toEqual(expected);
  });
});

class WalkBuilder {
  constructor(
    private type: string,
    private steps: WalkStep[]
  ) { }

  successor(name: string, successorType: string, then?: (builder: WalkBuilder) => WalkBuilder): WalkBuilder {
    const builder = new WalkBuilder(successorType, []);
    const next = then ? then(builder) : builder;
    return new WalkBuilder(this.type, [
      ...this.steps,
      {
        direction: "successor",
        role: {
          successorType,
          name,
          predecessorType: this.type
        },
        next: next.build()
      }
    ]);
  }

  predecessor(name: string, predecessorType: string, then?: (builder: WalkBuilder) => WalkBuilder): WalkBuilder {
    const builder = new WalkBuilder(predecessorType, []);
    const next = then ? then(builder) : builder;
    return new WalkBuilder(this.type, [
      ...this.steps,
      {
        direction: "predecessor",
        role: {
          successorType: this.type,
          name,
          predecessorType
        },
        next: next.build()
      }
    ]);
  }

  build(): Walk {
    return {
      steps: this.steps
    };
  }
}

function walkFrom(type: string): WalkBuilder {
  return new WalkBuilder(type, []);
}
