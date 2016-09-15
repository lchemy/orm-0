import { ExistsFilterNode, Filter, NotExistsFilterNode, SubqueryFilterValue } from "./filter";
import { Orm } from "./orm";

export class JoinManyField<J extends Orm, F extends Orm> {
	orm: J;
	fromOrm: F;

	constructor(orm: J, fromOrm: F) {
		this.orm = orm;
		this.fromOrm = fromOrm;
	}

	get path(): string[] {
		return Orm.getProperties(this.orm).path;
	}

	get joinWhere(): Filter {
		return Orm.getProperties(this.orm).join!.on;
	}

	exists(value?: SubqueryFilterValue<J, F>): ExistsFilterNode<J, F> {
		return new ExistsFilterNode(this, value);
	}
	notExists(value?: SubqueryFilterValue<J, F>): NotExistsFilterNode<J, F> {
		return new NotExistsFilterNode(this, value);
	}
}
