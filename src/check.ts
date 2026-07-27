import { Config } from './config.js';
import type { CustomMetadata } from './decomposedRequest.js';
import {
  customMetadataFromEnvironment,
  resolveConfigPath,
  useBuiltinSchemas as useBuiltinSchemasFromEnvironment,
} from './environment.js';

/**
 * `customMetadata` is arbitrary caller-supplied metadata exposed to schemas and
 * hooks as the `customMetadata` property of the decomposed request. It defaults
 * to the DETENT_CUSTOM_METADATA environment variable, if set.
 */
export async function check(
  request: Request,
  configPath?: string,
  useBuiltinSchemas = useBuiltinSchemasFromEnvironment(),
  customMetadata: CustomMetadata | undefined = customMetadataFromEnvironment()
): Promise<boolean> {
  const resolvedPath = resolveConfigPath(configPath);
  const config = new Config(resolvedPath, !useBuiltinSchemas);
  return config.check(request, customMetadata);
}
