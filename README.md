# create-rn-miniapp

`create-rn-miniapp`은 AppInToss MiniApp용 모노레포를 한 번에 생성하는 CLI입니다.

- `frontend`: Granite + `@apps-in-toss/framework` 기반 MiniApp
- `server`: optional Supabase workspace
- `backoffice`: optional Vite + React + TypeScript workspace
- 루트: `pnpm + nx + biome` 기준 monorepo 설정과 하네스 문서

## 빠른 시작

대화형으로 생성:

```bash
pnpm create rn-miniapp
```

옵션으로 한 번에 생성:

```bash
pnpm dlx create-rn-miniapp \
  --name my-miniapp \
  --display-name "내 미니앱" \
  --server-provider supabase \
  --with-backoffice
```

생성이 끝나면:

```bash
cd my-miniapp
pnpm verify
```

## 생성되는 구조

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

## CLI 옵션

- `--name`: Granite `appName`이자 생성 디렉터리 이름
- `--display-name`: 사용자에게 보이는 앱 이름
- `--with-server`: `server` 워크스페이스 포함. 현재는 `supabase`로 연결됩니다.
- `--server-provider <supabase>`: `server` 제공자 명시
- `--with-backoffice`: `backoffice` 워크스페이스 포함
- `--output-dir <dir>`: 생성할 모노레포의 상위 디렉터리
- `--skip-install`: 마지막 루트 `pnpm install`과 Biome 정리를 생략
- `--yes`: 선택형 질문을 기본값으로 진행
- `--help`: 도움말 출력
- `--version`: 버전 출력

옵션으로 주지 않은 값은 한국어 프롬프트로 이어집니다.

## Supabase를 같이 만들면

`--with-server` 또는 `--server-provider supabase`를 쓰면 `server/`뿐 아니라 `frontend`와 optional `backoffice`에도 바로 연결할 수 있는 기본 파일을 생성합니다.

`frontend`:
- `.env.local.example`
- `src/env.d.ts`
- `src/lib/supabase.ts`
- `granite.config.ts` env plugin 및 monorepo `watchFolders` patch

`backoffice`:
- `.env.local.example`
- `src/vite-env.d.ts`
- `src/lib/supabase.ts`

생성 후에는 예시 파일을 참고해서 실제 `.env.local`을 채우면 됩니다.

## 생성 기준

- `frontend`: [AppInToss React Native tutorial](https://developers-apps-in-toss.toss.im/tutorials/react-native.html)
- `server`: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- `backoffice`: [Vite](https://vite.dev/guide/)

이 저장소는 앱 소스 전체를 템플릿으로 들고 있지 않습니다. 공식 scaffold 결과에 루트 설정, 문서, 필요한 patch만 적용합니다.

## 로컬 개발

저장소에서 CLI를 직접 테스트하려면:

```bash
pnpm install
pnpm verify
pnpm --filter create-rn-miniapp exec tsx src/index.ts --help
```

실제 스캐폴딩 스모크 테스트:

```bash
pnpm --filter create-rn-miniapp exec tsx src/index.ts \
  --name local-miniapp \
  --display-name "로컬 미니앱" \
  --server-provider supabase \
  --with-backoffice \
  --output-dir /tmp
```
