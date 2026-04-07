import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('code quality', () => {
  it('passes the linter', () => {
    const result = execSync('npm run lint', { encoding: 'utf-8' });
    expect(result).toBeDefined();
  });

  it('passes the formatter', () => {
    const result = execSync('npx prettier --check "src/**/*.ts" "tests/**/*.ts"', {
      encoding: 'utf-8',
    });
    expect(result).toBeDefined();
  });
});
