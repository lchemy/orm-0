import { SortDirection } from "../../core";

export function normalizeSortDirection(dir: string | number | SortDirection): SortDirection {
	if (typeof dir === "string") {
		switch (dir.toLowerCase()) {
			case "d":
			case "desc":
			case "descending":
				return SortDirection.DESCENDING;
			default:
				return SortDirection.ASCENDING;
		}
	}

	if (dir <= 0) {
		return SortDirection.DESCENDING;
	}
	return SortDirection.ASCENDING;
}
