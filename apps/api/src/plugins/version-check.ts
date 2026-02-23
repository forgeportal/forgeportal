import semver from 'semver';
import { SDK_VERSION } from '@forgeportal/plugin-sdk';

export interface VersionCheckResult {
  compatible: boolean;
  reason?:    string;
}

/**
 * Checks if the current SDK version satisfies the plugin's declared engineVersion range.
 *
 * @param engineVersion - semver range declared in the plugin manifest, e.g. "^1.0.0"
 */
export function checkEngineVersion(engineVersion: string): VersionCheckResult {
  if (!semver.validRange(engineVersion)) {
    return {
      compatible: false,
      reason:     `Invalid semver range in engineVersion: "${engineVersion}"`,
    };
  }

  if (!semver.satisfies(SDK_VERSION, engineVersion)) {
    return {
      compatible: false,
      reason:
        `Plugin requires SDK ${engineVersion} but installed SDK is ${SDK_VERSION}. ` +
        `Update the plugin or upgrade @forgeportal/plugin-sdk.`,
    };
  }

  return { compatible: true };
}
