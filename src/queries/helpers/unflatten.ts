export function unflatten(item: any): Object {
	if (item == null) {
		return item;
	}

	if (Array.isArray(item)) {
		// in-place map
		item.forEach((value, i) => {
			item[i] = unflatten(value);
		});
		return item;
	}

	if (typeof item !== "object" || item.constructor !== Object) {
		return item;
	}

	return Object.keys(item).filter((key) => {
		return !~key.indexOf(".__") && key.indexOf("__") !== 0;
	}).reduce((memo, key) => {
		let value: any = unflatten(item[key]);
		key.split(".").reduce((inner, piece, i, pieces) => {
			if (inner[piece] === undefined) {
				inner[piece] = {};
			}
			if (i === pieces.length - 1) {
				inner[piece] = value;
			}
			return inner[piece];
		}, memo);
		return memo;
	}, {});
}
