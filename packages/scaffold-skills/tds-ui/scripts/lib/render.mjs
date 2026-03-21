const REFERENCE_FILES = [
  'references/decision-matrix.md',
  'references/form-patterns.md',
  'references/layout-and-navigation.md',
  'references/feedback-and-loading.md',
  'references/display-patterns.md',
  'references/export-gaps.md',
  'references/policy-summary.md',
]

const RULE_FILES = [
  'rules/catalog-doc-backed-first.md',
  'rules/catalog-export-gap-handling.md',
  'rules/state-controlled-uncontrolled.md',
  'rules/screen-states-loading-error-empty.md',
  'rules/no-rn-primitive-when-tds-exists.md',
  'rules/export-only-gated.md',
  'rules/navbar-import-gap.md',
  'rules/accessibility-interactive-elements.md',
]

const OUTPUT_CONTRACT_LINES = [
  '1. 추천 컴포넌트',
  '2. 선택 이유',
  '3. 가장 가까운 대안과 왜 아닌지',
  '4. controlled / uncontrolled 패턴',
  '5. loading / error / empty / disabled / a11y 체크',
  '6. docs URL + root export module',
  '7. anomaly note 또는 export-only / docs-missing note',
]

const OUTPUT_CONTRACT_ENFORCEMENT_LINES = [
  '- 위 7항 중 하나라도 빠지면 incomplete answer로 간주한다.',
  '- export-only 추천 시에는 반드시 doc-backed fallback도 같이 적는다.',
]

export function renderAgentsMarkdown() {
  return [
    '# tds-ui AGENTS (Generated)',
    '',
    '이 파일은 `metadata.json`, `generated/catalog.json`, `generated/anomalies.json`에서 파생된 generated output이다.',
    '수정은 truth source를 바꾼 뒤 재생성된 결과만 반영한다.',
    '',
    '## Truth Sources',
    '- `metadata.json`',
    '- `generated/catalog.json`',
    '- `generated/anomalies.json`',
    '',
    '## Freshness Hook',
    '- 먼저 `node scripts/ensure-fresh.mjs`를 실행한다.',
    '- `metadata.json.lastVerifiedAt`이 7일을 넘기면 최신 `@toss/tds-react-native`와 Toss Mini Docs 기준으로 refresh를 시도한다.',
    '- refresh 산출물은 저장 전에 catalog/anomaly/metadata 계약 검증을 통과해야 한다.',
    '- refresh가 성공하면 canonical `.agents/skills/tds-ui` snapshot을 갱신하고 `.claude/skills` mirror를 다시 sync한다.',
    '- refresh가 실패하면 warning만 남기고 현재 snapshot으로 계속 진행한다.',
    '',
    '## Human References',
    ...REFERENCE_FILES.map((filePath) => `- \`${filePath}\``),
    '',
    '## Review Rules',
    ...RULE_FILES.map((filePath) => `- \`${filePath}\``),
    '',
    '## Answer Contract',
    ...OUTPUT_CONTRACT_LINES,
    '',
    '## Contract Enforcement',
    ...OUTPUT_CONTRACT_ENFORCEMENT_LINES,
  ].join('\n')
}

export function renderCatalogProjection(catalog, metadata) {
  const clusterOrder = [
    'input-choice',
    'actions-feedback',
    'list-navigation-layout',
    'content-display',
    'guarded-export-only',
    'blocked-by-default',
  ]
  const clusterNotes = {
    'list-navigation-layout': [
      '- anomaly: `navbar` is docs-backed, but use the catalog `rootImportPath`',
      '- anomaly: `stepper-row` docs slug is `stepper`',
    ],
    'content-display': ['- anomaly: `chart` docs slug is `Chart/bar-chart`'],
    'guarded-export-only': [
      '- gate these by default and include a doc-backed fallback in the answer',
    ],
    'blocked-by-default': ['- do not recommend by default'],
  }

  return [
    '# tds-ui Catalog Projection (Generated)',
    '',
    `- package: \`@toss/tds-react-native@${metadata.packageVersion}\``,
    `- last verified: \`${metadata.lastVerifiedAt}\``,
    '- truth source: `generated/catalog.json`',
    `- total components: \`${catalog.length}\``,
    '',
    ...clusterOrder.flatMap((cluster) => {
      const entries = catalog
        .filter((entry) => entry.cluster === cluster)
        .map((entry) => entry.name)

      return [
        `## ${cluster} (${entries.length})`,
        '',
        `- ${entries.map((entry) => `\`${entry}\``).join(', ')}`,
        ...(clusterNotes[cluster] ?? []),
        '',
      ]
    }),
  ]
    .join('\n')
    .trimEnd()
}
