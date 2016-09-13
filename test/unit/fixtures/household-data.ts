import { Orm, define, field } from "../../../src";

export interface PersonOrm extends Orm {
	id: field.Numerical;
	name: field.String;

	parentId: field.Numerical;
	parent: field.JoinOne<PersonOrm>;

	children: field.JoinMany<PersonOrm>;
	pets: field.JoinMany<PetOrm>;
}

export interface PetOrm extends Orm {
	id: field.Numerical;
	name: field.String;

	owners: field.JoinMany<PersonOrm>;
}

export interface PeoplePetsJoinOrm extends Orm {
	personId: field.Numerical;
	petId: field.Numerical;
}

type Definitions = {
	personOrm: PersonOrm,
	petOrm: PetOrm,
	peoplePetsJoinOrm: PeoplePetsJoinOrm
};
export const definitions: Promise<Definitions> = Promise.all([
	define<PersonOrm, Object>("people", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			parentId: field.Numerical("parent_id", false),
			parent: join.one("people").on((me: PersonOrm, parent: PersonOrm) => {
				return me.parentId.eq(parent.id);
			}),

			children: join.many("people", true).on((child: PersonOrm, me: PersonOrm) => {
				return child.parentId.eq(me.id);
			}),
			pet: join.many("pets", true).through("people_pets", (pet: PetOrm, peoplePets: PeoplePetsJoinOrm) => {
				return peoplePets.petId.eq(pet.id);
			}).on((pet: PetOrm, peoplePets: PeoplePetsJoinOrm, me: PersonOrm) => {
				return peoplePets.personId.eq(me.id);
			})
		};
	}),
	define<PetOrm, Object>("pets", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			owners: join.many("people", true, false).through("people_pets", (owner: PersonOrm, peoplePets: PeoplePetsJoinOrm) => {
				return peoplePets.petId.eq(owner.id);
			}).on((owner: PersonOrm, peoplePets: PeoplePetsJoinOrm, me: PetOrm) => {
				return peoplePets.petId.eq(me.id);
			})
		};
	}),
	define<PeoplePetsJoinOrm, Object>("people_pets", (field, join) => {
		return {
			personId: field.Numerical("person_id"),
			petId: field.Numerical("pet_id")
		};
	})
]).then(([personOrm, petOrm, peoplePetsJoinOrm]) => {
	return {
		personOrm: personOrm,
		petOrm: petOrm,
		peoplePetsJoinOrm: peoplePetsJoinOrm
	};
});
