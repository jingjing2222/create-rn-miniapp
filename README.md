# create-miniapp

`create-miniapp`은 AppInToss MiniApp용 `frontend`, optional `server`, optional `backoffice`
를 한 번에 오케스트레이션하는 CLI 저장소입니다.

이 저장소는 생성 결과물 source template를 들고 있지 않습니다. 실제 앱 코드는 공식 CLI가 만들고,
이 도구는 루트 monorepo 설정과 하네스 문서만 overlay 합니다.

## Source Of Truth

- frontend: [AppInToss React Native Tutorial](https://developers-apps-in-toss.toss.im/tutorials/react-native.html)
- server: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- backoffice: [Vite Getting Started](https://vite.dev/guide/)

## Generated Output

```text
<appName>/
  frontend/
  backoffice/    # optional
  server/        # optional
  docs/
  AGENTS.md
  package.json
  nx.json
  pnpm-workspace.yaml
  biome.json
  tsconfig.base.json
```

## Generated Monorepo Rules

- 루트는 `pnpm + nx + biome`
- 내부 워크스페이스는 자체 lint/format 설정을 들지 않음
- `frontend`는 AppInToss React Native 튜토리얼 순서대로 생성
- `server`는 `supabase init` 기준으로 생성
- `backoffice`는 `create-vite --template react-ts --no-interactive` 기준으로 생성
- 생성이 끝나면 루트 `biome check --write --unsafe`로 전체 monorepo를 정리

## Usage

퍼블릭 배포 후:

```bash
pnpm create rn-miniapp
```

로컬 개발 중:

```bash
pnpm --filter create-rn-miniapp exec tsx src/index.ts
```

예시:

```bash
pnpm --filter create-rn-miniapp exec tsx src/index.ts \
  --name my-miniapp \
  --display-name "내 미니앱" \
  --with-server \
  --with-backoffice
```

## Tool Workspace

```text
packages/create-rn-miniapp/
packages/scaffold-templates/
docs/
```

## Verify

```bash
pnpm install
pnpm verify
```

## Release

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

`pnpm version-packages`는 `changeset version` 뒤에 루트 `pnpm format`까지 같이 실행해서
release PR에서 Biome 포맷 차이로 CI가 깨지지 않게 유지합니다.

GitHub Actions:
- PR / `main` / `codex/**` push: `Verify` 워크플로에서 `pnpm verify`
- `main` push: `Release` 워크플로에서 Changesets가 릴리스 PR 생성 또는 npm publish 수행
- npm publish는 저장소 secret `NPM_TOKEN`을 사용

공개 npm 패키지:
- `create-rn-miniapp`
- `@create-rn-miniapp/scaffold-templates`
