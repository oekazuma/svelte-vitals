/**
 * Fixture for the examined-counts spec (2026-08-07): `parts` is permitted only under a
 * capitalised unit, so `Card/parts` is permitted and `other/parts` and `legacy/parts` are
 * violations — three `parts/` directories judged, two of them findings.
 */
export default {
  rules: {
    'architecture/reserved-name-placement': {
      options: { capitalisedUnitPlacements: { parts: 'src/**' } }
    }
  }
};
