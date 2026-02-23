import Handlebars from 'handlebars';

Handlebars.registerHelper('eq',  (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper('ne',  (a: unknown, b: unknown) => a !== b);
Handlebars.registerHelper('and', (a: unknown, b: unknown) => !!(a && b));
Handlebars.registerHelper('or',  (a: unknown, b: unknown) => !!(a || b));
Handlebars.registerHelper('not', (a: unknown) => !a);
Handlebars.registerHelper('gt',  (a: unknown, b: unknown) => (a as number) > (b as number));
Handlebars.registerHelper('lt',  (a: unknown, b: unknown) => (a as number) < (b as number));

/**
 * Render a Handlebars template string with the given context.
 * - strict: false — missing vars render as empty string, never throw
 * - noEscape: true — inputs are plain strings (YAML/JSON), not HTML
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  const compiled = Handlebars.compile(template, { strict: false, noEscape: true });
  return compiled(context);
}

/**
 * Recursively walk an arbitrary value and render all string leaves as
 * Handlebars templates. Numbers, booleans and null pass through unchanged.
 */
export function renderObjectDeep(
  obj: unknown,
  context: Record<string, unknown>,
): unknown {
  if (typeof obj === 'string') return renderTemplate(obj, context);
  if (Array.isArray(obj)) return obj.map((item) => renderObjectDeep(item, context));
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = renderObjectDeep(value, context);
    }
    return result;
  }
  return obj;
}

export type StepOutputMap = Record<string, { outputs: Record<string, unknown> }>;

/**
 * Build the Handlebars context for a step's input resolution.
 * Merges userInputs at the top level with step outputs under `steps.*`.
 *
 * Gives templates access to:
 *   {{name}}                                (user input)
 *   {{steps.create-repo.outputs.repoUrl}}  (prior step output)
 */
export function buildStepContext(
  userInputs: Record<string, unknown>,
  stepOutputs: StepOutputMap,
): Record<string, unknown> {
  return { ...userInputs, steps: stepOutputs };
}
