import { BaseQuery } from "../schemas/queries/base.query";
import { InventoryQuery } from "../schemas/queries/inventory.query";
import { Session } from "../schemas/session.schema";

export interface CachingStrategyEvaluation {
    key: string;
    cacheDurationInSeconds: number;
    canCache: boolean;
}

export interface CachingStrategy {
    get(query: BaseQuery, session: Session): CachingStrategyEvaluation;
}

export class BaseCachingStrategy implements CachingStrategy {
    public get(query: BaseQuery, session: Session): CachingStrategyEvaluation {
        const q = query as InventoryQuery;

        return {
            key: q.sku,
            cacheDurationInSeconds: 300,
            canCache: true
        }
    }
}