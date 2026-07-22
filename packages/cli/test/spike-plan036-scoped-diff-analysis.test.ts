/**
 * THROWAWAY SPIKE — Plan 036 (docs/superpowers/specs/2026-07-13-scoped-diff-analysis-design.md).
 *
 * This file is a disposable feasibility check, not a permanent regression test.
 * It exists to answer one question with real evidence instead of intuition:
 * "if `--diff`/`--staged` only walked the layout chain of *changed* routes
 * instead of every route, would results stay correct?"
 *
 * It is NOT wired into any production code path and should NOT be treated as
 * part of the maintained test suite — the reviewer of Plan 036 should delete
 * this file (or the commit that adds it) once the design doc has captured its
 * findings, unless a follow-up implementation plan decides to build on it.
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, defaultProject, type RuleContext } from '@svelte-vitals/core';
import { collectLayouts, collectRoutes, chainFiles } from '../src/providers/source/routes.js';
import { enumerateRoutePages } from '../src/providers/source/project.js';
import { seoTitlePresence } from '@svelte-vitals/core';
import { seoDuplicateTitle } from '@svelte-vitals/core';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

/**
 * Reverse-lookup prototype: which pages have `changedFileRel` in their layout
 * chain? This is the "affected routes" primitive a real implementation would
 * need for --diff/--staged to skip resolving untouched routes.
 */
async function affectedPages(changedFileRel: string, pages: string[], layouts: Map<string, string>): Promise<string[]> {
  return pages.filter((page) => chainFiles(page, layouts).some((f) => f.rel === changedFileRel));
}

function ctxFor(heads: Awaited<ReturnType<typeof collectRoutes>>['heads']): RuleContext {
  return { heads, project: defaultProject, config: defaultConfig };
}

describe('[SPIKE, plan 036] scoped diff analysis feasibility', () => {
  it('reverse-lookup finds only the leaf page for a changed leaf file, but every page for a changed shared layout', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<slot />`,
      'src/routes/a/+page.svelte': `<svelte:head><title>A</title></svelte:head>`,
      'src/routes/b/+page.svelte': `<svelte:head><title>B</title></svelte:head>`,
      'src/routes/c/+page.svelte': `<svelte:head><title>C</title></svelte:head>`
    });
    const pages = await enumerateRoutePages(rt, '');
    const layouts = await collectLayouts(rt, '');

    // A change to a's own page file only affects /a.
    expect(await affectedPages('src/routes/a/+page.svelte', pages, layouts)).toEqual(['src/routes/a/+page.svelte']);

    // A change to the shared root layout affects every route — no savings for
    // the (very common) case of editing a root/near-root layout.
    const affectedByLayout = await affectedPages('src/routes/+layout.svelte', pages, layouts);
    expect(new Set(affectedByLayout)).toEqual(new Set(pages));
  });

  it('a route-independent rule (seo/title-presence) gives an identical verdict whether or not sibling routes are included', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<slot />`,
      'src/routes/a/+page.svelte': `<svelte:head><title>Title A</title></svelte:head>`,
      'src/routes/b/+page.svelte': `<svelte:head><title>Title B</title></svelte:head>`,
      'src/routes/c/+page.svelte': `<slot />` // no <title> — seo/title-presence should flag this one
    });

    // "Full" run: every route resolved.
    const full = await collectRoutes(rt, '');
    const fullResults = await seoTitlePresence.check(ctxFor(full.heads));

    // "Scoped" run: simulate only walking the affected route's chain by
    // filtering the resolved heads down to /c before handing them to the rule
    // (a real implementation would avoid resolving /a and /b at all — this
    // spike doesn't refactor collectRoutes to prove that; it isolates the
    // *correctness* question: does the rule's verdict for /c change?).
    const scopedHeads = full.heads.filter((h) => h.route === '/c');
    const scopedResults = await seoTitlePresence.check(ctxFor(scopedHeads));

    const fullForC = fullResults.find((r) => r.route === '/c');
    const scopedForC = scopedResults.find((r) => r.route === '/c');
    expect(scopedForC).toEqual(fullForC);
    expect(fullForC?.detection.presence).toBe('none'); // confirms seo/title-presence did flag /c as missing
  });

  it('DANGER CASE — a cross-route rule (seo/duplicate-title duplicate title) silently under-reports when scoped to only the changed route', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<slot />`,
      'src/routes/a/+page.svelte': `<svelte:head><title>Same Title</title></svelte:head>`,
      'src/routes/b/+page.svelte': `<svelte:head><title>Same Title</title></svelte:head>`, // duplicate of /a
      'src/routes/c/+page.svelte': `<svelte:head><title>Unique Title</title></svelte:head>`
    });

    const full = await collectRoutes(rt, '');
    const fullResults = await seoDuplicateTitle.check(ctxFor(full.heads));
    const fullForA = fullResults.find((r) => r.route === '/a')!;
    // Ground truth: analyzing the whole project correctly flags /a as a duplicate of /b.
    expect(fullForA.detection).toEqual({ presence: 'none', value: 'absent' }); // PENALIZED sentinel (see detection.ts)
    expect(fullForA.message).toMatch(/duplicated across 2 routes/);

    // Only /a changed (--diff touched src/routes/a/+page.svelte) — a naive
    // "resolve only the affected route's chain" scoping would hand the rule
    // only /a's head, with /b invisible.
    const scopedHeads = full.heads.filter((h) => h.route === '/a');
    const scopedResults = await seoDuplicateTitle.check(ctxFor(scopedHeads));
    const scopedForA = scopedResults.find((r) => r.route === '/a')!;

    // The scoped run does NOT see the duplicate — this is exactly the "silent
    // inaccuracy" the design doc warns about. A PR that introduces a second
    // route duplicating an untouched route's title would incorrectly pass.
    expect(scopedForA.detection).toEqual({ presence: 'own', value: 'static' }); // PASS sentinel
    expect(scopedForA.message).toBe('Unique title');
    expect(scopedForA).not.toEqual(fullForA);
  });
});
