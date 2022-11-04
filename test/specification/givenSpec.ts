import { Model, SpecificationOf } from "../../src/specification/given";

class User {
    static Type = "User" as const;
    type = User.Type;
    constructor(
        public publicKey: string
    ) {}
}

class UserName {
    static Type = "User.Name" as const;
    type = UserName.Type;
    constructor(
        public user: User,
        public value: string
    ) {}
}

class Company {
    static Type = "Company" as const;
    type = Company.Type;
    constructor(
        public creator: User,
        public identifier: string
    ) {}
}

class Office {
    static Type = "Office" as const;
    type = Office.Type;
    constructor(
        public company: Company,
        public identifier: string
    ) {}
}

class President {
    static Type = "President" as const;
    type = President.Type;
    constructor(
        public office: Office,
        public user: User
    ) {}
}

const model = new Model()
    .type(User)
    .type(UserName, f => f
        .predecessor("user", User)
    )
    .type(Company, f => f
        .predecessor("creator", User)
    )
    .type(Office, f => f
        .predecessor("company", Company)
    )
    .type(President, f => f
        .predecessor("office", Office)
        .predecessor("user", User)
    );

describe("given", () => {
    it("should parse a successor join", () => {
        const specification = model.given(Company).match((company, facts) =>
            facts.ofType(Office)
                .join(office => office.company, company)
        );

        expectSpecification(specification, `
            (p1: Company) {
                u1: Office [
                    u1->company: Company = p1
                ]
            }`);
    });

    it("should parse a field projection", () => {
        const specification = model.given(Company).match((company, facts) =>
            facts.ofType(Office)
                .join(office => office.company, company)
                .select(office => office.identifier)
        );

        expectSpecification(specification, `
            (p1: Company) {
                u1: Office [
                    u1->company: Company = p1
                ]
            } => u1.identifier`);
    });
    // it("should return a specification", () => {
    //     const officeIdentifiers = given(Company).match((company, facts) =>
    //         facts.ofType(Office)
    //             .join(office => office.company, company)
    //             .select(office => office.identifier)
    //     );
    //     const officeIdentifierComposites = given(Company).match((company, facts) =>
    //         facts.ofType(Office)
    //             .join(office => office.company, company)
    //             .select(office => ({
    //                 identifier: office.identifier
    //             }))
    //     );
    //     const officePresidentSuccessors = given(Company).match((company, facts) =>
    //         facts.ofType(Office)
    //             .join(office => office.company, company)
    //             .select(office => ({
    //                 identifier: office.identifier,
    //                 presidents: facts.ofType(President)
    //                     .join(president => president.office, office)
    //             }))
    //     );
    //     const offices = given(Company).match((company, facts) =>
    //         facts.ofType(Office)
    //             .join(office => office.company, company)
    //             .select(office => ({
    //                 identifier: office.identifier,
    //                 presidents: facts.ofType(President)
    //                     .join(president => president.office, office)
    //                     .select(president => ({
    //                         user: president.user,
    //                         names: facts.ofType(UserName)
    //                             .join(userName => userName.user, president.user)
    //                             .select(userName => userName.value)
    //                     }))
    //             }))
    //     );

    //     expect(offices).toBeDefined();
    // });
});

function expectSpecification<T>(specification: SpecificationOf<T>, expected: string) {
    expect("\n" + specification.toDescriptiveString(3)).toBe(expected + "\n");
}