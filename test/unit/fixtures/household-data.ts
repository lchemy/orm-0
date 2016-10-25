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

export interface AuthUser {
	isAdmin: boolean;
	allowedPetIds?: number[];
	allowedPersonIds?: number[];
}

type Definitions = {
	personOrm: PersonOrm,
	petOrm: PetOrm,
	peoplePetsJoinOrm: PeoplePetsJoinOrm
};
export const definitions: Promise<Definitions> = Promise.all([
	define<PersonOrm, Object, AuthUser>("people", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			parentId: field.Numerical("parent_id", false),
			parent: join.one<PersonOrm>("people").on((me, parent) => {
				return me.parentId.eq(parent.id);
			}).withAuth<AuthUser>((auth, me, parent) => {
				if (auth.isAdmin || auth.allowedPersonIds == null) {
					return;
				}
				return parent.id.in(...auth.allowedPersonIds);
			}),

			children: join.many<PersonOrm>("people", true).on((child, me) => {
				return child.parentId.eq(me.id);
			}).withAuth<AuthUser>((auth, child, me) => {
				if (auth.isAdmin || auth.allowedPersonIds == null) {
					return;
				}
				return child.id.in(...auth.allowedPersonIds);
			}),
			pet: join.many<PetOrm>("pets", true).through<PeoplePetsJoinOrm>("people_pets", (pet, peoplePets) => {
				return peoplePets.petId.eq(pet.id);
			}).on((pet, peoplePets, me) => {
				return peoplePets.personId.eq(me.id);
			}).withAuth<AuthUser>((auth, pet, peoplePets, me) => {
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
	define<PetOrm, Object, AuthUser>("pets", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			owners: join.many<PersonOrm>("people", true, false).through<PeoplePetsJoinOrm>("people_pets", (owner, peoplePets) => {
				return peoplePets.petId.eq(owner.id);
			}).on((owner, peoplePets, me) => {
				return peoplePets.petId.eq(me.id);
			}).withAuth<AuthUser>((auth, owner, peoplePets, me) => {
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
