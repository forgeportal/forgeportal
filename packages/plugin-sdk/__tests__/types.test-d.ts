import { describe, it, expectTypeOf } from 'vitest';
import type {
  ForgePluginSDK,
  ActionProvider,
  ActionContext,
  ActionResult,
  PluginManifest,
} from '../src/types.js';

describe('ForgePluginSDK interface', () => {
  it('has all registration methods', () => {
    type Methods = keyof ForgePluginSDK;
    expectTypeOf<'registerEntityTab'>().toMatchTypeOf<Methods>();
    expectTypeOf<'registerEntityCard'>().toMatchTypeOf<Methods>();
    expectTypeOf<'registerRoute'>().toMatchTypeOf<Methods>();
    expectTypeOf<'registerActionProvider'>().toMatchTypeOf<Methods>();
    expectTypeOf<'registerCatalogProvider'>().toMatchTypeOf<Methods>();
  });
});

describe('ActionResult interface', () => {
  it('requires status and outputs', () => {
    type Keys = keyof ActionResult;
    expectTypeOf<'status'>().toMatchTypeOf<Keys>();
    expectTypeOf<'outputs'>().toMatchTypeOf<Keys>();
  });

  it('status is a union of success | failed', () => {
    expectTypeOf<ActionResult['status']>().toEqualTypeOf<'success' | 'failed'>();
  });
});

describe('ActionContext interface', () => {
  it('exposes all required service accessors', () => {
    type Keys = keyof ActionContext;
    expectTypeOf<'config'>().toMatchTypeOf<Keys>();
    expectTypeOf<'logger'>().toMatchTypeOf<Keys>();
    expectTypeOf<'scm'>().toMatchTypeOf<Keys>();
    expectTypeOf<'db'>().toMatchTypeOf<Keys>();
    expectTypeOf<'acquireRepoLock'>().toMatchTypeOf<Keys>();
    expectTypeOf<'log'>().toMatchTypeOf<Keys>();
  });

  it('acquireRepoLock takes a string and returns Promise<void>', () => {
    expectTypeOf<ActionContext['acquireRepoLock']>().toEqualTypeOf<(repoUrl: string) => Promise<void>>();
  });
});

describe('PluginManifest interface', () => {
  it('forgeportal.type is a union of plugin types', () => {
    expectTypeOf<PluginManifest['forgeportal']['type']>().toEqualTypeOf<'ui' | 'backend' | 'fullstack'>();
  });
});

describe('ActionProvider interface', () => {
  it('handler returns Promise<ActionResult>', () => {
    type HandlerReturn = ReturnType<ActionProvider['handler']>;
    expectTypeOf<HandlerReturn>().toEqualTypeOf<Promise<ActionResult>>();
  });
});
