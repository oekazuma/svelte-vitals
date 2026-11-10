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
let buildStderr = '';

const titleIssues = (report: JsonReport, route: string) =>
  report.routes.find((r) => r.route === route)?.issues.filter((i) => i.id === 'seo/title-presence');

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
    // The plugin's gate fails the build on /untitled's critical finding, after writing the report.
    buildStderr = (e as { stderr?: string }).stderr ?? '';
    if (!buildStderr.includes('svelte-vitals: build failed')) throw e;
  }
  if (!existsSync(reportPath)) throw new Error(`no ${reportPath} after vite build`);
  buildReport = JSON.parse(readFileSync(reportPath, 'utf8'));
}, 240_000);

describe('sveltekit-3 e2e', () => {
  it('static: reaches the head behind the #lib import on /', () => {
    expect(staticReport.routes.map((r) => r.route)).toContain('/');
    expect(titleIssues(staticReport, '/')).toEqual([]);
    expect(staticReport.rules['seo/title-presence']!.passed).toBeGreaterThan(0);
    expect(
      Object.values(staticReport.skipped ?? {})
        .flat()
        .map((s) => s.route)
    ).not.toContain('/');
  });

  it('static: follows an alias declared in the sveltekit() options', () => {
    expect(titleIssues(staticReport, '/via-alias')).toEqual([]);
    expect(
      Object.values(staticReport.skipped ?? {})
        .flat()
        .map((s) => s.route)
    ).not.toContain('/via-alias');
  });

  it('static: reads ssr = dev with dev from $app/env', () => {
    // A kit-module finding is listed under its file, not under the URL.
    const file = staticReport.routes.find((r) => r.route === 'src/routes/dev-ssr/+page.ts');
    expect(file?.issues.map((i) => i.id)).toEqual(['seo/ssr-disabled']);
  });

  it('static: leaves a write to a client in a server directory outside #lib alone', () => {
    const file = staticReport.routes.find((r) => r.route === 'src/routes/kv/+page.server.ts');
    expect(file?.issues.map((i) => i.id) ?? []).not.toContain('security/handler-state-write');
    expect(staticReport.rules['security/handler-state-write']).toMatchObject({ findings: 0 });
  });

  it('build: analyzes the prerendered / from the SvelteKit 3 output', () => {
    expect(buildReport.routes.map((r) => r.route)).toContain('/');
    expect(titleIssues(buildReport, '/')).toEqual([]);
    expect(buildReport.rules['seo/title-presence']!.passed).toBeGreaterThan(0);
  });

  it('build: a critical finding fails vite build', () => {
    expect(titleIssues(buildReport, '/untitled')).toHaveLength(1);
    expect(buildStderr).toContain('svelte-vitals: build failed');
  });

  it('ships hook types that name no @sveltejs/kit type', () => {
    const dts = readFileSync(join(appDir, 'node_modules/@svelte-vitals/vite/dist/hooks/index.d.ts'), 'utf8');
    expect(dts).not.toContain('@sveltejs/kit');
  });
});
