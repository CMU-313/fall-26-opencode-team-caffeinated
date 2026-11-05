import { describe, expect, test } from "bun:test"
import * as fc from "fast-check"
import { Command } from "../../src/command"

describe("command properties", () => {
  // R1: The command service exposes metadata for every discovered command.
  // Kind: invariant. Generated records cover each supported source and arbitrary names/descriptions.
  test("R1: command metadata preserves its name, source, and description", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1 }),
          description: fc.option(fc.string(), { nil: undefined }),
          source: fc.constantFrom("command" as const, "mcp" as const, "skill" as const),
        }),
        (metadata) => {
          const decoded = Command.Info.make({
            ...metadata,
            template: "",
            hints: [],
          })

          expect(decoded.name).toBe(metadata.name)
          expect(decoded.source).toBe(metadata.source)
          expect(decoded.description).toBe(metadata.description)
        },
      ),
    )
  })

  // R2: Positional arguments are substituted in order and the final placeholder receives remaining arguments.
  // Kind: model/oracle. The generator creates templates with exactly two positional placeholders.
  test("R2: positional arguments are not dropped or reordered", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((value) => !/\s|["']/.test(value)),
        fc.string({ minLength: 1 }).filter((value) => !/\s|["']/.test(value)),
        (first, second) => {
          const result = Command.resolve("first=$1 second=$2", `${first} ${second}`)

          expect(result).toBe(`first=${first} second=${second}`)
        },
      ),
    )
  })

  // R3: Argument hints depend only on placeholders, not unrelated template wording.
  // Kind: metamorphic. The generator changes surrounding text while keeping the placeholder set fixed.
  test("R3: unrelated template text does not change hints", () => {
    const unrelatedText = fc.string().filter((value) => !/\$\d+|\$ARGUMENTS/.test(value))

    fc.assert(
      fc.property(unrelatedText, unrelatedText, (prefix, suffix) => {
        expect(Command.hints(`${prefix} $1 ${suffix} $2`)).toEqual(["$1", "$2"])
      }),
    )
  })

  // R4: A configured command's displayed metadata is the metadata supplied by its configuration.
  // Kind: round-trip. Generated metadata is passed through the public command schema and read back.
  test("R4: configured descriptions remain consistent with command metadata", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string(), (name, description) => {
        const command = Command.Info.make({
          name,
          description,
          source: "command",
          template: "",
          hints: [],
        })

        expect(command).toMatchObject({ name, description, source: "command" })
      }),
    )
  })
})
