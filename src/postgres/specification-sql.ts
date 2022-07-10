import { Label, Match, PathCondition, Projection, Specification } from "../specification/specification";
import { FactBookmark, FactReference } from "../storage";
import { getFactTypeId, getRoleId } from "./maps";
import { FactDescription, InputDescription, QueryDescription, SpecificationSqlQuery } from "./query-description";

type FactByIdentifier = {
    [identifier: string]: FactDescription;
};

class DescriptionBuilder {
    constructor(
        private factTypes: Map<string, number>,
        private roleMap: Map<number, Map<string, number>>) { }

    public buildDescriptions(start: FactReference[], specification: Specification): QueryDescription[] {
        // Verify that the number of start facts equals the number of inputs
        if (start.length !== specification.given.length) {
            throw new Error(`The number of start facts (${start.length}) does not equal the number of inputs (${specification.given.length})`);
        }
        // Verify that the input type matches the start fact type
        for (let i = 0; i < start.length; i++) {
            if (start[i].type !== specification.given[i].type) {
                throw new Error(`The type of start fact ${i} (${start[i].type}) does not match the type of input ${i} (${specification.given[i].type})`);
            }
        }

        // Allocate a fact table for each given.
        // While the fact type and hash parameters are zero, the join will not be written.
        const inputs: InputDescription[] = specification.given
            .map((label, i) => ({
                label: label.name,
                factIndex: i+1,
                factTypeId: getFactTypeId(this.factTypes, label.type),
                factHash: start[i].hash,
                factTypeParameter: 0,
                factHashParameter: 0
            }));
        const facts: FactDescription[] = specification.given
            .map((label, i) => ({
                factIndex: i+1,
                type: label.type
            }));
        const givenFacts = specification.given.reduce((knownFacts, label, i) => ({
            ...knownFacts,
            [label.name]: facts[i]
        }), {} as FactByIdentifier);


        // The QueryDescription is an immutable data type.
        // Initialize it with the inputs and facts.
        // The DescriptionBuilder will branch at various points, and
        // build on the current query description along each branch.
        const initialQueryDescription = new QueryDescription(inputs, [], [], facts, [], []);
        const { queryDescriptions, knownFacts } = this.addEdges(initialQueryDescription, givenFacts, [], "", specification.matches);

        // The final query description represents the complete tuple.
        // Build projections onto that one.
        const finalQueryDescription = queryDescriptions[queryDescriptions.length - 1];
        const queryDescriptionsWithProjections = this.addProjections(finalQueryDescription, knownFacts, specification.projections);
        return [ ...queryDescriptions, ...queryDescriptionsWithProjections ];
    }

    private addEdges(queryDescription: QueryDescription, knownFacts: FactByIdentifier, path: number[], prefix: string, matches: Match[]): { queryDescriptions: QueryDescription[], knownFacts: FactByIdentifier } {
        const queryDescriptions: QueryDescription[] = [];
        for (const match of matches) {
            for (const condition of match.conditions) {
                if (condition.type === "path") {
                    ({queryDescription, knownFacts} = this.addPathCondition(queryDescription, knownFacts, path, match.unknown, prefix, condition));
                }
                else if (condition.type === "existential") {
                    if (condition.exists) {
                        // Include the edges of the existential condition into the current
                        // query description.
                        const { queryDescriptions: newQueryDescriptions } = this.addEdges(queryDescription, knownFacts, path, prefix, condition.matches);
                        const last = newQueryDescriptions.length - 1;
                        queryDescriptions.push(...newQueryDescriptions.slice(0, last));
                        queryDescription = newQueryDescriptions[last];
                    }
                    else {
                        // Branch from the current query description and follow the
                        // edges of the existential condition.
                        // This will produce tuples that prove the condition false.
                        const { queryDescriptions: newQueryDescriptions } = this.addEdges(queryDescription, knownFacts, path, prefix, condition.matches);
                        
                        // Then apply the where clause and continue with the tuple where it is true.
                        // The path describes which not-exists condition we are currently building on.
                        // Because the path is not empty, labeled facts will be included in the output.
                        const { query: queryDescriptionWithNotExist, path: conditionalPath } = queryDescription.withNotExistsCondition(path);
                        const { queryDescriptions: newQueryDescriptionsWithNotExists } = this.addEdges(queryDescriptionWithNotExist, knownFacts, conditionalPath, prefix, condition.matches);
                        const last = newQueryDescriptionsWithNotExists.length - 1;
                        const queryDescriptionConditional = newQueryDescriptionsWithNotExists[last];

                        // If the negative existential condition is not satisfiable, then
                        // that means that the condition will always be true.
                        // We can therefore skip the branch for the negative existential condition.
                        if (queryDescriptionConditional.isSatisfiable()) {
                            queryDescriptions.push(...newQueryDescriptions);
                            queryDescriptions.push(...newQueryDescriptionsWithNotExists.slice(0, last));
                            queryDescription = queryDescriptionConditional;
                        }
                    }
                }
            }
        }
        queryDescriptions.push(queryDescription);
        return { queryDescriptions, knownFacts };
    }

    addPathCondition(queryDescription: QueryDescription, knownFacts: FactByIdentifier, path: number[], unknown: Label, prefix: string, condition: PathCondition): { queryDescription: QueryDescription, knownFacts: FactByIdentifier } {
        // If no input parameter has been allocated, allocate one now.
        const input = queryDescription.inputByLabel(condition.labelRight);
        if (input && input.factTypeParameter === 0) {
            queryDescription = queryDescription.withInputParameter(input.label);
        }

        // Determine whether we have already written the output.
        const knownFact = knownFacts[unknown.name];
        const roleCount = condition.rolesLeft.length + condition.rolesRight.length;

        // Walk up the right-hand side.
        // This generates predecessor joins from a given or prior label.
        let fact = knownFacts[condition.labelRight];
        let type = fact.type;
        let factIndex = fact.factIndex;
        for (const [i, role] of condition.rolesRight.entries()) {
            // If the type or role is not known, then no facts matching the condition can
            // exist. The query is unsatisfiable.
            const typeId = getFactTypeId(this.factTypes, type);
            if (!typeId) {
                return { queryDescription: QueryDescription.unsatisfiable, knownFacts };
            }
            const roleId = getRoleId(this.roleMap, typeId, role.name);
            if (!roleId) {
                return { queryDescription: QueryDescription.unsatisfiable, knownFacts };
            }

            const { query: queryWithParameter, parameterIndex: roleParameter } = queryDescription.withParameter(roleId);
            if (i === roleCount - 1 && knownFact) {
                // If we have already written the output, we can use the fact index.
                queryDescription = queryWithParameter.withEdge(knownFact.factIndex, factIndex, roleParameter, path);
                factIndex = knownFact.factIndex;
            }
            else {
                // If we have not written the fact, we need to write it now.
                const { query, factIndex: predecessorFactIndex } = queryWithParameter.withFact(role.targetType);
                queryDescription = query.withEdge(predecessorFactIndex, factIndex, roleParameter, path);
                factIndex = predecessorFactIndex;
            }
            type = role.targetType;
        }

        // Walk up the left-hand side.
        // We will need to reverse this walk to generate successor joins.
        type = unknown.type;
        const newEdges: {
            roleId: number,
            declaringType: string,
        }[] = [];
        for (const role of condition.rolesLeft) {
            // If the type or role is not known, then no facts matching the condition can
            // exist. The query is unsatisfiable.
            const typeId = getFactTypeId(this.factTypes, type);
            if (!typeId) {
                return { queryDescription: QueryDescription.unsatisfiable, knownFacts };
            }
            const roleId = getRoleId(this.roleMap, typeId, role.name);
            if (!roleId) {
                return { queryDescription: QueryDescription.unsatisfiable, knownFacts };
            }

            newEdges.push({
                roleId,
                declaringType: type
            });
            type = role.targetType;
        }
        newEdges.reverse().forEach(({ roleId, declaringType }, i) => {
            const { query: queryWithParameter, parameterIndex: roleParameter } = queryDescription.withParameter(roleId);
            if (condition.rolesRight.length + i === roleCount - 1 && knownFact) {
                queryDescription = queryWithParameter.withEdge(factIndex, knownFact.factIndex, roleParameter, path);
                factIndex = knownFact.factIndex;
            }
            else {
                const { query: queryWithFact, factIndex: successorFactIndex } = queryWithParameter.withFact(declaringType);
                queryDescription = queryWithFact.withEdge(factIndex, successorFactIndex, roleParameter, path);
                factIndex = successorFactIndex;
            }
        });

        // If we have not captured the known fact, add it now.
        if (!knownFact) {
            knownFacts = { ...knownFacts, [unknown.name]: { factIndex, type: unknown.type } };
            // If we have not written the output, write it now.
            // Only write the output if we are not inside of an existential condition.
            // Use the prefix, which will be set for projections.
            if (path.length === 0) {
                queryDescription = queryDescription.withOutput(prefix + unknown.name, unknown.type, factIndex);
            }
        }
        return { queryDescription, knownFacts };
    }

    addProjections(queryDescription: QueryDescription, knownFacts: FactByIdentifier, projections: Projection[]): QueryDescription[] {
        const queryDescriptions: QueryDescription[] = [];
        projections.forEach(projection => {
            if (projection.type === "specification") {
                // Produce more facts in the tuple, and prefix the labels with the projection name.
                const prefix = projection.name + ".";
                const { queryDescriptions: queryDescriptionsWithEdges } = this.addEdges(queryDescription, knownFacts, [], prefix, projection.matches);
                queryDescriptions.push(...queryDescriptionsWithEdges);
            }
        });
        return queryDescriptions;
    }
}

export function sqlFromSpecification(start: FactReference[], bookmarks: FactBookmark[], limit: number, specification: Specification, factTypes: Map<string, number>, roleMap: Map<number, Map<string, number>>): SpecificationSqlQuery[] {
    const descriptionBuilder = new DescriptionBuilder(factTypes, roleMap);
    const descriptions = descriptionBuilder.buildDescriptions(start, specification);

    // Only generate SQL for satisfiable queries.
    return descriptions
        .filter(description => description.isSatisfiable())
        .map(description => description.generateSqlQuery(bookmarks, limit));
}
