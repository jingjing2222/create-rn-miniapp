# scaffold-templates

`create-miniapp`가 공식 scaffold 결과물 위에 덧씌우는 generic 템플릿 저장소입니다.

## Contents
- `root/package.json`
- `root/pnpm-workspace.yaml`
- `root/pnpm.gitignore`
- `root/pnpm.biome.json`
- `root/yarn.gitignore`
- `root/yarn.biome.json`
- `root/yarnrc.yml`
- `root/nx.json`
- `root/tsconfig.base.json`
- `root/*.project.json`
- `base/AGENTS.md`
- `base/docs/ai/*`
- `base/docs/product/기능명세서.md`

## Non-goals
- Granite app source template를 들고 있지 않음
- Vite app source template를 들고 있지 않음
- Supabase project source template를 들고 있지 않음

공식 CLI가 생성한 결과물에 문서/하네스/기본 규칙만 overlay 하는 용도입니다.
또한 generated repo 루트에서 공통으로 필요한 package manager + `nx` + `biome` 설정도 여기서 제공합니다.
