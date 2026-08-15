import { describe, it, expect } from 'vitest';
import { collectProjectFacts } from '../src/providers/source/project.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

describe('collectProjectFacts', () => {
  it('detects static robots.txt and sitemap.xml', async () => {
    const rt = createMemoryRuntime({ 'static/robots.txt': 'x', 'static/sitemap.xml': '<urlset/>' });
    const p = await collectProjectFacts(rt, '');
    expect(p.hasRobotsTxt).toBe(true);
    expect(p.hasSitemap).toBe(true);
  });
  it('detects endpoint-based robots and sitemap', async () => {
    const rt = createMemoryRuntime({
      'src/routes/robots.txt/+server.ts': 'export function GET(){}',
      'src/routes/sitemap.xml/+server.js': 'export function GET(){}'
    });
    const p = await collectProjectFacts(rt, '');
    expect(p.hasRobotsTxt).toBe(true);
    expect(p.hasSitemap).toBe(true);
  });
  it('parses <html lang> from app.html', async () => {
    const present = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': '<html lang="en">' }), '');
    expect(present.htmlLang).toEqual({ presence: 'own', value: 'static' });
    const empty = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': '<html lang="">' }), '');
    expect(empty.htmlLang).toEqual({ presence: 'own', value: 'absent' });
    const none = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': '<html>' }), '');
    expect(none.htmlLang).toEqual({ presence: 'none', value: 'absent' });
    const unquoted = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': '<html lang=en>' }), '');
    expect(unquoted.htmlLang).toEqual({ presence: 'own', value: 'static' });
    const single = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': "<html lang='ja'>" }), '');
    expect(single.htmlLang).toEqual({ presence: 'own', value: 'static' });
  });

  it('detects the leading doctype in app.html', async () => {
    const present = await collectProjectFacts(
      createMemoryRuntime({ 'src/app.html': '<!doctype html>\n<html lang="en">' }),
      ''
    );
    expect(present.appHtmlDoctype).toBe(true);
    const missing = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': '<html lang="en">' }), '');
    expect(missing.appHtmlDoctype).toBe(false);
    const noAppHtml = await collectProjectFacts(createMemoryRuntime({}), '');
    expect(noAppHtml.appHtmlDoctype).toBeUndefined();
  });

  it('detects a doctype behind leading comments in linear time', async () => {
    const withComments = '<!-- a -->\n<!-- b -->\n<!doctype html><html></html>';
    expect((await collectProjectFacts(createMemoryRuntime({ 'src/app.html': withComments }), '')).appHtmlDoctype).toBe(
      true
    );
    // A long run of comments with no doctype must resolve immediately — an ambiguous
    // quantifier over the comment group would be exponential here.
    const hostile = `${'<!-- c -->'.repeat(60)}<html></html>`;
    const start = Date.now();
    const facts = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': hostile }), '');
    expect(facts.appHtmlDoctype).toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('collects literal shell ids from app.html', async () => {
    const rt = createMemoryRuntime({
      'src/app.html': `<body><div id="app" data-id="not-an-id"></div><span id='side'></span><i id={x}></i></body>`
    });
    expect((await collectProjectFacts(rt, '')).appHtmlIds).toEqual(['app', 'side']);
    expect((await collectProjectFacts(createMemoryRuntime({}), '')).appHtmlIds).toBeUndefined();
  });

  it('reads shell ids case-insensitively and ignores comments and script/style bodies', async () => {
    const rt = createMemoryRuntime({
      'src/app.html': [
        `<body><div ID="app"></div>`,
        `<!-- <div id="ghost"></div> -->`,
        `<script>el.id = 'scripted'; frame.setAttribute('id', "js")</script>`,
        `<style>#styled { color: red } [id="attr"] { }</style></body>`
      ].join('\n')
    });
    expect((await collectProjectFacts(rt, '')).appHtmlIds).toEqual(['app']);
  });

  it('collects unquoted shell ids and still skips templating placeholders', async () => {
    const rt = createMemoryRuntime({ 'src/app.html': `<body><div id=app></div><i id={x}></i></body>` });
    expect((await collectProjectFacts(rt, '')).appHtmlIds).toEqual(['app']);
  });

  it('detects build.minify: false in the Vite config', async () => {
    const rt = createMemoryRuntime({
      'vite.config.ts': `export default {\n  build: {\n    minify: false\n  }\n};\n`
    });
    const p = await collectProjectFacts(rt, '');
    expect(p.viteMinifyDisabled).toEqual({ file: 'vite.config.ts', line: 3 });
  });

  it('leaves the fact unset for a clean or absent Vite config', async () => {
    const clean = await collectProjectFacts(
      createMemoryRuntime({ 'vite.config.ts': `export default { build: { minify: 'terser' } };\n` }),
      ''
    );
    expect(clean.viteMinifyDisabled).toBeUndefined();
    const absent = await collectProjectFacts(createMemoryRuntime({}), '');
    expect(absent.viteMinifyDisabled).toBeUndefined();
  });

  it("analyzes only the first config in Vite's resolution order", async () => {
    // Vite loads vite.config.js before vite.config.ts — the stale .ts must be ignored.
    const rt = createMemoryRuntime({
      'vite.config.js': `export default { build: {} };\n`,
      'vite.config.ts': `export default { build: { minify: false } };\n`
    });
    const p = await collectProjectFacts(rt, '');
    expect(p.viteMinifyDisabled).toBeUndefined();
  });
});
