import type { Config, Result } from '../types.js';
import { isPenalized } from '../rule.js';
import { effectiveSeverity } from '../summary.js';
import { docsUrlFor, messageText, ruleMetaById, severityToSarifLevel } from './shared.js';

type SarifLevel = 'error' | 'warning' | 'note';

/**
 * SARIF `artifactLocation.uri` is a URI reference: `#`, `?`, `%`, spaces and non-ASCII in a raw
 * path would be read as fragment/query/escape/invalid and mis-attribute (or drop) the alert in
 * code scanning. `encodeURI` keeps `/` and `+` (both legal in a path, and `+page.svelte` is every
 * SvelteKit route) but leaves `#` and `?` alone, so those two are encoded explicitly.
 */
function toArtifactUri(location: string): string {
  return encodeURI(location).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  helpUri: string;
  defaultConfiguration: { level: SarifLevel };
}

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: SarifLevel;
  message: { text: string };
  locations?: { physicalLocation: { artifactLocation: { uri: string }; region?: { startLine: number } } }[];
  partialFingerprints: Record<string, string>;
}

/** Render penalized findings as a SARIF 2.1.0 log string (issue #18, design slice 5). */
export function formatSarifReport(results: Result[], config: Config, meta: { version: string }): string {
  const penalized = results.filter((r) => isPenalized(r.detection, config.treatDynamicAs));

  const rules: SarifRule[] = [];
  const ruleIndex = new Map<string, number>();

  const sarifResults: SarifResult[] = penalized.map((r) => {
    if (!ruleIndex.has(r.id)) {
      const m = ruleMetaById(r.id);
      const name = m?.title ?? r.id;
      ruleIndex.set(r.id, rules.length);
      rules.push({
        id: r.id,
        name,
        shortDescription: { text: name },
        helpUri: r.docsUrl ?? m?.docsUrl ?? docsUrlFor(r.id),
        defaultConfiguration: { level: severityToSarifLevel(m?.severity ?? r.severity) }
      });
    }
    const result: SarifResult = {
      ruleId: r.id,
      ruleIndex: ruleIndex.get(r.id)!,
      level: severityToSarifLevel(effectiveSeverity(r, config)),
      message: { text: messageText(r) },
      partialFingerprints: {
        'svelteVitals/v1': `${r.id}:${r.route ?? 'project'}${r.line !== undefined ? `:${r.location ?? ''}:${r.line}` : ''}`
      }
    };
    if (r.location) {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: { uri: toArtifactUri(r.location) },
            ...(r.line !== undefined ? { region: { startLine: r.line } } : {})
          }
        }
      ];
    }
    return result;
  });

  const log = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'svelte-vitals',
            informationUri: 'https://oekazuma.github.io/svelte-vitals',
            version: meta.version,
            rules
          }
        },
        results: sarifResults
      }
    ]
  };

  return JSON.stringify(log, null, 2);
}
