// import { define, field, Orm } from "../../src";

// describe("define", () => {
// 	it("should work", (done) => {
// 		interface FieldOrm extends Orm {
// 			id: field.Numerical;
// 			name: field.String;
// 		}

// 		let promise: Promise<FieldOrm> = define<FieldOrm, Object>("table", (field, join) => {
// 			return {
// 				id: field.Numerical("id"),
// 				name: field.String("name")
// 			};
// 		});

// 		promise.then((orm) => {
// 			expect(orm.id).toBeDefined();
// 			expect(orm.name).toBeDefined();
// 		}).then(done, done.fail);
// 	});
// });
