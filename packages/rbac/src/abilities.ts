import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { Role } from "./roles.js";

export function defineAbilityFor(role: Role) {
  const { can, build } = new AbilityBuilder(createMongoAbility);

  if (role === "admin") {
    can("manage", "all");
  } else {
    can("read", "Deal");
    can("read", "CompGroup");
  }

  return build();
}
