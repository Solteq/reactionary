import { SearchIdentifier } from "../schemas/identifiers.schema";
import { SearchResult, SearchResultSchema } from "../schemas/search.schema";

export abstract class SearchProvider<T = SearchResult> {
    public abstract get(identifier: SearchIdentifier): Promise<T>;
    public schema() {
        return SearchResultSchema;
    }
}