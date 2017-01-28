import { Orm, define, field, join } from "../../../src";

export interface PersonOrm extends Orm {
	id: field.primary.Numerical;
	name: field.String;

	parentId: field.Numerical;
	parent: join.One<PersonOrm>;

	children: join.Many<PersonOrm>;
	pets: join.Many<PetOrm>;
}

export interface PetOrm extends Orm {
	id: field.primary.Numerical;
	name: field.String;

	owners: join.Many<PersonOrm>;
}

export interface PeoplePetsJoinOrm extends Orm {
	personId: field.Numerical;
	petId: field.Numerical;
}

export interface AuthUser {
	isAdmin: boolean;
	allowedPetIds?: number[];
	allowedPersonIds?: number[];
}

export interface Definitions {
	personOrm: PersonOrm;
	petOrm: PetOrm;
	peoplePetsJoinOrm: PeoplePetsJoinOrm;
}

export const definitions: Promise<Definitions> = Promise.all([
	define<PersonOrm, AuthUser>("people", (field, join) => {
		return {
			id: field.primary.Numerical("id"),
			name: field.String("name"),

			parentId: field.Numerical("parent_id", false),
			parent: join.One<PersonOrm>("people").on((me, parent) => {
				return me.parentId.eq(parent.id);
			}).withAuth<AuthUser>((auth, _, parent) => {
				if (auth.isAdmin || auth.allowedPersonIds == null) {
					return;
				}
				return parent.id.in(...auth.allowedPersonIds);
			}),

			children: join.Many<PersonOrm>("people", true).on((child, me) => {
				return child.parentId.eq(me.id);
			}).withAuth<AuthUser>((auth, child) => {
				if (auth.isAdmin || auth.allowedPersonIds == null) {
					return;
				}
				return child.id.in(...auth.allowedPersonIds);
			}),
			pet: join.Many<PetOrm>("pets", true).through<PeoplePetsJoinOrm>("people_pets", (pet, peoplePets) => {
				return peoplePets.petId.eq(pet.id);
			}).on((_, peoplePets, me) => {
				return peoplePets.personId.eq(me.id);
			}).withAuth<AuthUser>((auth, pet) => {
				if (auth.isAdmin || auth.allowedPetIds == null) {
					return;
				}
				return pet.id.in(...auth.allowedPetIds);
			})
		};
	}, (auth, orm) => {
		if (auth.isAdmin || auth.allowedPersonIds == null) {
			return;
		}
		return orm.id.in(...auth.allowedPersonIds);
	}),
	define<PetOrm, AuthUser>("pets", (field, join) => {
		return {
			id: field.primary.Numerical("id"),
			name: field.String("name"),

			owners: join.Many<PersonOrm>("people", true).through<PeoplePetsJoinOrm>("people_pets", (owner, peoplePets) => {
				return peoplePets.petId.eq(owner.id);
			}).on((_, peoplePets, me) => {
				return peoplePets.petId.eq(me.id);
			}).withAuth<AuthUser>((auth, owner) => {
				if (auth.isAdmin || auth.allowedPersonIds == null) {
					return;
				}
				return owner.id.in(...auth.allowedPersonIds);
			})
		};
	}, (auth, orm) => {
		if (auth.isAdmin || auth.allowedPetIds == null) {
			return;
		}
		return orm.id.in(...auth.allowedPetIds);
	}),
	define<PeoplePetsJoinOrm>("people_pets", (field) => {
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
