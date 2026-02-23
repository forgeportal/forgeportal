/**
 * Schema-driven input redaction for action runs.
 *
 * Reads `definition.parameters.properties` from the action's JSONB definition
 * and replaces fields marked `secret: true` with `"***"`.
 *
 * This is the first pass in a double-redaction strategy. The second pass
 * uses `redactSecrets` (from @forgeportal/core) for pattern-based coverage.
 */
export function redactActionInput(
  input: Record<string, unknown>,
  definition: Record<string, unknown>,
): Record<string, unknown> {
  const parameters = definition['parameters'] as
    | Record<string, unknown>
    | undefined;
  const properties = (
    parameters?.['properties'] as
      | Record<string, Record<string, unknown>>
      | undefined
  ) ?? {};

  const redacted: Record<string, unknown> = { ...input };

  for (const [key, schema] of Object.entries(properties)) {
    if (schema['secret'] === true && key in redacted) {
      redacted[key] = '***';
    }
  }

  return redacted;
}
