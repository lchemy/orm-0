import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinonChai from "sinon-chai";

import { ORM_CLASSES_CACHE, ORM_DEFINITIONS_CACHE, ORM_INSTANCES_CACHE } from "../src/misc/cache";

chai.use(chaiAsPromised);
chai.use(sinonChai);

ORM_CLASSES_CACHE.clear();
ORM_DEFINITIONS_CACHE.clear();
ORM_INSTANCES_CACHE.clear();
