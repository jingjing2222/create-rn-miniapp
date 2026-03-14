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
