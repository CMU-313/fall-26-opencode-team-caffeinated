import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260914021845_add_legacy_experience_mode",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`session_preference\` (
          \`id\` integer PRIMARY KEY,
          \`experience_mode\` text DEFAULT 'intermediate' NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(`ALTER TABLE \`session\` ADD \`experience_mode\` text DEFAULT 'intermediate' NOT NULL;`)
    })
  },
} satisfies DatabaseMigration.Migration
