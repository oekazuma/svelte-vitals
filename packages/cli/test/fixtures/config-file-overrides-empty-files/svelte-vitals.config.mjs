/** An empty string inside a files array is a never-matching glob — reject it. */
export default {
  overrides: [{ files: [''], rules: { SEO001: 'off' } }]
};
