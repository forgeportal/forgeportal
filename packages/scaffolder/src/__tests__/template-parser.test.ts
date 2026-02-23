import { describe, it, expect } from 'vitest';
import { parseTemplateYaml, validateUserInputs } from '../template-parser.js';
import { ValidationError } from '@forgeportal/core';

const VALID_YAML = `
apiVersion: forgeportal/v1
kind: Template
metadata:
  name: test-template
  title: Test Template
  description: A test template
spec:
  parameters:
    - id: name
      title: Name
      type: string
      required: true
  steps:
    - id: create-repo
      action: scm.createRepo@v1
      input:
        repo: "{{name}}"
`;

describe('parseTemplateYaml', () => {
  it('AC1 — valid YAML parses to TemplateDefinition', () => {
    const def = parseTemplateYaml(VALID_YAML);
    expect(def.apiVersion).toBe('forgeportal/v1');
    expect(def.kind).toBe('Template');
    expect(def.metadata.name).toBe('test-template');
    expect(def.spec.steps).toHaveLength(1);
  });

  it('AC1 — wrong apiVersion throws Error', () => {
    const yaml = VALID_YAML.replace('forgeportal/v1', 'backstage.io/v1alpha1');
    expect(() => parseTemplateYaml(yaml)).toThrow('apiVersion must be "forgeportal/v1"');
  });

  it('AC3 — empty spec.steps throws Error', () => {
    const yaml = VALID_YAML.replace(
      /steps:.*$/ms,
      'steps: []',
    );
    expect(() => parseTemplateYaml(yaml)).toThrow('spec.steps must be a non-empty array');
  });
});

describe('validateUserInputs', () => {
  const params = [
    { id: 'name', title: 'Name', type: 'string' as const, required: true, pattern: '^[a-z]+$' },
    { id: 'env',  title: 'Env',  type: 'string' as const, required: true, enum: ['dev', 'prod'] },
    { id: 'note', title: 'Note', type: 'string' as const, required: false },
  ];

  it('AC3 — required param missing throws ValidationError', () => {
    expect(() => validateUserInputs(params, { env: 'dev' }))
      .toThrow(ValidationError);
  });

  it('AC3 — enum violation throws ValidationError', () => {
    expect(() => validateUserInputs(params, { name: 'abc', env: 'staging' }))
      .toThrow(ValidationError);
  });

  it('AC3 — pattern violation throws ValidationError', () => {
    expect(() => validateUserInputs(params, { name: 'ABC', env: 'dev' }))
      .toThrow(ValidationError);
  });

  it('AC3 — all valid inputs do not throw', () => {
    expect(() => validateUserInputs(params, { name: 'abc', env: 'dev' })).not.toThrow();
  });
});
