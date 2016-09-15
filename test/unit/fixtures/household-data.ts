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
			parent: join.one<PersonOrm>("people").on((me, parent) => {
				return me.parentId.eq(parent.id);
			}),

			children: join.many<PersonOrm>("people", true).on((child, me) => {
				return child.parentId.eq(me.id);
			}),
			pet: join.many<PetOrm>("pets", true).through<PeoplePetsJoinOrm>("people_pets", (pet, peoplePets) => {
				return peoplePets.petId.eq(pet.id);
			}).on((pet, peoplePets, me) => {
				return peoplePets.personId.eq(me.id);
			})
		};
	}),
	define<PetOrm, Object>("pets", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			owners: join.many<PersonOrm>("people", true, false).through<PeoplePetsJoinOrm>("people_pets", (owner, peoplePets) => {
				return peoplePets.petId.eq(owner.id);
			}).on((owner, peoplePets, me) => {
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
