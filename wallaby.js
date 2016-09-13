"use strict";

module.exports = (w) => {
	return {
		files: [
			"src/**/*.ts",
			{ pattern: "test/**/!(*.spec).ts", instrument: false }
		],
		tests: [
			"test/**/*.spec.ts"
		],
		compilers: {
			"**/*.ts": w.compilers.typeScript({
				target: "es5",
				module: "commonjs",
				typescript: require("typescript")
			})
		},
		env: {
			type: "node"
		},
		testFramework: "mocha",
		setup: () => {
			const chai = require("chai"),
				chaiAsPromised = require("chai-as-promised"),
				sinonChai = require("sinon-chai");

			chai.use(chaiAsPromised);
			chai.use(sinonChai);
		}
	}
};
