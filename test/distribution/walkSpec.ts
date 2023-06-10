import { Walk, walkFromSpecification } from "../../src/distribution/walk";
import { Company, Office, model } from "../model";

describe("walkFromSpecification", () => {
  it("should generate a successor walk", () => {
    const specification = model.given(Company).match((company, facts) => {
      return facts.ofType(Office)
        .join(office => office.company, company)
    }).specification;

    const walk = walkFromSpecification(specification);

    const expected: Walk = {
      steps: [
        {
          direction: "successor",
          role: {
            successorType: "Office",
            name: "company",
            predecessorType: "Company"
          },
          next: {
            steps: []
          }
        }
      ]
    };
    expect(walk).toEqual(expected);
  });
});