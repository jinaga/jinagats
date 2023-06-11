import { Walk, WalkStep, walkFromSpecification } from "../../src/distribution/walk";
import { Company, Employee, Office, President, model } from "../model";

describe("walkFromSpecification", () => {
  it("should generate a successor walk", () => {
    const specification = model.given(Company).match((company, facts) =>
      facts.ofType(Office)
        .join(office => office.company, company)
    ).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("Company")
      .successor("company", "Office")
      .build();
    expect(walk).toEqual(expected);
  });

  it("should generate a successor walk with two steps", () => {
    const specification = model.given(Company).match((company, facts) =>
      facts.ofType(President)
        .join(president => president.office.company, company)
    ).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("Company")
      .successor("company", "Office", x => x
        .successor("office", "President")
      )
      .build();
    expect(walk).toEqual(expected);
  });

  it("should generate a successor walk with two labels", () => {
    const specification = model.given(Company).match((company, facts) =>
      facts.ofType(Office)
        .join(office => office.company, company)
        .selectMany(office => facts.ofType(President)
          .join(president => president.office, office)
        )
    ).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("Company")
      .successor("company", "Office", x => x
        .successor("office", "President")
      )
      .build();
    expect(walk).toEqual(expected);
  });

  it("should generate a predecessor walk", () => {
    const specification = model.given(Office).match((office, facts) =>
      facts.ofType(Company)
        .join(company => company, office.company)
    ).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("Office")
      .predecessor("company", "Company")
      .build();
    expect(walk).toEqual(expected);
  });

  it("should generate a predecessor walk with two steps", () => {
    const specification = model.given(President).match((president, facts) =>
      facts.ofType(Company)
        .join(company => company, president.office.company)
    ).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("President")
      .predecessor("office", "Office", x => x
        .predecessor("company", "Company")
      )
      .build();
    expect(walk).toEqual(expected);
  });

  it("should generate a predecessor walk with two labels", () => {
    const specification = model.given(President).match((president, facts) =>
      facts.ofType(Office)
        .join(office => office, president.office)
        .selectMany(office => facts.ofType(Company)
          .join(company => company, office.company)
        )
    ).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("President")
      .predecessor("office", "Office", x => x
        .predecessor("company", "Company")
      )
      .build();
    expect(walk).toEqual(expected);
  });

  it("should generate a walk from a specification that forks", () => {
    const specification = model.given(Company).match((company, facts) =>
      facts.ofType(Office)
        .join(office => office.company, company)
        .selectMany(office => facts.ofType(President)
          .join(president => president.office, office)
          .selectMany(president => facts.ofType(Employee)
            .join(employee => employee.office, office)
          )
        )
    ).specification;

    const walk = walkFromSpecification(specification);

    const expected = walkFrom("Company")
      .successor("company", "Office", x => x
        .successor("office", "President")
        .successor("office", "Employee")
      )
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
