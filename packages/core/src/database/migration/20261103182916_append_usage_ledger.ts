import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261103182916_append_usage_ledger",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`session_message_ledger\` (
          \`message_id\` text PRIMARY KEY,
          \`session_id\` text NOT NULL,
          \`project_id\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          \`role\` text NOT NULL,
          \`provider_id\` text,
          \`model_id\` text
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`session_usage_ledger\` (
          \`part_id\` text PRIMARY KEY,
          \`session_id\` text NOT NULL,
          \`project_id\` text NOT NULL,
          \`message_id\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          \`provider_id\` text,
          \`model_id\` text,
          \`cost\` real NOT NULL,
          \`tokens_input\` integer NOT NULL,
          \`tokens_output\` integer NOT NULL,
          \`tokens_reasoning\` integer NOT NULL,
          \`tokens_cache_read\` integer NOT NULL,
          \`tokens_cache_write\` integer NOT NULL
        );
      `)
      yield* tx.run(
        `CREATE INDEX \`session_message_ledger_project_time_idx\` ON \`session_message_ledger\` (\`project_id\`,\`time_created\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`session_message_ledger_model_idx\` ON \`session_message_ledger\` (\`provider_id\`,\`model_id\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`session_usage_ledger_project_time_idx\` ON \`session_usage_ledger\` (\`project_id\`,\`time_created\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`session_usage_ledger_model_idx\` ON \`session_usage_ledger\` (\`provider_id\`,\`model_id\`);`,
      )
      yield* tx.run(`
        INSERT INTO \`session_message_ledger\`
          (\`message_id\`, \`session_id\`, \`project_id\`, \`time_created\`, \`role\`, \`provider_id\`, \`model_id\`)
        SELECT
          message.\`id\`,
          message.\`session_id\`,
          session.\`project_id\`,
          message.\`time_created\`,
          json_extract(message.\`data\`, '$.role'),
          json_extract(message.\`data\`, '$.providerID'),
          json_extract(message.\`data\`, '$.modelID')
        FROM \`message\` AS message
        JOIN \`session\` AS session ON session.\`id\` = message.\`session_id\`;
      `)
      yield* tx.run(`
        INSERT INTO \`session_usage_ledger\`
          (
            \`part_id\`,
            \`session_id\`,
            \`project_id\`,
            \`message_id\`,
            \`time_created\`,
            \`provider_id\`,
            \`model_id\`,
            \`cost\`,
            \`tokens_input\`,
            \`tokens_output\`,
            \`tokens_reasoning\`,
            \`tokens_cache_read\`,
            \`tokens_cache_write\`
          )
        SELECT
          part.\`id\`,
          part.\`session_id\`,
          session.\`project_id\`,
          part.\`message_id\`,
          part.\`time_created\`,
          json_extract(message.\`data\`, '$.providerID'),
          json_extract(message.\`data\`, '$.modelID'),
          coalesce(json_extract(part.\`data\`, '$.cost'), 0),
          coalesce(json_extract(part.\`data\`, '$.tokens.input'), 0),
          coalesce(json_extract(part.\`data\`, '$.tokens.output'), 0),
          coalesce(json_extract(part.\`data\`, '$.tokens.reasoning'), 0),
          coalesce(json_extract(part.\`data\`, '$.tokens.cache.read'), 0),
          coalesce(json_extract(part.\`data\`, '$.tokens.cache.write'), 0)
        FROM \`part\` AS part
        JOIN \`session\` AS session ON session.\`id\` = part.\`session_id\`
        JOIN \`message\` AS message ON message.\`id\` = part.\`message_id\`
        WHERE json_extract(part.\`data\`, '$.type') = 'step-finish';
      `)
    })
  },
} satisfies DatabaseMigration.Migration
