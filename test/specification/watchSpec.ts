import { Jinaga, JinagaTest } from "../../src";
import { Company, model, Office, OfficeClosed, President, User } from "./model";

describe("specification watch", () => {
    let creator: User;
    let emptyCompany: Company;
    let company: Company;
    let office: Office;
    let j: Jinaga;

    beforeEach(() => {
        creator = new User("--- PUBLIC KEY GOES HERE ---");
        emptyCompany = new Company(creator, "EmptyCo");
        company = new Company(creator, "TestCo");
        office = new Office(company, "TestOffice");
        j = JinagaTest.create({
            initialState: [
                creator,
                emptyCompany,
                company,
                office
            ]
        });
    });

    it("should return no results when empty", async () => {
        const specification = model.given(Company).match((company, facts) =>
            facts.ofType(Office)
                .join(office => office.company, company)
        );

        const offices: string[] = [];
        const officeObserver = j.watch(specification, emptyCompany, office => {
            offices.push(j.hash(office));
        });

        await officeObserver.initialized();
        await officeObserver.stop();

        expect(offices).toEqual([]);
    });

    it("should notify results when they previously existed", async () => {
        const specification = model.given(Company).match((company, facts) =>
            facts.ofType(Office)
                .join(office => office.company, company)
        );

        const offices: string[] = [];
        const officeObserver = j.watch(specification, company, office => {
            offices.push(j.hash(office));
        });

        await officeObserver.initialized();
        await officeObserver.stop();

        expect(offices).toEqual([j.hash(office)]);
    });

    it("should notify results when added", async () => {
        const specification = model.given(Company).match((company, facts) =>
            facts.ofType(Office)
                .join(office => office.company, company)
        );

        const offices: string[] = [];
        const officeObserver = j.watch(specification, company, office => {
            offices.push(j.hash(office));
        });

        await officeObserver.initialized();
        const newOffice = new Office(company, "NewOffice");
        await j.fact(newOffice);
        
        await officeObserver.stop();

        expect(offices).toEqual([j.hash(office), j.hash(newOffice)]);
    });

    it("should notify results when removed", async () => {
        const specification = model.given(Company).match((company, facts) =>
            facts.ofType(Office)
                .join(office => office.company, company)
                .notExists(office =>
                    facts.ofType(OfficeClosed)
                        .join(officeClosed => officeClosed.office, office)
                )
        );

        const offices: string[] = [];
        const officeObserver = j.watch(specification, company, office => {
            const hash = j.hash(office);
            offices.push(hash);
            return () => {
                offices.splice(offices.indexOf(hash), 1);
            }
        });

        await officeObserver.initialized();
        await j.fact(new OfficeClosed(office, new Date()));
        
        await officeObserver.stop();

        expect(offices).toEqual([]);
    });

    it("should notify child results when added", async () => {
        const specification = model.given(Company).match((company, facts) =>
            facts.ofType(Office)
                .join(office => office.company, company)
                .select(office => ({
                    identifier: office.identifier,
                    president: facts.ofType(President)
                        .join(president => president.office, office)
                }))
        );

        const offices: {
            identifier: string,
            president?: string
        }[] = [];
        const officeObserver = j.watch(specification, company, office => {
            const model = {
                identifier: office.identifier,
                president: undefined as string | undefined
            };
            offices.push(model);
            office.president.onAdded(president => {
                model.president = j.hash(president);
            });
        });

        await officeObserver.initialized();
        expect(offices).toEqual([
            {
                identifier: office.identifier,
                president: undefined
            }
        ]);

        const newPresident = new President(office, new User("--- PRESIDENT PUBLIC KEY ---"));
        await j.fact(newPresident);
        await officeObserver.stop();

        expect(offices).toEqual([
            {
                identifier: office.identifier,
                president: j.hash(newPresident)
            }
        ]);
    });
});