"use strict";

const fs = require("fs"),
	path = require("path");

let pkgFn = path.resolve(__dirname + path.sep + "../package.json"),
	pkg = JSON.parse(fs.readFileSync(pkgFn, "utf8"));

delete pkg.scripts;
delete pkg.devDependencies;

pkg.main = "index.js";
pkg.types = "index.d.ts";

let outPkgFn = path.resolve(__dirname + path.sep + "../dist/package.json"),
	pkgJson = JSON.stringify(pkg, null, 2) + "\n";

fs.writeFileSync(outPkgFn, pkgJson, "utf8");
