import {
	Filter, Orm, ORM_PROPERTIES, OrmProperties
} from "../../core";

import { getObjectAtPath } from "./get-object-at-path";
import { testFilter } from "./test-filter";

function mergeResultSet(baseSet: Object[], container: JoinResultContainer): void {
	let { results, orm, where }: JoinResultContainer = container,
		path: string = Orm.getProperties(orm).path.join(".");

	baseSet.forEach((base) => {
		let matches: Object[] = base[path] = [];
		results.filter((join) => {
			return testFilter(where, orm, base, join);
		}).forEach((join) => {
			matches.push(getObjectAtPath(join, path));
		});
	});
}

export type JoinResultContainer = {
	results: Object[],
	orm: Orm,
	where: Filter
};
export function mergeResultSets(baseResults: Object[], containers: JoinResultContainer[]): Object[] {
	containers.forEach((container) => mergeResultSet(baseResults, container));
	return baseResults;
}
