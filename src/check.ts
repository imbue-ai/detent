import { DetentConfig } from './detentConfig.js';

const DEFAULT_CONFIG_PATH = '~/.config/detent/config.json';

function resolveHomePath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
    return filePath.replace('~', home);
  }
  return filePath;
}

export async function check(request: Request, configPath?: string): Promise<boolean> {
  const resolvedPath = resolveHomePath(configPath ?? DEFAULT_CONFIG_PATH);
  // eslint-disable-next-line @typescript-eslint/dot-notation
  const doNotUseBuiltinPatterns = (process.env['DETENT_DO_NOT_USE_BUILTIN_PATTERNS'] ?? '') !== '';
  const config = new DetentConfig(resolvedPath, doNotUseBuiltinPatterns);
  return config.check(request);
}
