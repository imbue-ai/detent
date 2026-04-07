import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const cliPath = new URL("../dist/src/cli.js", import.meta.url).pathname;

describe("CLI", () => {
  it("exits 0 for a valid curl subcommand", async () => {
    const { stdout: _stdout } = await execFileAsync("node", [
      cliPath,
      "curl",
      "https://example.com",
    ]);
    // exit code 0 means allowed (no throw)
  });

  it("exits 2 for curl with no URL", async () => {
    try {
      await execFileAsync("node", [cliPath, "curl"]);
      expect.fail("Should have exited with non-zero");
    } catch (error: unknown) {
      const execError = error as { code: number };
      expect(execError.code).toBe(2);
    }
  });
});
