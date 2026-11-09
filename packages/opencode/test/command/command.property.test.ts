import { describe, expect, test } from "bun:test"
import * as fc from "fast-check"
import { Command } from "../../src/command"

fc.configureGlobal({ seed: 42 })

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
        fc.array(fc.string({ minLength: 1 }).filter((value) => !/\s|["']/.test(value)), { minLength: 2, maxLength: 5 }),
        (args) => {
          const result = Command.resolve("first=$1 rest=$2", args.join(" "))

          expect(result).toBe(`first=${args[0]} rest=${args.slice(1).join(" ")}`)
        },
      ),
    )

    fc.assert(
      fc.property(
        fc.record({
          first: fc.string({ minLength: 1 }).filter((value) => !/\s|["']/.test(value)),
          second: fc.string({ minLength: 1 }).filter((value) => !/\s|["']/.test(value)),
          quoted: fc.string({ minLength: 2 }).filter((value) => !/["'\r\n]/.test(value)),
        }),
        ({ first, second, quoted }) => {
          for (const quote of ['"', "'"]) {
            expect(Command.resolve("first=$1 rest=$2", `${quote}${quoted}${quote} ${first} ${second}`)).toBe(
              `first=${quoted} rest=${first} ${second}`,
            )
          }
        },
      ),
    )

    fc.assert(
      fc.property(fc.string({ minLength: 1 }).filter((value) => !/[\s"'\r\n]/.test(value)), (value) => {
        expect(Command.resolve("value=$1", `"${value}'"`)).toBe(`value=${value}'`)
        expect(Command.resolve("value=$1", `'${value}"'`)).toBe(`value=${value}"`)
      }),
    )

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), fc.integer({ min: 1, max: 3 }), (imageNumber, spaces) => {
        expect(Command.resolve("image=$1", `[Image${" ".repeat(spaces)}${imageNumber}]`)).toBe(
          `image=[Image${" ".repeat(spaces)}${imageNumber}]`,
        )
      }),
    )

    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }).filter((value) => !/\s|["']/.test(value)), { minLength: 10, maxLength: 12 }),
        (args) => {
          expect(Command.resolve("tenth=$10", args.join(" "))).toBe(`tenth=${args.slice(9).join(" ")}`)
        },
      ),
    )

    fc.assert(
      fc.property(
        fc.string().filter((value) => !/\r|\n/.test(value)),
        (input) => {
          expect(Command.resolve("all=$ARGUMENTS", input)).toBe(`all=${input}`)
        },
      ),
    )

    fc.assert(
      fc.property(fc.constantFrom("", " ", "  "), (input) => {
        expect(Command.resolve("plain template", input)).toBe("plain template")
        expect(Command.resolve("missing=$1", input)).toBe("missing=")
      }),
    )

    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(Command.resolve("$ARGUMENTS", input)).toBe(input)
      }),
    )

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((value) => !/\s/.test(value)),
        (input) => {
          expect(Command.resolve("use the supplied input", input)).toBe(`use the supplied input\n\n${input}`)
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
        expect(Command.hints(`${prefix} $1 ${suffix} $1 $2`)).toEqual(["$1", "$2"])
      }),
    )

    fc.assert(
      fc.property(unrelatedText, unrelatedText, (prefix, suffix) => {
        expect(Command.hints(`${prefix} $10 ${suffix} $2 $ARGUMENTS $10`)).toEqual(["$10", "$2", "$ARGUMENTS"])
      }),
    )

    fc.assert(
      fc.property(unrelatedText, unrelatedText, (prefix, suffix) => {
        expect(Command.hints(`${prefix} $2 ${suffix} $10 $1`)).toEqual(["$1", "$10", "$2"])
      }),
    )

    fc.assert(
      fc.property(unrelatedText, unrelatedText, (prefix, suffix) => {
        expect(Command.hints(`${prefix}$ARGUMENTS${suffix}`)).toEqual(["$ARGUMENTS"])
      }),
    )
  })

  // R4: A configured command's displayed metadata is the metadata supplied by its configuration.
  // Kind: round-trip. Generated metadata is passed through the public command schema and read back.
  test("R4: configured descriptions remain consistent with command metadata", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string(), (name, description) => {
        const command = Command.configured(name, {
          description,
          template: "",
        })

        expect(command).toMatchObject({ name, description, source: "command" })
      }),
    )
  })
})
