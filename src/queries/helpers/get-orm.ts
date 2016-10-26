import { Orm } from "../../core";
import { ORM_INSTANCES_CACHE } from "../../misc/cache";

export function getOrm<O extends Orm>(ref: string | symbol | O): Promise<O> {
	if (ref instanceof Orm) {
		return Promise.resolve(ref);
	}
	return ORM_INSTANCES_CACHE.get(ref);
}
