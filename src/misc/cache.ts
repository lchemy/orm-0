import { Orm } from "../core";
import { DeferredMap } from "./deferred-map";

export const ORM_INSTANCES_CACHE: DeferredMap<string | symbol, Orm> = new DeferredMap<string | symbol, Orm>();
export const ORM_CLASSES_CACHE: DeferredMap<string | symbol, typeof Orm> = new DeferredMap<string | symbol, Orm>();
