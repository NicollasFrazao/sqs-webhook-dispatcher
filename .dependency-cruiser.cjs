// Layer rules, checked by `npm run check:architecture`. The reasoning is in
// .context/docs/architecture.md, "Layer rules".
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'A cycle makes load order matter and the layers meaningless.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-imports-only-node-builtins',
      severity: 'error',
      comment: 'The domain is pure: no other module of src/, no npm package. Node built-ins (crypto) are allowed.',
      from: { path: '^src/domain/' },
      to: {
        pathNot: '^src/domain/',
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'dispatcher-imports-only-domain',
      severity: 'error',
      comment: 'The batch logic talks to SQS through QueuePort; the AWS SDK and the adapters stay out. Lambda event types are type-only.',
      from: { path: '^src/dispatcher\\.ts$' },
      to: {
        pathNot: [
          '^src/domain/',
          // Type-only import of the Lambda event shapes; see not-to-unresolvable.
          '^aws-lambda$',
        ],
      },
    },
    {
      name: 'adapters-do-not-import-the-entry-point',
      severity: 'error',
      comment: 'src/handler.ts is the composition root: it imports everything, nothing imports it.',
      from: { pathNot: '^src/handler\\.ts$' },
      to: { path: '^src/handler\\.ts$' },
    },
    {
      name: 'src-and-infra-are-separate',
      severity: 'error',
      comment: 'The stack points at src/handler.ts by path for bundling; code never crosses between the runtime and the infrastructure.',
      from: { path: '^src/' },
      to: { path: '^infra/' },
    },
    {
      name: 'infra-does-not-import-src',
      severity: 'error',
      from: { path: '^infra/' },
      to: { path: '^src/' },
    },
    {
      name: 'production-code-does-not-import-tests',
      severity: 'error',
      from: { path: '^(src|infra)/' },
      to: { path: '^test/' },
    },
    {
      name: 'no-dev-dependencies-in-src',
      severity: 'error',
      comment: 'The bundle must not need a devDependency at run time; type-only imports (aws-lambda) are erased.',
      from: { path: '^src/' },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      // `aws-lambda` is a types-only module (@types/aws-lambda, imported with `import type`):
      // there is no runtime package to resolve, and the import is erased from the bundle.
      from: {},
      to: { couldNotResolve: true, pathNot: '^aws-lambda$' },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'A module nothing imports is dead code (entry points excepted).',
      from: {
        orphan: true,
        pathNot: ['^src/handler\\.ts$', '^infra/app\\.ts$', '\\.d\\.ts$'],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.mjs'],
    },
  },
};
