import { Query } from '../query/query';
import { Preposition } from '../query/query-parser';
import { Direction, Join } from '../query/steps';
import { FactRecord, FactReference, factReferenceEquals, Storage } from '../storage';
import { flattenAsync, mapAsync } from '../util/fn';

function getPredecessors(collection: FactReference[] | FactReference) {
    if (!collection) {
        return [];
    }
    if (Array.isArray(collection)) {
        return collection;
    }
    return [ collection ];
}

interface AuthorizationRule {
    isAuthorized(userFact: FactReference, fact: FactRecord, store: Storage): Promise<boolean>;
}

class AuthorizationRuleAny implements AuthorizationRule {
    isAuthorized(userFact: FactReference, fact: FactRecord, store: Storage) {
        return Promise.resolve(true);
    }
}

class AuthorizationRuleBy implements AuthorizationRule {
    constructor(
        private head: Join,
        private tail: Query
    ) {

    }

    async isAuthorized(userFact: FactReference, fact: FactRecord, store: Storage) {
        if (!userFact) {
            return false;
        }
        const predecessors = getPredecessors(fact.predecessors[this.head.role]);
        const results = await flattenAsync(predecessors, async p =>
            await this.executeQuery(store, p));
        return results.some(factReferenceEquals(userFact));
    }

    private async executeQuery(store: Storage, predecessors: FactReference) {
        if (this.tail.steps.length === 0) {
            return [ predecessors ];
        }
        const results = await store.query(predecessors, this.tail);
        return results
            .map(path => path[path.length-1]);
    }
}

export class AuthorizationRules {
    private rulesByType: {[type: string]: AuthorizationRule[]} = {};

    any(type: string) {
        return this.with(type, new AuthorizationRuleAny());
    }

    type<T, U>(type: string, preposition: Preposition<T, U>) {
        if (preposition.steps.length === 0) {
            throw new Error(`Invalid authorization rule for type ${type}: the query matches the fact itself.`);
        }
        const head = preposition.steps[0];
        if (!(head instanceof Join)) {
            throw new Error(`Invalid authorization rule for type ${type}: the query does not begin with a predecessor.`);
        }
        if (head.direction !== Direction.Predecessor) {
            throw new Error(`Invalid authorization rule for type ${type}: the query expects successors.`);
        }

        const tail = new Query(preposition.steps.slice(1));
        return this.with(type, new AuthorizationRuleBy(head, tail));
    }

    private with(type: string, rule: AuthorizationRule) {
        const oldRules = this.rulesByType[type] || [];
        const newRules = [...oldRules, rule];
        const newRulesByType = { ...this.rulesByType, [type]: newRules };
        const result = new AuthorizationRules();
        result.rulesByType = newRulesByType;
        return result;
    }

    async isAuthorized(userFact: FactReference, fact: FactRecord, store: Storage) {
        const rules = this.rulesByType[fact.type] || [];
        const results = await mapAsync(rules, async r => await r.isAuthorized(userFact, fact, store));
        return results.some(b => b);
    }
}