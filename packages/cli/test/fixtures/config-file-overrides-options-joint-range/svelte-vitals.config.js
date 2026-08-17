/**
 * Neither overrides[] entry is inverted checked alone against the built-in
 * defaults: overrides[0] only sets `max: 200` (built-in min 30 <= 200), and
 * overrides[1] only sets `min: 100` (100 <= built-in max 60 would actually
 * be inverted alone — but overrides[0] is the entry that could widen `max`
 * at a shared target, so the resolved range 100–200 is valid wherever both
 * apply). Both entries could co-apply at a target under src/routes/ whose
 * route is /landing, so validating overrides[1] against the built-in max
 * (60) alone falsely rejects a config that is valid at every target (design
 * 2026-07-26 review, Finding A, third pass).
 */
export default {
  overrides: [
    { files: 'src/routes/**', rules: { 'seo/title-length': { options: { max: 200 } } } },
    { route: '/landing', rules: { 'seo/title-length': { options: { min: 100 } } } }
  ]
};
