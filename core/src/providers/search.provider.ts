import { SearchIdentifier } from "../schemas/identifiers.schema";
import { SearchResult } from "../schemas/search.schema";

export interface SearchProvider {
    get(identifier: SearchIdentifier): Promise<SearchResult>;
}