# scaffold-templates

`create-miniapp`가 공식 scaffold 결과물 위에 덧씌우는 generic 템플릿 저장소예요.

## Contents
- `root/package.json`
- `root/pnpm-workspace.yaml`
- `root/pnpm.gitignore`
- `root/pnpm.biome.json`
- `root/yarn.gitignore`
- `root/yarn.biome.json`
- `root/yarnrc.yml`
- `root/nx.json`
- `root/*.project.json`
- `base/CLAUDE.md`
- `base/.github/copilot-instructions.md`
- `base/docs/ai/*`
- `base/docs/engineering/repo-contract.md`
- `base/docs/product/기능명세서.md`
- `optional/*`
  - backoffice, server provider처럼 선택된 워크스페이스에만 복사하는 문서 템플릿

## Non-goals
- Granite app source template를 들고 있지 않아요.
- Vite app source template를 들고 있지 않아요.
- Supabase project source template를 들고 있지 않아요.

공식 CLI가 생성한 결과물에 문서, 하네스, 기본 규칙만 overlay 하는 용도예요.
또한 generated repo 루트에서 공통으로 필요한 package manager + `nx` + `biome` 설정도 여기서 제공해요.
