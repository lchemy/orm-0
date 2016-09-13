export function getObjectAtPath(obj: Object, path: string): Object {
	if (path === "") {
		return obj;
	}
	return Object.keys(obj).filter((key) =>
		key.indexOf(path) === 0
	).reduce((memo, key) => {
		memo[key.substr(path.length + 1)] = obj[key];
		return memo;
	}, {});
}
