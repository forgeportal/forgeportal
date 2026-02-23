import yaml from 'js-yaml';
import { ValidationError } from '@forgeportal/core';

export interface TemplateParameter {
  id:           string;
  title:        string;
  type:         'string' | 'boolean' | 'number' | 'array';
  description?: string;
  default?:     unknown;
  enum?:        unknown[];
  pattern?:     string;
  required?:    boolean;
  ui?:          string;
}

export interface TemplateStepFile {
  path:             string;
  templatePath?:    string;   // key into spec.skeletonFiles → rendered with Handlebars
  contentBase64?:   string;   // inline base64 content (no Handlebars)
  templateContent?: string;   // inline Handlebars template string
}

export interface TemplateStep {
  id:      string;
  action:  string;            // e.g., "scm.createRepo@v1"
  input:   Record<string, unknown>;
  if?:     string;            // Handlebars condition: "{{eq provider 'github'}}"
}

export interface TemplateDefinition {
  apiVersion: string;
  kind:       'Template';
  metadata: {
    name:        string;
    title:       string;
    description: string;
    owner?:      string;
    tags?:       string[];
  };
  spec: {
    owner?:         string;
    parameters:     TemplateParameter[];
    steps:          TemplateStep[];
    outputs?:       Record<string, string>;
    skeletonFiles?: Record<string, string>;
  };
}

export function parseTemplateYaml(yamlStr: string): TemplateDefinition {
  const parsed = yaml.load(yamlStr) as Record<string, unknown>;
  if (parsed['apiVersion'] !== 'forgeportal/v1') {
    throw new Error(
      `Invalid template: apiVersion must be "forgeportal/v1", got "${String(parsed['apiVersion'])}"`,
    );
  }
  if (parsed['kind'] !== 'Template') {
    throw new Error(
      `Invalid template: kind must be "Template", got "${String(parsed['kind'])}"`,
    );
  }
  const spec = parsed['spec'] as Record<string, unknown> | undefined;
  if (!spec || !Array.isArray(spec['steps']) || (spec['steps'] as unknown[]).length === 0) {
    throw new Error('Invalid template: spec.steps must be a non-empty array');
  }
  return parsed as unknown as TemplateDefinition;
}

/**
 * Validate user-supplied inputs against the template's parameter schema.
 * Throws `ValidationError` on the first violation found.
 */
export function validateUserInputs(
  params: TemplateParameter[],
  inputs: Record<string, unknown>,
): void {
  for (const param of params) {
    const value = inputs[param.id];
    const missing = value === undefined || value === null || value === '';

    if (param.required && missing) {
      throw new ValidationError(`Missing required parameter: "${param.id}"`);
    }

    if (missing) continue;

    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== param.type) {
      throw new ValidationError(
        `Parameter "${param.id}" must be of type ${param.type}, got ${actualType}`,
      );
    }

    if (param.enum && !param.enum.includes(value)) {
      throw new ValidationError(
        `Parameter "${param.id}" must be one of [${param.enum.map(String).join(', ')}], got "${String(value)}"`,
      );
    }

    if (param.pattern && typeof value === 'string') {
      const re = new RegExp(param.pattern);
      if (!re.test(value)) {
        throw new ValidationError(
          `Parameter "${param.id}" does not match required pattern: ${param.pattern}`,
        );
      }
    }
  }
}
