## 작업명
`create-miniapp` 오케스트레이션 CLI 구현

## 목표
1. Granite miniapp, optional Supabase server, optional Vite backoffice를 공식 CLI로 생성한 뒤 필요한 수정만 자동으로 적용하는 CLI를 만든다.
2. 이 저장소는 생성 결과물 source template를 들고 있지 않고, 하네스/문서 템플릿만 유지한다.
3. 생성이 끝난 대상 워크스페이스에 generic `AGENTS.md`, `docs/ai/*`, `docs/product/기능명세서.md`를 넣어 에이전트 친화적인 상태를 만든다.

## 생성 결과 목표 구조
```text
frontend/
backoffice/
server/
docs/
AGENTS.md
package.json
nx.json
pnpm-workspace.yaml
```

## 도구 저장소 구조
```text
packages/create-rn-miniapp/
packages/scaffold-templates/
docs/
```

## 공식 CLI 기준
1. Granite / AppInToss
   - source of truth: AppInToss React Native 튜토리얼
   - `pnpm create granite-app`
   - `pnpm install`
   - `pnpm install @apps-in-toss/framework`
   - `pnpm ait init`
   - TDS React Native 패키지 설치
2. Vite
   - `pnpm create vite <name> --template react-ts`
3. Supabase
   - `supabase init`
   - 이후 `supabase link`, `supabase db push`, `supabase functions new <name>`

## AppInToss 튜토리얼 기준 고정 항목
1. 앱 이름은 kebab-case
2. `ait init`으로 `granite.config.ts` 생성
3. `appName`은 AppInToss 콘솔의 앱 이름과 동일
4. `appsInToss` plugin의 `brand.displayName`, `primaryColor`, `icon`, `permissions`는 patch 대상
5. 비게임 React Native miniapp은 TDS 사용을 기본값으로 둔다
6. `_app.tsx`는 `AppsInToss.registerApp(...)` 구조를 유지한다

## 핵심 판단
1. miniapp/server/backoffice의 source code는 template로 들고 있지 않는다.
2. 공식 CLI가 만든 결과물에만 후처리 patch를 적용한다.
3. template로 유지하는 것은 하네스 문서와 기본 운영 규칙뿐이다.
4. 따라서 대응 포인트는 "공식 CLI 호출부"와 "후처리 patch" 두 군데다.
5. frontend patch는 Granite 일반 예제가 아니라 AppInToss React Native 튜토리얼 결과물을 기준으로 잡는다.
6. 생성 결과물의 툴체인은 루트 `pnpm + nx + biome`로 고정하고, 내부 워크스페이스는 lint/format 설정을 제거하거나 추가하지 않는다.

## 템플릿 범위
1. `packages/scaffold-templates/root/package.json`
2. `packages/scaffold-templates/root/pnpm-workspace.yaml`
3. `packages/scaffold-templates/root/nx.json`
4. `packages/scaffold-templates/root/biome.json`
5. `packages/scaffold-templates/root/tsconfig.base.json`
6. `packages/scaffold-templates/root/*.project.json`
7. `packages/scaffold-templates/base/AGENTS.md`
8. `packages/scaffold-templates/base/docs/ai/Plan.md`
9. `packages/scaffold-templates/base/docs/ai/Status.md`
10. `packages/scaffold-templates/base/docs/ai/Implement.md`
11. `packages/scaffold-templates/base/docs/ai/Decisions.md`
12. `packages/scaffold-templates/base/docs/ai/Prompt.md`
13. `packages/scaffold-templates/base/docs/product/기능명세서.md`
14. Granite/TDS 참조 안내 문서

## CLI 책임
1. 입력 수집
   - `name`
   - `display-name`
   - `--with-server`
   - `--with-backoffice`
   - `--yes`
   - `--skip-install`
   - `--output-dir`
2. 공식 CLI 실행
   - `frontend/` AppInToss React Native 튜토리얼 순서대로 Granite scaffold
   - `frontend/`에서 `@apps-in-toss/framework` 설치
   - `frontend/`에서 `ait init` 실행
   - `frontend/`에서 TDS 설치/patch 적용
   - optional `server/` Supabase init
   - optional `backoffice/` Vite scaffold
3. 후처리
   - package name / appName / displayName patch
   - 필요한 패키지 설치/추가
   - `packages/scaffold-templates/root/*` 기반으로 root `package.json`, `pnpm-workspace.yaml`, `nx.json`, `biome.json`, `tsconfig.base.json` 생성
   - `packages/scaffold-templates/root/*.project.json` 기반으로 workspace `project.json` 생성
   - 내부 워크스페이스의 lint/formatter 관련 설정 제거
   - 하네스 문서 템플릿 복사

## 현재 구현 상태
1. `packages/create-rn-miniapp`
   - `yargs + @clack/prompts` 입력 수집 완료
   - `appName` 디렉터리 생성 후 그 안에서 스캐폴딩 시작
   - Granite/AppInToss/Supabase/Vite 공식 CLI orchestration 완료
2. `packages/scaffold-templates`
   - root monorepo 설정 템플릿 완료
   - `AGENTS.md`, `docs/ai/*`, `docs/product/기능명세서.md` overlay 완료
3. patch 단계
   - `frontend` AppInToss config patch 완료
   - `backoffice` lint/typecheck 정리 patch 완료
   - `server` wrapper package/project 생성 완료
   - 루트 `biome check --write --unsafe` 자동 실행 완료

## 현재 버그 수정 작업
1. 퍼블릭 npm 배포본에서 `@create-rn-miniapp/scaffold-templates`의 `root/.gitignore`가 tarball에 포함되지 않아 생성이 마지막 overlay 단계에서 실패한다.
2. 재현 절차
   - `pnpm dlx create-rn-miniapp --name smoke-miniapp --display-name "Smoke Miniapp" --yes --output-dir <tmp> --skip-install`
   - 기대 결과: root template overlay까지 완료되어 생성이 끝나야 한다.
   - 실제 결과: `ENOENT ... scaffold-templates/root/.gitignore`
3. 수정 방향
   - npm pack 결과에서도 유지되는 템플릿 파일명으로 변경한다.
   - root template copy 로직과 테스트를 함께 보강한다.
4. 릴리스 후속 작업
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 둘 다 patch changeset을 추가한다.

## 현재 CLI UX 개선 작업
1. `yargs` 기반 CLI 옵션 파싱은 유지하고, 옵션으로 주어지지 않은 값만 `@clack/prompts` 기반 인터랙티브 입력으로 보완한다.
2. 누락된 값은 clack 프롬프트로 텍스트 입력 또는 선택 입력을 받는다.
   - 선택 입력은 Granite와 같은 clack 계열 UI로 렌더링한다.
3. CLI가 직접 출력하는 도움말, 오류, 진행 메시지는 한국어로 통일한다.
4. 테스트 범위
   - 옵션 파싱 단위 테스트
   - 빠진 값에 대해 인터랙티브 입력기로 위임되는지 검증
   - 기존 명령 계획/릴리스 테스트와 함께 `pnpm verify` 통과
5. 릴리스 후속 작업
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 둘 다 patch changeset을 추가해 CLI UX 변경을 함께 배포한다.

## 현재 프롬프트 렌더러 정리 작업
1. 누락 옵션 입력에 쓰던 커스텀 `execa` 프롬프트 렌더러를 제거하고 `@clack/prompts` 기반으로 통일했다.
2. 텍스트 입력은 `@clack/prompts`의 `text`를 사용하고, 선택 입력은 Granite와 같은 clack 계열 UI로 맞춘다.
3. 기존 `yargs` 우선, 누락 값만 인터랙티브 fallback이라는 흐름은 유지한다.
4. 테스트 범위
   - 누락된 값이 clack 프롬프트에 위임되는지 검증
   - 도움말/옵션 해석 회귀가 없는지 검증
   - 커스텀 ANSI 프로그램 생성 함수 제거에 맞춰 단위 테스트를 정리
5. 완료 기준
   - 프롬프트 UI가 Granite 계열과 같은 clack 렌더링으로 동작한다.
   - 더 이상 `execa`에 의존한 프롬프트 렌더링 코드가 남아 있지 않다.
6. 추가 UX 보정
   - `displayName` 입력에는 기본 예시를 넣지 않고, 프롬프트 위에 `보여지는 이름이니 한글로 해주세요.` 안내를 노출한다.
   - `server` 제공자와 `backoffice` 포함 여부는 멀티 선택이 아니라 단일 선택 프롬프트를 사용한다.

## 현재 Supabase provider bootstrap 작업
1. `server` 생성 여부를 단순 boolean이 아니라 provider 개념으로 확장한다.
   - 현재 provider는 `supabase` 하나만 지원한다.
   - 기존 `--with-server` 옵션은 유지하고, provider가 명시되지 않으면 `supabase`로 연결한다.
2. 인터랙티브 입력에서는 향후 provider 확장을 염두에 두고 `server` 미생성 또는 `supabase` 선택으로 해석 가능한 구조를 만든다.
3. `supabase` provider가 선택되면 `frontend`와 optional `backoffice`에 Supabase bootstrap을 같이 생성한다.
   - `.env.local.example` 파일 생성
   - Supabase client 파일 생성
   - env 타입 선언 파일 생성
4. `frontend`는 `dotenv`, `@granite-js/plugin-env`, `@supabase/supabase-js`를 설치하고 Granite dev/build/runtime에서 env가 주입되도록 patch한다.
   - 기준 구현은 `bookMiniApp`의 `apps/miniapp/granite.config.ts` 흐름을 따른다.
5. `backoffice`는 Vite env 규칙에 맞춰 `@supabase/supabase-js`, env 타입 선언, client bootstrap만 추가한다.
6. 테스트 범위
   - CLI가 provider를 해석하고 기존 `--with-server` 호환을 유지하는지 검증
   - command plan이 `supabase init`를 provider 선택 시에만 넣는지 검증
   - patch가 frontend/backoffice에 Supabase env/client bootstrap 파일과 의존성을 넣는지 검증
7. 완료 기준
   - `pnpm verify` 통과
   - 실제 scaffold 결과물에서 `frontend`와 `backoffice`가 Supabase env/client bootstrap을 바로 사용할 수 있는 상태
8. 후속 안정화
   - `granite.config.ts`, `backoffice/src/main.tsx`, `backoffice/src/App.tsx`의 문자열 `replace` patch를 SWC AST 기반 수정으로 교체한다.
   - 포맷과 quote style이 달라도 patch가 유지되도록 테스트를 보강한다.
9. granite runtime 보강
   - `frontend/granite.config.ts`의 `defineConfig`에 `metro.watchFolders = [repoRoot]`를 SWC AST로 추가한다.
   - `const repoRoot = path.resolve(__dirname, '../..')`도 함께 주입해 monorepo 루트 watch가 유지되게 한다.

## 현재 tsconfig module 안정화 작업
1. Supabase bootstrap 여부와 관계없이 `frontend`와 `backoffice` 워크스페이스의 tsconfig에서 `compilerOptions.module`을 `esnext`로 맞춘다.
2. `import.meta`를 사용하는 생성 파일이 TypeScript `TS1343` 오류 없이 타입체크되도록 만든다.
3. 문자열 치환이 아니라 JSON AST 기반 patch로 적용한다.
4. 입력은 JSONC로 읽되, 출력은 Biome이 읽을 수 있는 순수 JSON으로 정규화한다.
5. 테스트 범위
   - `frontend/tsconfig.json`의 `module`이 `esnext`로 바뀌는지 검증
   - `backoffice/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`의 `module`이 `esnext`로 바뀌는지 검증
6. 완료 기준
   - `pnpm verify` 통과
   - scaffold 결과물의 frontend/backoffice tsconfig가 `module: "esnext"`를 갖는다.
7. 릴리스 후속 작업
   - `create-rn-miniapp`와 `@create-rn-miniapp/scaffold-templates`를 같은 patch changeset에 넣어 함께 버전 업한다.

## 현재 README 및 scaffold 문서 재편 작업
1. 루트 `README.md`는 저장소 개발자 관점보다 생성기 사용자 관점으로 다시 쓴다.
2. `packages/scaffold-templates/base/AGENTS.md`는 생성 직후 가장 먼저 읽는 실행 안내서 역할만 남기고, 상세 규칙과 배경 설명은 하위 문서로 분리한다.
3. `docs/engineering/granite-ssot.md`, `docs/engineering/appsintoss-granite-api-index.md`, `docs/engineering/appsintoss-granite-full-api-index.md`, `AGENTS.md` 사이의 역할을 재정의해 중복을 제거한다.
4. 내용은 빠뜨리지 않되, 같은 규칙/링크/설명을 여러 파일에 반복하지 않도록 문서별 책임을 분리한다.
5. 검토 대상
   - `AGENTS.md`에서 제거 또는 축약 가능한 항목
   - `granite-rules.yml`은 별도 유지하지 않고 `granite-ssot.md`로 흡수한다.
   - 현재 문서 링크 구조가 처음 읽는 사용자/에이전트에게 혼란을 주는지 여부
6. 완료 기준
   - README만 봐도 설치/실행/옵션/주의사항을 이해할 수 있다.
   - AGENTS는 첫 진입용 체크리스트로 짧고 명확하다.
   - Granite/AppInToss 문서 3종은 각각 목적이 겹치지 않는다.
7. 검증
   - `pnpm verify`

## 남은 작업
1. npm publish 준비
   - Changesets 설정
   - GitHub Actions verify / release workflow
   - 버전 전략
   - 릴리스 문서
   - first publish rehearsal
2. CLI UX 다듬기
   - 기본 brand 색상/아이콘/권한 입력 확장 여부 판단
   - `--skip-install` 사용성 정리
3. smoke test 자동화
   - temp dir 기반 end-to-end 테스트를 CI 친화적으로 돌리는 방법 정리

## 테스트 전략
1. name/path/token replacement 단위 테스트
2. temp directory에서 공식 CLI 실행 후 patch 결과 검증
3. 조합별 검증
   - `frontend only` ✅
   - `frontend + server + backoffice` ✅
4. 생성 결과 루트에서 `pnpm verify`가 동작하는지 확인 ✅

## 문서 템플릿 이관
1. `bookMiniApp`에서 전자책 도메인 특화 내용만 제외하고, MiniApp 공통 하네스 문서를 이 저장소 템플릿으로 이관한다.
2. `packages/scaffold-templates/base/AGENTS.md`에 Granite, `@apps-in-toss/framework`, TDS, TDD 기준을 명시한다.
3. `packages/scaffold-templates/base/docs/engineering/*`에 AppInToss/Granite/TDS 인덱스와 에이전트 운영 문서를 포함한다.
4. 생성 결과물은 문서만 복사하는 것이 아니라, 에이전트가 바로 참조할 수 있는 링크 구조를 유지해야 한다.

## 리스크
1. Granite CLI의 비대화식 지원 범위를 먼저 확인해야 한다.
2. `ait init` 결과 구조가 바뀌면 frontend patch 로직도 같이 조정해야 한다.
3. source template를 들고 있지 않으므로, patch 지점 선택이 불안정하면 오히려 유지보수가 어려워질 수 있다.
4. 공식 scaffold가 자체 lint/format 설정을 계속 바꿀 수 있으므로, 제거/patch 지점을 너무 하드코딩하면 유지비가 올라간다.

## DoD
1. 공식 CLI를 순서대로 실행하는 orchestration이 동작한다. ✅
2. 결과물에 `frontend`, `server`, `backoffice` 구조가 생성된다. ✅
3. 결과물에 generic `AGENTS.md`, `docs/ai/*`, `docs/product/기능명세서.md`가 복사된다. ✅
4. 결과물 루트에 `pnpm + nx + biome`가 설정된다. ✅
5. 내부 워크스페이스는 자체 lint/format 도구 없이 루트 오케스트레이션만 사용한다. ✅
6. 생성 직후 루트 `pnpm verify`가 동작한다. ✅
7. 이 저장소 안에는 source scaffold template가 남아 있지 않다. ✅
8. 공개 패키지 릴리스용 Changesets 흐름이 설정된다.
9. PR 검증과 main 릴리스 자동화용 GitHub Actions가 설정된다.
