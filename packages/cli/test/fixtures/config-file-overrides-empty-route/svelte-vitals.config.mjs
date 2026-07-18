/** An empty route glob compiles to a never-matching pattern — reject it. */
export default {
  overrides: [{ route: '', rules: { SEO001: 'off' } }]
};
