import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(appDir, '..', '..', 'packages', 'cli', 'dist', 'bin.js');
const reportPath = join(appDir, 'svelte-vitals-report.json');

interface JsonReport {
  rules: Record<string, { findings: number; passed: number }>;
  routes: Array<{ route: string; issues: Array<{ id?: string; location?: string }> }>;
  skipped?: Record<string, Array<{ route: string }>>;
}

let staticReport: JsonReport;
let buildReport: JsonReport;

beforeAll(() => {
  try {
    staticReport = JSON.parse(
      execFileSync(process.execPath, [bin, appDir, '--reporter', 'json'], { encoding: 'utf8' })
    );
  } catch (e) {
    const err = e as { status: number | null; stdout: string };
    if (err.status !== 1) throw e;
    staticReport = JSON.parse(err.stdout);
  }
});

beforeAll(() => {
  rmSync(reportPath, { force: true });
  try {
    execFileSync(process.execPath, [join(appDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (e) {
    // The plugin's gate fails the build on a critical finding, after writing the report.
    if (!(e as { stderr?: string }).stderr?.includes('svelte-vitals: build failed')) throw e;
  }
  if (!existsSync(reportPath)) throw new Error(`no ${reportPath} after vite build`);
  buildReport = JSON.parse(readFileSync(reportPath, 'utf8'));
}, 240_000);

describe('sveltekit-3 e2e', () => {
  it('static: reaches the head behind the #lib import on /', () => {
    expect(staticReport.routes.map((r) => r.route)).toContain('/');
    expect(staticReport.rules['seo/title-presence']).toMatchObject({ findings: 0 });
    expect(staticReport.rules['seo/title-presence']!.passed).toBeGreaterThan(0);
    expect(
      Object.values(staticReport.skipped ?? {})
        .flat()
        .map((s) => s.route)
    ).not.toContain('/');
  });

  it('build: analyzes the prerendered / from the SvelteKit 3 output', () => {
    expect(buildReport.routes.map((r) => r.route)).toContain('/');
    expect(buildReport.rules['seo/title-presence']!.passed).toBeGreaterThan(0);
  });

  it('ships hook types that name no @sveltejs/kit type', () => {
    const dts = readFileSync(join(appDir, 'node_modules/@svelte-vitals/vite/dist/hooks/index.d.ts'), 'utf8');
    expect(dts).not.toContain('@sveltejs/kit');
  });
});
