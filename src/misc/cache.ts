import { Orm } from "../core";
import { OrmDefinition, OrmRef } from "../definitions/orm";

import { DeferredMap } from "./deferred-map";

// need to use global to ensure it's a singleton across the process
// issues can occur otherwise if it is npm linked
function getGlobalIfExists<T>(name: string, builder: () => T): T {
	let key: string = `@lchemy/orm/${ name }`;
	if (global[key] == null) {
		let instance: T = builder();
		global[key] = instance;
	}
	return global[key];
}

let ORM_DEFINITIONS_CACHE: DeferredMap<OrmRef, OrmDefinition<Orm>> = getGlobalIfExists("ORM_DEFINITIONS_CACHE", () => {
	return new DeferredMap<OrmRef, OrmDefinition<Orm>>();
});
let ORM_CLASSES_CACHE: DeferredMap<OrmRef, typeof Orm> = getGlobalIfExists("ORM_CLASSES_CACHE", () => {
	return new DeferredMap<OrmRef, typeof Orm>();
});
let ORM_INSTANCES_CACHE: DeferredMap<OrmRef, Orm> = getGlobalIfExists("ORM_INSTANCES_CACHE", () => {
	return new DeferredMap<OrmRef, Orm>();
});

export {
	ORM_DEFINITIONS_CACHE,
	ORM_CLASSES_CACHE,
	ORM_INSTANCES_CACHE
};
