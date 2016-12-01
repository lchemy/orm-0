import { Orm } from "../core";
import { OrmDefinition, OrmRef } from "../definitions/orm";

import { DeferredMap } from "./deferred-map";

export const ORM_DEFINITIONS_CACHE: DeferredMap<OrmRef, OrmDefinition<Orm>> = new DeferredMap<OrmRef, OrmDefinition<Orm>>();
export const ORM_CLASSES_CACHE: DeferredMap<OrmRef, typeof Orm> = new DeferredMap<OrmRef, typeof Orm>();
export const ORM_INSTANCES_CACHE: DeferredMap<OrmRef, Orm> = new DeferredMap<OrmRef, Orm>();
