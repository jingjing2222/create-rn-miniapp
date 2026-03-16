## 작업명
`create-miniapp` 오케스트레이션 CLI 구현

## 다음 작업: Supabase / Firebase auth guide 이미지를 generated server README에 반영
1. 문제
   - Supabase와 Firebase는 auth 안내 섹션을 추가했지만, 실제 발급 화면 예시는 아직 generated `server/README.md`에 붙지 않는다.
   - 사용자가 찍어 준 스크린샷을 provider별로만 복사하고 렌더하는 경로가 필요하다.
2. 방향
   - `packages/scaffold-templates/optional/server-supabase/assets`, `optional/server-firebase/assets`에 guide 이미지를 넣는다.
   - provider별 patch 단계에서만 해당 asset을 `server/assets/`로 복사하고, generated `server/README.md`에 상대 경로로 붙인다.
   - Supabase는 access token guide 2장, Firebase는 `login:ci` 1장 + service account guide 2장을 별도 소제목 아래 렌더한다.
3. 완료 기준
   - Supabase provider일 때만 Supabase guide 이미지가 `server/README.md`에 보인다.
   - Firebase provider일 때만 Firebase guide 이미지가 `server/README.md`에 보인다.
   - `pnpm verify` 통과

## 다음 작업: Supabase / Firebase auth 안내를 Cloudflare 수준으로 보강
1. 문제
   - 현재 Supabase와 Firebase는 `server/.env.local`과 재배포 경로가 이미 있는데도, note와 generated `server/README.md`에는 어디서 토큰이나 서비스 계정 정보를 발급받는지 설명이 Cloudflare보다 약하다.
   - 특히 Supabase는 `SUPABASE_DB_PASSWORD`만 눈에 띄고, 비대화형 재배포에 쓸 access token 경로가 문서와 env 파일에 드러나지 않는다.
   - Firebase도 `FIREBASE_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS` 설명은 있지만, 발급 위치와 필요한 역할이 섹션 단위로 정리돼 있지 않아 빠르게 따라가기 어렵다.
2. 방향
   - Supabase는 `server/.env.local`에 `SUPABASE_ACCESS_TOKEN` placeholder를 추가하고, note와 `server/README.md`에 별도 인증 섹션을 만든다.
   - Firebase는 note와 `server/README.md`에 `Firebase deploy auth` 섹션을 만들고 `FIREBASE_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS`, 발급 위치, 권장 역할을 정리한다.
   - 이미지 삽입은 하지 않고, 나중에 스크린샷을 붙일 수 있게 섹션 구조만 먼저 준비한다.
3. 완료 기준
   - Supabase / Firebase 생성물의 `server/README.md`만 읽어도 비대화형 재배포에 필요한 토큰/서비스 계정 발급 위치와 넣을 위치를 바로 알 수 있다.
   - provisioning note도 같은 내용을 짧게 요약해준다.
   - `pnpm verify` 통과

## 다음 작업: 제공받은 Cloudflare token guide 이미지 반영
1. 문제
   - Cloudflare token guide 이미지를 생성물 `server/README.md`에 노출할 수 있게 패치했지만, 실제 이미지 파일은 아직 template asset 경로에 들어가 있지 않다.
2. 방향
   - 사용자가 전달한 이미지를 `packages/scaffold-templates/optional/server-cloudflare/assets/cloudflare-api-token-guide.png`로 복사한다.
3. 완료 기준
   - template asset 경로에 실제 이미지 파일이 존재하고, 다음 Cloudflare scaffold부터 `server/README.md`에서 그대로 보일 수 있다.

## 다음 작업: Cloudflare token 안내를 note/README 공통 섹션으로 정리
1. 문제
   - 현재 Cloudflare token 안내는 provisioning note와 `server/README.md`에 흩어진 짧은 문장으로만 들어가 있다.
   - 그래서 어디서 토큰을 만들고, 어떤 권한이 필요한지, `server/.env.local` 어디에 넣는지 한 번에 읽기 어렵다.
2. 방향
   - provisioning note 본문에 `Cloudflare API token` 섹션을 따로 만든다.
   - generated `server/README.md`에도 같은 주제의 별도 섹션을 추가한다.
   - Dashboard URL, 공식 문서, 권장 권한, `CLOUDFLARE_API_TOKEN=`에 secret을 붙여 넣는 방법을 함께 적는다.
3. 완료 기준
   - TUI note와 `server/README.md`만 읽어도 토큰 발급 경로, 필요한 권한, 붙여 넣을 위치를 바로 알 수 있다.

## 다음 작업: generated root `tsconfig.base.json` 제거
1. 문제
   - 현재 generated repo 루트에는 `tsconfig.base.json`이 항상 생성되지만, 실제 `frontend` / `backoffice` / `server`는 각 workspace가 자기 tsconfig를 들고 있고 루트 base를 공통 상속하지 않는다.
   - 그런데 루트 템플릿과 README에는 이 파일이 공통 TS 기준처럼 남아 있어서, `NodeNext` 같은 설정이 생성물 전체에 적용되는 것처럼 보인다.
2. 방향
   - `packages/scaffold-templates/root/tsconfig.base.json` 템플릿을 제거한다.
   - root template copy 경로와 `nx.json`의 `sharedGlobals`에서 `tsconfig.base.json` 참조를 제거한다.
   - 관련 README / 템플릿 README 설명과 테스트를 함께 갱신한다.
3. 완료 기준
   - 새 생성물 루트에는 `tsconfig.base.json`이 생기지 않는다.
   - 루트 README와 scaffold-templates README에도 더 이상 이 파일을 공통 생성물로 설명하지 않는다.
   - `pnpm verify`가 통과한다.

## 다음 작업: README Cloudflare 설명을 Worker + D1 + R2 기준으로 정리
1. 문제
   - 현재 README의 Cloudflare 섹션 첫 문장이 `Worker only + TypeScript scaffold`로 남아 있어서, 지금 구현된 D1 / R2 provisioning 범위가 바로 드러나지 않는다.
   - 본문 아래쪽 bullet에는 D1 / R2가 적혀 있어도 첫 인상이 현재 기능보다 축소돼 보인다.
2. 방향
   - Cloudflare 소개 문장을 `Worker + D1 + R2`까지 포함하는 표현으로 바꾼다.
   - provider 섹션 전체 톤은 그대로 두고, 실제 생성/연결 범위와 맞지 않는 표현만 걷어낸다.
3. 완료 기준
   - README만 읽어도 Cloudflare provider가 Worker-only가 아니라 Worker + D1 + R2까지 연결해준다는 점이 바로 보인다.

## 다음 작업: README provider 섹션에 generated `.env.local` 명시
1. 문제
   - 현재 README provider 섹션은 `frontend` / `backoffice`에 어떤 파일이 생기는지 설명하지만, 실제로 같이 써주는 `.env.local`이 목록에서 빠져 있다.
   - 그래서 provider를 고르면 어느 workspace에 env 파일이 같이 생기는지 한눈에 안 들어온다.
2. 방향
   - Supabase, Cloudflare, Firebase 각 섹션의 `frontend` / `backoffice` 목록에 generated `.env.local`을 명시한다.
   - 필요하면 `server` 쪽 `.env.local`과 톤도 같이 맞춘다.
3. 완료 기준
   - README만 봐도 provider별로 어떤 workspace에 `.env.local`이 만들어지는지 바로 알 수 있다.

## 다음 작업: 루트 git 기본 브랜치를 main으로 강제
1. 문제
   - 현재 create 흐름은 루트에서 `git init`만 실행한다.
   - 사용 환경에 따라 기본 브랜치가 `master`로 잡힐 수 있어서, 생성 직후 branch naming이 일관되지 않다.
2. 방향
   - 루트 git 초기화는 `git init` 뒤에 `HEAD`를 `main`으로 맞추는 후속 명령까지 함께 실행한다.
   - 아직 첫 커밋 전이라 실제 `master` ref가 생기지 않은 상태에서 `HEAD`만 `main`으로 옮기면, 결과적으로 `master` 없이 `main`으로 시작할 수 있다.
   - 실행 순서와 테스트에도 이 후속 단계를 드러낸다.
3. 테스트
   - 루트 git setup plan이 `git init`과 `HEAD -> main` 명령을 순서대로 가지는지 검증한다.
   - create lifecycle label에도 `main` 브랜치 설정 단계가 포함되는지 검증한다.
4. 완료 기준
   - 새 스캐폴드 루트 git repo는 생성 직후 기본 브랜치가 항상 `main`이다.
   - `pnpm verify` 통과

## 다음 작업: changeset과 PR 설명을 최신 범위로 정리
1. 문제
   - 현재 PR은 처음 추가한 Cloudflare D1/R2, deploy auth 범위 위주로 설명돼 있고, 이후에 들어간 Cloudflare token 안내 보강, Firebase build service account 재시도, TUI 톤 정리가 충분히 반영되지 않았다.
   - changeset도 패키지 버전 범위는 맞지만, 릴리스 노트 설명은 최신 작업까지 한 번에 읽히도록 더 구체적으로 정리하는 편이 좋다.
2. 방향
   - changeset은 `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 둘 다 `patch`를 유지한다.
   - 본문에는 Cloudflare D1/R2 IaC, Cloudflare/Firebase `.env.local` 기반 deploy, Cloudflare token 발급 안내, Firebase build service account 재시도와 TUI 톤 정리를 함께 반영한다.
   - PR summary와 testing도 지금 상태 기준으로 다시 쓴다.
3. 완료 기준
   - changeset만 읽어도 이번 릴리스에서 바뀐 provider 경험을 이해할 수 있다.
   - PR 본문이 실제 diff 범위를 빠짐없이 설명한다.

## 다음 작업: Firebase build service account 확인 타이밍 재시도
1. 문제
   - Firebase에서 Blaze 플랜을 올리거나 Cloud Build API를 켠 직후에는 기본 build service account가 아직 보이지 않을 때가 있다.
   - 지금은 그 순간 바로 권한 보정으로 들어가서, 계정이 아직 생기기 전 상태를 곧바로 실패로 처리할 수 있다.
2. 방향
   - Firebase build service account 확인 단계는 최소 5번까지 재시도한다.
   - 각 시도 사이에는 750ms씩 기다려서 총 대기 시간이 최소 3초가 되게 한다.
   - TUI에는 `Cloud Build 기본 service account를 확인하는 중이에요. (1/5)`처럼 현재 시도 횟수를 보여준다.
   - build service account가 실제로 보일 때만 IAM 권한 보정으로 넘어간다.
3. 테스트
   - build service account가 몇 번 뒤에 생기는 경우 재시도 후 성공하는지 검증한다.
   - 5번 모두 준비되지 않으면 최종적으로 기존 에러를 내는지 검증한다.
   - 시도 로그와 wait 횟수를 함께 검증한다.
4. 완료 기준
   - Blaze/Cloud Build 설정 직후의 eventual consistency 때문에 바로 실패하지 않는다.
   - 사용자는 TUI에서 현재 몇 번째 재시도인지 볼 수 있다.
   - `pnpm verify` 통과

## 다음 작업: TUI 말투를 README 톤으로 정리
1. 문제
   - 현재 CLI/TUI 문구는 기능은 맞지만, 전체적으로 딱딱하고 설명조 표현이 많다.
   - 같은 흐름 안에서도 prompt, step label, 완료 note, 수동 안내 note의 말투가 제각각이라 사용자 경험이 조금 거칠다.
2. 방향
   - runtime에서 보이는 prompt, step label, 완료/수동 note를 README의 `~요` 톤으로 맞춘다.
   - 단순히 존댓말만 바꾸지 않고, "안내", "작성 완료" 같은 딱딱한 제목도 "이렇게 넣어 주세요", "적어뒀어요"처럼 더 자연스럽게 바꾼다.
   - provider별 note 제목과 주요 입력 프롬프트를 우선 정리하고, 테스트 기대값도 같이 갱신한다.
3. 테스트
   - provider별 provisioning note 테스트에 바뀐 제목을 반영한다.
   - CLI prompt 테스트에 바뀐 문구를 반영한다.
4. 완료 기준
   - 사용자가 생성 중에 보게 되는 주요 TUI 문구가 README와 같은 톤으로 읽힌다.
   - `pnpm verify` 통과

## 다음 작업: Firebase deploy auth 안내에 발급 경로 추가
1. 문제
   - 현재 Firebase provisioning 완료 note는 `FIREBASE_TOKEN` 과 `GOOGLE_APPLICATION_CREDENTIALS`가 비어 있으니 필요할 때 채우라고만 안내한다.
   - 하지만 어디서 발급받는지와 어떤 명령이나 콘솔 페이지를 써야 하는지 빠져 있어서, 처음 보는 사용자는 바로 막힌다.
2. 방향
   - `FIREBASE_TOKEN` 안내에는 `firebase login:ci`와 Firebase CLI 공식 문서 URL을 포함한다.
   - `GOOGLE_APPLICATION_CREDENTIALS` 안내에는 Firebase/Google 공식 문서와 Google Cloud Service Accounts 콘솔 URL을 포함한다.
   - 자동 작성 완료 note와 수동 안내 note 모두 같은 수준으로 친절하게 맞춘다.
3. 테스트
   - Firebase finalize/manual note 테스트에 `firebase login:ci`와 Service Accounts URL이 포함되는지 검증한다.
4. 완료 기준
   - Firebase deploy auth 관련 note만 읽어도 발급 위치와 다음 행동을 바로 알 수 있다.
   - `pnpm verify` 통과

## 다음 작업: Cloudflare OAuth scope 축소로 인한 D1/R2 인증 오류 복구
1. 문제
   - 현재 Cloudflare provider는 `wrangler login --scopes ...`로 OAuth scope를 좁혀서 발급받는다.
   - 예전 scope로 남아 있는 Wrangler 로그인 토큰은 Worker 관련 API는 통과해도 D1 / R2 조회 단계에서 `Authentication error`로 실패할 수 있다.
   - 사용자는 Worker 이름까지 입력한 뒤 D1 / R2 단계에서 원인 설명 없이 중단되는 흐름을 겪게 된다.
2. 방향
   - Wrangler 로그인은 더 이상 `--scopes`를 강제하지 않고, Cloudflare 기본 full scope 발급 경로를 사용한다.
   - Cloudflare REST API 호출이 `Authentication error`류 응답으로 실패하면 scope가 부족한 토큰으로 보고 `wrangler login`을 한 번 더 실행한 뒤 같은 호출을 재시도한다.
   - R2가 계정에서 아직 활성화되지 않은 경우에는 대시보드 R2 Overview URL을 안내하고, 같은 실행 안에서 `다시 확인` 루프를 돌려 복구한다.
   - 관련 helper를 테스트 가능한 함수로 분리해서 login args와 auth retry 분기를 고정한다.
3. 테스트
   - Wrangler login args가 더 이상 `--scopes`를 포함하지 않는지 검증
   - `Authentication error` 메시지를 auth retry 대상으로 인식하는지 검증
4. 완료 기준
   - 새 Cloudflare 로그인은 scope 축소 없이 발급된다.
   - 기존 제한된 Wrangler 토큰으로 시작해도 D1 / R2 단계에서 자동 재로그인 후 복구할 수 있다.
   - `pnpm verify` 통과

## 다음 작업: Cloudflare D1/R2 IaC와 Cloudflare/Firebase 재배포 토큰 경로 정리
1. 문제
   - 현재 `cloudflare` provider는 Worker deploy와 API URL 작성까지만 하고, D1 database나 R2 bucket은 선택/생성하지 않는다.
   - 현재 `cloudflare` / `firebase` `server/package.json`의 `deploy`는 plain CLI 호출이라 `server/.env.local`에 적힌 token/credentials를 자동으로 읽지 않는다.
   - 그래서 provider별로 “IaC 이후 `.env.local`만 채우면 한 명령으로 재배포” 경험이 일관되지 않는다.
2. 방향
   - Cloudflare provider에 D1 / R2 목록 조회, 기존 리소스 선택 또는 새 리소스 생성, `wrangler.jsonc` bindings 자동 반영을 추가한다.
   - Cloudflare는 `server/.env.local`에 Worker / D1 / R2 메타데이터와 `CLOUDFLARE_API_TOKEN`을 기록하고, `deploy`는 이 파일을 읽어 `wrangler deploy`를 실행하는 wrapper로 바꾼다.
   - Firebase는 `server/.env.local`의 `GOOGLE_APPLICATION_CREDENTIALS`와 project metadata를 읽어 `firebase deploy --only functions`를 실행하는 wrapper로 바꾼다.
   - Firebase 쪽은 자동 권한 보정이 가능한 부분만 CLI로 처리하고, 불가한 권한/정책 제약은 raw 에러 대신 명확한 복구 안내를 유지한다.
3. 테스트
   - Cloudflare provision/finalize 테스트에 D1 / R2 metadata 기록과 note 문구를 추가한다.
   - `wrangler.jsonc` patch 테스트에 D1 / R2 bindings와 schema/name 보존을 추가한다.
   - Cloudflare/Firebase server package template / patch 테스트에 deploy wrapper 생성과 `server/.env.local` 로딩을 검증한다.
4. 완료 기준
   - `cloudflare` provider가 Worker + D1 + R2를 함께 연결한다.
   - `cloudflare` / `firebase`는 `server/.env.local` 기반 one-command redeploy 경로를 가진다.
   - 관련 README / engineering 문서가 새 동작을 설명한다.
   - `pnpm verify` 통과

## 다음 작업: README 상단 소개와 빠른 시작 축약
1. 문제
   - 현재 README 상단은 같은 의미를 반복해서 설명하고, package manager별 문장을 길게 늘어놓고 있다.
   - 생성 구조에서도 내부 workspace manifest와 lockfile 설명이 너무 앞단에 나와 제품 설명 집중도가 떨어진다.
2. 방향
   - 소개 문장을 에이전트가 Granite, `@apps-in-toss/framework`, TDS를 바로 활용할 수 있는 실행 컨텍스트 patch 도구라는 관점으로 다시 쓴다.
   - `npm/pnpm/yarn/bun create` 예시는 한 코드 블록으로 묶고, package manager 자동 선택은 한 문장으로 압축한다.
   - 생성 구조에서는 꼭 필요한 루트 파일만 남기고 package-manager별 manifest/lockfile 상세는 제거한다.
3. 완료 기준
   - README 상단이 반복 없이 더 짧고 제품 중심으로 읽힌다.
   - 빠른 시작 설명이 중복 없이 정리된다.
   - `pnpm verify` 통과

## 다음 작업: watch 모드 `vitest` 스크립트 정규화
1. 문제
   - 생성물 workspace가 `test: "vitest"`를 그대로 가지면 루트 `nx test`에서 watch 모드로 붙잡혀 종료되지 않는다.
   - 특히 backoffice나 Cloudflare server처럼 외부 scaffold가 넣어준 기본 Vitest 스크립트가 그대로 남을 수 있다.
2. 방향
   - workspace patch 단계에서 plain `vitest` test script를 `vitest run`으로 정규화한다.
   - placeholder test를 넣는 기존 규칙은 유지하고, 이미 `vitest run` 등 non-watch 스크립트인 경우는 건드리지 않는다.
3. 테스트
   - backoffice package patch가 `vitest`를 `vitest run`으로 바꾸는지 검증
   - Cloudflare server patch가 `vitest`를 `vitest run`으로 바꾸는지 검증
4. 완료 기준
   - 루트 `nx test`가 watch 모드 때문에 멈추지 않는다.
   - `pnpm verify` 통과

## 다음 작업: `--with-server` 제거하고 `--server-provider`로 단일화
1. 문제
   - 현재 CLI에는 `--with-server`와 `--server-provider`가 같이 있어서 `server` 생성 책임이 중복된다.
   - 이 중복 때문에 `--with-server` 기본값, `--yes` 조합, provider 선택 예외 처리가 계속 생긴다.
2. 방향
   - `--with-server`는 CLI에서 완전히 제거한다.
   - `server` 생성은 `--server-provider <supabase|cloudflare|firebase>` 하나로만 표현한다.
   - 인터랙티브에서는 `server-provider`가 없을 때만 `none + providers` 선택을 보여준다.
   - `--yes`에서는 `--server-provider`가 없으면 `server`를 만들지 않는다.
   - `--server-project-mode`는 `--server-provider`가 있을 때만 허용한다.
   - `--add`도 같은 규칙으로 맞춘다.
3. 테스트
   - `--server-provider`만으로 `server`가 포함되는지 검증
   - `--yes` + no `--server-provider`면 `server` 없이 진행하는지 검증
   - `--server-project-mode` without `--server-provider`면 에러를 내는지 검증
   - `--add`에서도 같은 규칙을 검증
4. 완료 기준
   - `--with-server` 관련 파싱/문구/테스트가 사라진다.
   - `server` 생성 여부는 `--server-provider` 유무와 인터랙티브 선택으로만 결정된다.
   - `pnpm verify` 통과

## 다음 작업: granite.config.ts unused optional env helper 제거
1. 문제
   - 현재 frontend `granite.config.ts` 코드젠은 optional env binding이 없는 provider(`supabase`, `cloudflare`)에서도 `resolveOptionalMiniappEnv()` helper를 항상 생성한다.
   - 결과적으로 실제로 쓰이지 않는 helper가 생성물에 남고, provider별 preamble이 필요 이상으로 비대해진다.
2. 방향
   - Granite frontend env preamble 생성 로직을 다시 보고, optional binding이 있는 provider에서만 optional helper를 만들게 조정한다.
   - `resolveMiniappEnv`, `resolveOptionalMiniappEnv`, env binding 선언 중 provider별로 실제 쓰는 항목만 남기도록 정리한다.
3. 테스트
   - `supabase` frontend patch 결과에 `resolveOptionalMiniappEnv`가 없어야 한다.
   - `cloudflare` frontend patch 결과에 `resolveOptionalMiniappEnv`가 없어야 한다.
   - `firebase` frontend patch 결과에는 optional measurement id 때문에 helper가 유지되어야 한다.
4. 완료 기준
   - `supabase`/`cloudflare` 생성물의 `granite.config.ts`에는 unused optional helper가 없다.
   - `firebase` 생성물은 기존 optional measurement id 지원을 유지한다.
   - `pnpm verify` 통과

## 다음 작업: npm peer dependency install 완화
1. 문제
   - `npm`으로 MiniApp frontend를 설치하면 Granite/React Native 쪽 peer dependency 충돌 때문에 `ERESOLVE unable to resolve dependency tree`가 발생한다.
   - 루트 `.npmrc`를 먼저 만들어도 `frontend`처럼 별도 `package.json`이 있는 하위 workspace install에는 설정이 전파되지 않는다.
   - 이 충돌은 생성 직후 frontend install뿐 아니라, 최종 루트 workspace install, Firebase functions nested install, 이후 사용자의 수동 `npm install`에도 영향을 줄 수 있다.
2. 방향
   - npm 전용 완화 전략은 CLI flag가 아니라 workspace별 `.npmrc`로 옮긴다.
   - 루트에는 기존대로 `.npmrc`를 만들고, `frontend`, `backoffice`, `server`, `server/functions`에도 필요할 때 같은 `.npmrc`를 만든다.
   - create 시에는 `frontend` 생성 직후 `.npmrc`를 먼저 써서 첫 `npm install`부터 설정이 적용되게 한다.
   - 이 구성이 되면 npm adapter의 `--legacy-peer-deps` 플래그는 제거한다.
3. 테스트
   - npm create command plan이 더 이상 `--legacy-peer-deps`를 붙이지 않는지 검증
   - npm root finalize install args 검증
   - npm root/server/firebase functions `.npmrc` 생성 검증
   - npm Firebase functions predeploy/build script가 플래그 없이 동작하는지 검증
4. 완료 기준
   - `frontend` 첫 install 전 `.npmrc`가 생성된다.
   - 생성물의 npm workspace들에 `legacy-peer-deps=true`가 남는다.
   - npm adapter 명령에는 더 이상 `--legacy-peer-deps`가 없다.
   - `pnpm verify` 통과

## 다음 작업: Bun directory command 순서 보정
1. 문제
   - 현재 Bun adapter가 `bun --cwd <dir> install`, `bun --cwd <dir> run <script>` 형태를 만든다.
   - 실제 Bun CLI는 `bun install --cwd <dir>`, `bun run --cwd <dir> <script>` 순서를 기대해서, Firebase predeploy 같은 generated command가 실패한다.
2. 방향
   - Bun adapter의 directory/script command 순서를 Bun CLI 실제 문법에 맞게 수정한다.
   - Bun 기반 root/workspace 템플릿 테스트 기대값도 같이 갱신한다.
3. 완료 기준
   - Firebase predeploy의 Bun 경로가 `bun install --cwd "$RESOURCE_DIR" && bun run --cwd "$RESOURCE_DIR" build` 형태로 나온다.
   - Bun workspace build command도 올바른 순서를 쓴다.
   - `pnpm verify` 통과

## 다음 작업: Firebase build service account 추론 보정
1. 문제
   - 현재 Firebase Functions IAM 보정은 `PROJECT_NUMBER-compute@developer.gserviceaccount.com`를 기본 build service account로 고정 가정한다.
   - 실제 Cloud Build 기본 service account는 프로젝트 설정에 따라 Compute Engine default account일 수도 있고, legacy Cloud Build account나 다른 기본 account일 수도 있다.
   - 그래서 존재하지 않는 compute service account에 role을 추가하려다 `Service account ... does not exist`로 실패할 수 있다.
2. 방향
   - Firebase IAM 보정 시 `gcloud builds get-default-service-account --project <id>`를 먼저 호출해서 실제 기본 build service account를 조회한다.
   - 조회된 service account 기준으로 project IAM role 보정을 수행한다.
   - 조회된 기본 account가 존재하지 않으면, 잘못된 role add 시도 대신 복구 안내를 내보낸다.
3. 테스트
   - default build service account 조회값을 기준으로 role 보정하는 테스트
   - 조회된 default account가 존재하지 않을 때 명확한 에러를 내는 테스트
4. 완료 기준
   - 더 이상 compute default service account를 하드코딩하지 않는다.
   - Firebase IAM 보정이 실제 Cloud Build 기본 service account 기준으로 동작한다.
   - `pnpm verify` 통과

## 다음 작업: Cloud Build API 자동 활성화 후 IAM 보정 재시도
1. 문제
   - 새 Firebase 프로젝트에서는 `gcloud builds get-default-service-account` 호출 시 `cloudbuild.googleapis.com`이 아직 비활성화된 경우가 있다.
   - 지금은 이 상태를 에러로 끝내서, 실제로는 자동 복구 가능한 초기 프로젝트에서도 스캐폴딩이 중단된다.
2. 방향
   - Firebase IAM 보정 중 `SERVICE_DISABLED`로 `cloudbuild.googleapis.com`이 감지되면 `gcloud services enable cloudbuild.googleapis.com --project <id>`를 먼저 실행한다.
   - enable 후 같은 루프에서 default build service account 조회를 다시 시도한다.
3. 완료 기준
   - Cloud Build API가 꺼진 새 Firebase 프로젝트에서도 IAM 보정이 자동으로 복구된다.
   - `pnpm verify` 통과

## 다음 작업: dev prerelease publish 스크립트 추가
1. 문제
   - 현재 루트에는 changeset 기반 정식 릴리스만 있고, 두 패키지를 같은 dev 버전으로 바로 npm에 올리는 스크립트가 없다.
   - `create-rn-miniapp`는 `@create-rn-miniapp/scaffold-templates`를 `workspace:*`로 참조하므로, dev publish 시에는 staging된 manifest에서 실제 prerelease 버전으로 치환해야 한다.
2. 방향
   - 루트에 `publish:dev` 스크립트를 추가한다.
   - 버전은 `0.0.0-dev.<timestamp>` 형식으로 계산한다.
   - 작업 트리를 수정하지 않고, 두 패키지를 임시 디렉터리에 stage해서 publish한다.
   - publish 순서는 `@create-rn-miniapp/scaffold-templates` 먼저, `create-rn-miniapp` 나중으로 고정한다.
   - `NPM_TOKEN`은 사용자가 export 해둔 값을 그대로 사용하고, 없으면 즉시 에러를 낸다.
3. 구현 메모
   - 루트 `pnpm build` 후 publish한다.
   - staging된 CLI `package.json`에서는 templates dependency를 같은 dev 버전으로 바꾼다.
   - publish는 `npm publish --tag dev --access public` 기준으로 실행한다.
4. 테스트
   - `publish:dev` 루트 script 존재 확인
   - dev 버전 문자열 포맷 테스트
   - staged manifest에서 두 패키지 버전과 CLI dependency 치환 확인
5. 완료 기준
   - `pnpm publish:dev`로 두 패키지를 같은 dev version으로 publish할 수 있다.
   - 작업 트리의 실제 `package.json` 버전은 바뀌지 않는다.
   - `pnpm verify` 통과

## 다음 작업: npm / bun package manager 지원
1. 문제
   - 현재 생성기는 `pnpm`과 `yarn`만 지원한다.
   - `npm create rn-miniapp`로 들어왔을 때는 선택 프롬프트가 뜨지만, 실제 생성 결과를 `npm`으로 유지하는 경로는 없다.
   - `bun create rn-miniapp`처럼 Bun 기반 scaffold 흐름도 현재는 사용할 수 없다.
2. 방향
   - `package-manager` adapter에 `npm`, `bun`을 추가한다.
   - 호출 package manager 추론도 `npm`, `bun`까지 확장한다.
   - package manager 선택 prompt는 제거하고, 호출한 command를 그대로 따른다.
     - 감지 실패 시 기본값으로 숨기지 않고 에러를 낸다.
   - root template와 workspace manifest는 manager별로 분기한다.
     - `pnpm`: `pnpm-workspace.yaml`
     - `yarn`/`npm`/`bun`: `package.json.workspaces`
   - root `package.json` scripts, lockfile/ignore 처리, finalize 단계도 manager-aware로 확장한다.
   - README와 CLI help, 테스트를 모두 새 선택지 기준으로 갱신한다.
3. 구현 메모
   - `npm`은 `npm create`, `npm exec`, `npx`, `npm --prefix` 계열 명령으로 맞춘다.
   - `bun`은 `bun create`, `bunx`, `bun add`, `bun --cwd` 계열 명령으로 맞춘다.
   - provider별 local script와 Firebase nested functions install 경로도 manager별 차이를 반영해야 한다.
4. 완료 기준
   - `--package-manager <pnpm|yarn|npm|bun>`이 동작한다.
   - `npm create rn-miniapp`는 `npm`, `bun create rn-miniapp`는 `bun`으로 자동 선택된다.
   - package manager 선택 prompt가 더 이상 뜨지 않는다.
   - 감지 실패 시 `--package-manager`를 명시하라는 에러가 난다.
   - 생성 결과 root manifest와 verify/build script가 manager별로 맞게 나온다.
   - `pnpm verify` 통과

## 다음 작업: CLI `--no-git` 옵션 추가
1. 문제
  - 현재는 새 스캐폴드가 항상 루트 `git init`까지 진행한다.
   - 외부 템플릿 소비나 임시 출력처럼 루트 저장소 초기화를 원하지 않는 경우에는 끌 수 있는 CLI 옵션이 필요하다.
2. 방향
   - create 흐름에 `--no-git` 옵션을 추가한다.
   - `--no-git`이면 루트 `git init` 단계를 건너뛴다.
   - 도움말, README, 생성 설정 요약에도 반영한다.
3. 완료 기준
   - `--no-git`이 parse/help/README에 노출된다.
   - create 흐름에서만 루트 `git init`을 생략할 수 있다.
   - `pnpm verify` 통과

## 다음 작업: 새 스캐폴드 루트에 git init 추가
1. 문제
   - 현재는 공식 scaffold와 템플릿 적용까지 끝나도 생성된 루트 모노레포에 `.git`이 자동으로 생기지 않는다.
   - 그래서 생성 직후 바로 변경 이력을 관리하거나 첫 커밋을 만들려면 사용자가 직접 `git init`을 해야 한다.
2. 방향
   - create 흐름에서만 루트에 `git init` 단계를 추가한다.
   - `--add`에는 넣지 않고, 새 모노레포를 만들 때만 동작하게 한다.
   - `--skip-install`과 무관하게 항상 루트 저장소가 초기화되도록 한다.
3. 완료 기준
   - 새 스캐폴드 결과물 루트에 `.git`이 생성된다.
   - 실행 순서 테스트가 `루트 git init` 단계를 포함한다.
   - `pnpm verify` 통과

## 다음 작업: 호출 package manager 기반 기본 선택
1. 문제
   - 현재는 `create-miniapp` 실행 시 package manager를 명시하지 않으면 항상 prompt로 고르거나 `--yes`일 때 `pnpm`으로 고정된다.
   - 하지만 `pnpm create rn-miniapp`로 들어왔으면 `pnpm`, `yarn create rn-miniapp`로 들어왔으면 `yarn`을 바로 쓰는 게 자연스럽다.
   - 반대로 `npm create rn-miniapp`에서는 `pnpm`/`yarn` 선택 프롬프트를 유지하는 편이 맞다.
2. 방향
   - `npm_config_user_agent`와 관련 env를 기준으로 호출한 package manager를 추론한다.
   - `pnpm`/`yarn`으로 추론되면 package manager prompt를 생략하고 그대로 사용한다.
   - `npm` 또는 미확인인 경우에만 기존 prompt를 유지한다.
3. 완료 기준
   - `pnpm create`면 `pnpm`, `yarn create`면 `yarn`이 자동 선택된다.
   - `npm create`면 package manager 선택 prompt가 유지된다.
   - `pnpm verify` 통과

## 다음 작업: README에 기능명세서 우선 흐름 추가
1. 문제
   - 현재 README는 생성 결과물과 provider 흐름은 설명하지만, 생성 직후 사용자가 어떤 순서로 작업을 시작하면 좋은지는 약하다.
2. 방향
   - 생성 후에는 먼저 `docs/product/기능명세서.md`를 작성하고, 그 명세를 기준으로 구현을 진행하는 흐름을 README에 명시한다.
3. 완료 기준
   - README에 생성 직후 추천 작업 순서가 추가된다.
   - `pnpm verify` 통과

## 다음 작업: patching/ast 디렉터리 정합성 정리
1. 문제
   - 방금 `patching/ast.ts`를 분해했지만, `patching/ast/index.ts`가 상위 디렉터리의 `granite.ts`, `backoffice.ts`를 다시 export하고 있다.
   - 즉 `patching/ast` 디렉터리 이름과 실제 파일 배치가 어긋나서 구조가 부자연스럽다.
2. 방향
   - AST 축 파일은 모두 `patching/ast/` 아래에 둔다.
   - `patching/ast/index.ts`는 같은 디렉터리 안의 파일만 re-export한다.
3. 작업
   - `patching/granite.ts` -> `patching/ast/granite.ts`
   - `patching/backoffice.ts` -> `patching/ast/backoffice.ts`
   - `patching/swc.ts` -> `patching/ast/shared.ts`
   - 관련 import 전부 갱신
4. 완료 기준
   - `patching/ast/index.ts`가 상위 디렉터리 파일을 가리키지 않는다.
   - `pnpm verify` 통과

## 다음 작업: patching/ast.ts 책임 분리
1. 문제
   - `packages/create-rn-miniapp/src/patching/ast.ts`가 1000줄이 넘고, SWC 유틸, Granite config patch, backoffice TSX patch, JSONC patch, package.json ordered patch가 한 파일에 섞여 있다.
   - 현재는 “AST 관련 파일”이라는 이름 아래 구현 축이 너무 넓어서, 특정 patch를 수정할 때도 unrelated helper를 계속 같이 열어야 한다.
2. 현재 섞여 있는 책임
   - SWC 공통 유틸
     - parse/print/identifier/member/call/object property helper
   - Granite config patch
     - `patchGraniteConfigSource`
     - `readGraniteConfigMetadata`
     - env plugin / AppsInToss brand / metro watchFolders
   - backoffice TSX patch
     - `patchBackofficeMainSource`
     - `patchBackofficeAppSource`
   - JSONC patch
     - `patchTsconfigModuleSource`
     - `patchWranglerConfigSource`
   - ordered JSON patch
     - `patchPackageJsonSource`
     - `patchRootPackageJsonSource`
3. 분리 방향
   - `patching/ast/shared.ts`
     - SWC node type alias
     - parse/print helper
     - identifier/member/call/object property 유틸
   - `patching/ast/granite.ts`
     - `patchGraniteConfigSource`
     - `readGraniteConfigMetadata`
     - Granite 전용 preamble / provider env config
   - `patching/ast/backoffice.ts`
     - `patchBackofficeMainSource`
     - `patchBackofficeAppSource`
   - `patching/jsonc.ts`
     - `patchTsconfigModuleSource`
     - `patchWranglerConfigSource`
   - `patching/package-json.ts`
     - ordered entry parser/upsert/remove/stringify
     - `patchPackageJsonSource`
     - `patchRootPackageJsonSource`
   - `patching/ast/index.ts`
     - 외부에서 쓰는 export만 얇게 재조합
4. 구현 원칙
   - `index.ts`만 barrel로 둔다.
   - `patching/index.ts`에서는 Granite/backoffice/jsonc/package-json 세부 구현 위치를 몰라도 되게 유지한다.
   - 테스트도 구현 옆으로 붙인다.
     - Granite metadata/patch 테스트
     - backoffice TSX patch 테스트
     - JSONC patch 테스트
     - package.json ordered patch 테스트
5. 순서
   - 1차: SWC shared helper 분리
   - 2차: Granite 전용 파일 분리
   - 3차: backoffice TSX patch 분리
   - 4차: JSONC / package.json patch 분리
   - 5차: AST 테스트도 파일 옆으로 이동
6. 완료 기준
   - `patching/ast.ts` 단일 거대 파일이 사라지거나, 최소한 orchestration용 `index.ts` 수준으로 얇아진다.
   - 각 patch 축이 파일 이름만 보고 역할을 알 수 있다.
   - `pnpm verify` 통과

## 다음 작업: 단위 테스트 코로케이션 정리
1. 문제
   - 최근 `src/providers`, `src/patching`, `src/scaffold`, `src/templates`로 구현을 분리했지만, 대응 테스트는 아직 `src` 루트에 남아 있다.
   - 구현과 테스트가 멀어져서 리팩터링 시 찾기 어렵다.
2. 방향
   - 폴더로 분리된 구현은 같은 디렉터리에 `*.test.ts`를 둔다.
   - 루트 전용 모듈(`cli`, `commands`, `layout`, `workspace-inspector`, `release`) 테스트는 그대로 유지한다.
3. 작업
   - provider provisioning 테스트를 각 provider 폴더로 이동
   - `patch.test.ts`, `scaffold.test.ts`, `templates.test.ts`를 해당 구현 폴더로 이동
   - import 경로와 테스트 실행 패턴이 그대로 동작하는지 확인
4. 완료 기준
   - 분리된 구현 폴더 옆에 대응 단위 테스트가 위치한다.
   - `pnpm verify` 통과

## 다음 작업: create-rn-miniapp src 루트 barrel 제거
1. 문제
   - 최근 구조 리팩터링으로 `src/providers`, `src/patching`, `src/scaffold`, `src/templates`를 만들었지만, 루트에 `export * from ...`만 남은 non-index 파일이 생겼다.
   - `src/ast.ts`, `src/patch.ts`, `src/scaffold.ts`, `src/server-provider.ts`, `src/*-provision.ts`, `src/templates.ts` 같은 파일은 실제 구현이 아니라 alias라서 구조를 다시 흐린다.
2. 방향
   - `index.ts`만 barrel로 허용한다.
   - 나머지 파일은 모두 직접 구현 경로를 import하도록 바꾸고 삭제한다.
3. 작업
   - 내부 import와 테스트 import를 실제 구현 경로로 전환
   - root non-index barrel 파일 삭제
   - `pnpm verify`로 회귀 확인
4. 완료 기준
   - `packages/create-rn-miniapp/src` 아래 non-index re-export file이 남지 않는다.
   - `pnpm verify` 통과

## 다음 작업: provider별 AGENTS.md 분기 계획
1. 문제
   - 생성 직후 가장 먼저 보는 문서는 root `AGENTS.md`인데, 현재 내용은 provider 차이를 거의 반영하지 못한다.
   - 특히 `supabase`, `cloudflare`, `firebase`는 `server` 워크스페이스의 역할, 운영 스크립트, 주의사항이 다르다.
   - 지금처럼 완전 공통 템플릿 하나만 쓰면 첫 진입 문서가 너무 일반적이고, 반대로 세 provider 설명을 다 넣으면 너무 길고 헷갈리기 쉽다.
2. 방향
   - 완전히 다른 `AGENTS.md` 3개를 유지하지 않고, root `AGENTS.md`에는 provider별 안내를 한두 줄만 추가한다.
   - 대신 provider-specific 설명은 `docs/engineering` 아래 별도 문서로 분리한다.
   - 즉 `AGENTS.md`는 여전히 “가장 먼저 보는 1페이지” 역할만 하고, provider별 차이는 링크 중심으로 안내한다.
3. 구현 구조 제안
   - `packages/scaffold-templates/base/AGENTS.md`는 공통 골격을 유지한다.
   - `docs/engineering`에 provider별 문서를 추가한다.
     - `server-provider-supabase.md`
     - `server-provider-cloudflare.md`
     - `server-provider-firebase.md`
   - root `AGENTS.md`에는 현재 선택된 provider에 맞는 한 줄 정도만 추가한다.
     - 예: `server는 Supabase workspace예요. 먼저 docs/engineering/server-provider-supabase.md 와 server/README.md 를 보세요.`
4. provider별로 들어갈 핵심 차이
   - `supabase`
     - `server`는 Supabase project 연결, SQL migration, Edge Functions 배포 workspace라고 명시
     - 먼저 볼 파일: `server/README.md`, `server/.env.local`
     - 우선 스크립트: `db:apply`, `functions:serve`, `functions:deploy`
     - frontend/backoffice는 `src/lib/supabase.ts`와 `supabase.functions.invoke()` 흐름을 쓴다고 안내
   - `cloudflare`
     - `server`는 Worker 배포 workspace라고 명시
     - 먼저 볼 파일: `server/wrangler.jsonc`, `server/README.md`, `server/.env.local`
     - 우선 스크립트: `dev`, `build`, `typecheck`, `deploy`
     - frontend/backoffice는 `API_BASE_URL` 기반 helper를 쓴다고 안내
   - `firebase`
     - `server`는 Functions 배포 workspace라고 명시
     - 먼저 볼 파일: `server/firebase.json`, `server/functions/src/index.ts`, `server/.env.local`, `server/README.md`
     - 우선 스크립트: `build`, `typecheck`, `deploy`, `logs`
     - frontend/backoffice는 Firebase Web SDK(`firebase.ts`, `firestore.ts`, `storage.ts`)를 쓴다고 안내
5. 문서 길이 제어 원칙
   - root `AGENTS.md`에는 provider-specific 문단을 길게 넣지 않는다.
   - 긴 배경 설명은 provider 문서로 보내고, `AGENTS.md`에는 “무엇을 먼저 볼지”만 남긴다.
   - provider 문서에는 “server가 무엇인지 / 먼저 볼 파일 / 먼저 쓸 명령 / frontend/backoffice 연결”만 남긴다.
   - 상세 운영 설명은 계속 `server/README.md`가 맡는다.
6. 테스트/검증
   - provider별 생성 결과에서 root `AGENTS.md`가 해당 provider 문구와 링크를 포함하는지 검증
   - provider 문서가 docs 템플릿으로 생성되는지 검증
   - `pnpm verify` 통과

## 현재 README 톤 정리
1. 루트 `README.md`, `packages/scaffold-templates/README.md`, provider별 `server/README.md` 문구를 Toss식 `~요` 체로 정리한다.
2. 사용자에게 직접 보이는 설명은 명령형보다 “이렇게 동작해요 / 이렇게 쓸 수 있어요 / 필요하면 이렇게 하면 돼요” 톤을 우선한다.
3. 완료 기준
   - 사용자-facing README 문장이 전반적으로 `~요` 체로 통일된다.
   - `pnpm verify` 통과

## 현재 Supabase Edge Functions 확장
1. `supabase` provider도 이제 `db + edge functions`를 함께 갖는 실제 `server` 워크스페이스로 동작한다.
2. 반영 내용
   - `server Supabase 초기화` 뒤에 기본 `api` Edge Function을 `supabase functions new api --workdir . --yes`로 scaffold 한다.
   - `server/package.json`에 `functions:serve`, `functions:deploy`를 추가한다.
   - `server/scripts/supabase-functions-deploy.mjs`가 `server/.env.local`의 `SUPABASE_PROJECT_REF`를 읽어 모든 로컬 Edge Function을 원격에 배포한다.
   - provisioning은 `link -> db push -> functions deploy` 순서로 이어진다.
   - `server/README.md`와 root `README.md`에 Edge Functions 구조와 `supabase.functions.invoke('api')` 사용 동선을 반영한다.
3. 유지한 원칙
   - Edge Functions scaffold는 공식 Supabase CLI(`supabase functions new`)를 그대로 사용한다.
   - frontend/backoffice의 기존 `@supabase/supabase-js` bootstrap은 유지하고, 1차에서는 별도 helper를 추가하지 않는다.
4. 완료 기준
   - `supabase` provider 생성 직후 `supabase/functions/api/index.ts`가 존재한다.
   - `server/package.json`만으로 로컬 serve와 원격 deploy를 다시 수행할 수 있다.
   - `pnpm verify` 통과

## 현재 Firebase 프로젝트 생성 복구 작업
1. `firebase projects:create <projectId>`는 Google Cloud project 생성까지 성공한 뒤, Firebase 리소스 연결 단계에서 비영(非0) 종료할 수 있다.
2. 이 경우 현재 CLI는 전체 생성 실패로 취급하고 중단하지만, 실제로는 `projects:addfirebase <projectId>`로 이어서 복구 가능한 케이스가 있다.
3. 재현 로그 기준 실패 패턴
   - `Creating Google Cloud Platform project` 성공
   - `Adding Firebase resources to Google Cloud Platform project` 실패
4. 대응 방향
   - 실패 메시지 분류 로직을 테스트로 추가
   - duplicate projectId 에러는 기존처럼 재입력
   - partial-create 에러는 `projects:addfirebase` 자동 복구 시도
   - captureOutput 에러 메시지에는 stdout/stderr를 모두 포함해 복구 판단에 필요한 문자열을 잃지 않게 한다.
5. 완료 기준
   - 위 partial-create 패턴에서 생성 흐름이 바로 죽지 않고 `projects:addfirebase`를 시도한다.
   - `pnpm verify` 통과

## 현재 Firebase addfirebase 실패 원인 분리 작업
1. `projects:addfirebase` 자동 복구를 붙였지만, 실제 사용자 계정에서는 이 단계도 실패할 수 있다.
2. 먼저 `firebase-debug.log`를 읽어 실패 원인이 권한/결제/프로젝트 상태인지, 우리가 추가로 복구할 수 있는 종류인지 구분한다.
3. 대응 방향
   - 자동 복구 가능한 케이스면 로직 추가
   - 자동 복구 불가능한 케이스면 raw 에러 대신 이유와 다음 조치를 TUI에 명시
   - 가능하면 `firebase-debug.log` 경로도 함께 안내
4. 완료 기준
   - 동일 실패에서 사용자가 `왜 안 되는지`를 바로 이해할 수 있다.
   - `pnpm verify` 통과

## 현재 Firebase Functions 배포 실패 원인 분리 작업
1. Firebase project 연결 이후 `firebase deploy --only functions`도 실제 계정 상태나 플랜, API 활성화 상태에 따라 실패할 수 있다.
2. 먼저 `firebase-debug.log` 기준으로 실패 유형을 분리한다.
   - Blaze 플랜 미가입
   - Cloud Build / Artifact Registry / Functions API 미활성
   - 권한 부족
3. 대응 방향
   - 자동 복구 가능한 케이스면 안내 또는 선행 명령 추가
   - 자동 복구가 어려운 케이스면 TUI에서 이유와 다음 조치를 명시
4. 완료 기준
   - Functions deploy 실패 시 raw 종료 대신 원인 중심 메시지가 나온다.
   - `pnpm verify` 통과

## 현재 Firebase Functions build service account 안내 보강 작업
1. 실제 Yarn Firebase 배포는 이제 source analysis와 업로드 단계까지 통과하지만, 원격 Cloud Build에서 `missing permission on the build service account`로 실패할 수 있다.
2. 이 단계는 로컬 PnP나 packageExtensions 문제가 아니라 Google Cloud IAM/조직 정책 문제이므로, CLI가 그 차이를 명확히 설명해야 한다.
3. 대응 방향
   - `firebase-debug.log` 기준으로 build service account 권한 부족/비활성 상태를 분리한다.
   - Cloud Build 콘솔 URL이 있으면 그대로 노출한다.
   - 공식 문서 기준으로 다음 조치를 안내한다.
     - custom build service account 사용
     - default Compute Engine service account에 `roles/cloudbuild.builds.builder` 부여
     - Cloud Build default service account 변경 가이드 확인
4. 완료 기준
   - 동일 실패에서 "로컬 Yarn 문제"가 아니라 "원격 IAM 문제"라는 점이 바로 드러난다.
   - `pnpm verify` 통과

## 현재 Firebase 오류 상세 로그 노출 보강 작업
1. Firebase Functions deploy 실패 시 현재 메시지는 요약은 되지만, 사용자가 실제 어떤 줄에서 실패했는지 바로 보기 어렵다.
2. 대응 방향
   - 원인 요약 아래에 raw CLI 에러 본문을 같이 붙인다.
   - `firebase-debug.log`가 있으면 마지막 핵심 몇 줄도 같이 노출한다.
   - 여전히 debug log 전체 경로는 유지해서 더 깊은 확인도 가능하게 한다.
3. 완료 기준
   - 사용자 메시지 하나만 보고도 실패 원인 문자열과 관련 로그 URL을 확인할 수 있다.
   - `pnpm verify` 통과

## 현재 Firebase Functions build output root ignore 보강 작업
1. Firebase provider는 `server/functions/lib` 빌드 산출물을 만들 수 있는데, 현재 루트 `biome check --write --unsafe`가 이 파일까지 검사해서 실패할 수 있다.
2. 이 산출물은 루트에서 관리할 대상이 아니라 Firebase functions workspace의 build artifact다.
3. 대응 방향
   - 공통 템플릿은 건드리지 않고 Firebase provider patch에서만 루트 `.gitignore`와 `biome.json` ignore에 `server/functions/lib`를 추가한다.
   - 회귀 테스트로 Firebase일 때만 ignore가 생기는지 고정한다.
4. 완료 기준
   - Firebase 스캐폴드 뒤 루트 biome가 `server/functions/lib` 때문에 깨지지 않는다.
   - `pnpm verify` 통과

## 현재 Firebase predeploy install 누락 수정 작업
1. Firebase provider의 `server/firebase.json`은 현재 `functions.predeploy`에서 `build`만 실행한다.
2. 실제 `firebase deploy --only functions`는 이 `predeploy`를 직접 호출하므로, `server/functions` 의존성이 아직 설치되지 않은 첫 배포에서는 `Cannot find module 'firebase-functions'`로 바로 실패할 수 있다.
3. 대응 방향
   - `firebase.json`의 `predeploy`를 package manager별 `install && build`로 바꾼다.
   - pnpm / yarn 둘 다 template 테스트로 고정한다.
4. 완료 기준
   - 첫 Firebase Functions 배포에서 predeploy가 `functions` install 이후 build를 수행한다.
   - `pnpm verify` 통과

## 현재 Firebase nested functions install 실패 원인 분리 작업
1. `firebase.json` predeploy를 `install && build`로 바꿨는데도, pnpm 기준으로는 `server/functions`에 `node_modules`가 생기지 않아 `firebase-functions` 해석이 계속 실패하고 있다.
2. 이 이슈는 `firebase-tools` 실행 경로와 별개로, nested `server/functions` package에 대한 package manager install 방식이 잘못됐을 가능성이 높다.
3. 대응 방향
   - 실제 생성물에서 `pnpm --dir server/functions install`과 유사 명령을 재현해 본다.
   - parent workspace 영향인지, pnpm nested package 제약인지, 실행 경로 문제인지 분리한다.
   - 원인에 따라 `predeploy`/`server` scripts를 `npx` 또는 다른 install strategy로 바꾼다.
4. 완료 기준
   - pnpm Firebase functions 경로에서 install 후 실제 dependency 해석이 가능하다.
   - `pnpm verify` 통과

## 현재 Firebase Blaze 플랜 게이트 작업
1. Firebase Functions 2nd gen 배포는 Blaze 플랜(활성 billing account)이 필요하므로, 새 Firebase 프로젝트를 만들거나 기존 프로젝트를 고른 직후 이를 확인해야 한다.
2. 사용자가 Spark 프로젝트를 골랐거나 billing account가 비활성이면, Firebase Web App 생성이나 Functions deploy로 넘어가면 안 된다.
3. 대응 방향
   - `gcloud billing projects describe <projectId> --format=json`로 `billingEnabled`를 확인한다.
   - `billingEnabled: false`면 Blaze 업그레이드 URL과 billing 확인 문서를 출력한다.
   - 사용자가 `확인했나요?`에서 다시 확인을 고르면 재조회하고, 여전히 false면 계속 그 자리에서 멈춘다.
   - `gcloud`가 없거나 권한이 없으면 설치/인증 안내와 함께 중단한다.
4. 완료 기준
   - Firebase project 선택/생성 뒤 Blaze 플랜이 아니면 다음 단계로 진행하지 않는다.
   - `pnpm verify` 통과

## 현재 gcloud auth 만료 자동 복구 작업
1. 로컬에 `gcloud`를 자동 설치해도, `billing projects describe`에서 `invalid_grant`나 만료된 토큰 때문에 바로 실패할 수 있다.
2. 이 경우 사용자가 PATH에 없는 `gcloud`를 직접 실행하려 하면 다시 막히므로, CLI 안에서 설치된 `gcloud` 경로로 `auth login`을 바로 이어서 태우는 게 맞다.
3. 대응 방향
   - `invalid_grant`, `Please run: gcloud auth login`, `gcloud config set account` 패턴을 auth refresh 오류로 분류
   - 설치된 `gcloud` binary로 `gcloud auth login` 실행
   - 성공 후 `billing projects describe` 재시도
4. 완료 기준
   - `invalid_grant`에서 CLI가 곧바로 죽지 않고 `gcloud auth login` 후 재확인한다.
   - `pnpm verify` 통과

## 현재 Firebase build service account IAM 자동 보정 작업
1. Blaze 플랜 확인은 사용자가 직접 해야 하지만, Firebase Functions deploy에 필요한 기본 build service account IAM role은 CLI에서 자동으로 맞출 수 있다.
2. 현재는 deploy 실패 후에야 문서 링크와 수동 명령을 안내하지만, 이 권한은 project 선택 직후 선행 보정하는 편이 더 자연스럽다.
3. 대응 방향
   - Blaze 확인 직후 `gcloud projects describe`로 project number를 조회한다.
   - default Compute Engine service account에 필요한 role이 있는지 `gcloud projects get-iam-policy`로 확인한다.
   - 누락 시 `gcloud projects add-iam-policy-binding`으로 자동 부여한다.
   - `invalid_grant` 같은 gcloud auth 만료는 기존처럼 자동 `gcloud auth login` 후 재시도한다.
4. 완료 기준
   - Firebase Functions deploy 전에 필요한 기본 IAM role이 자동으로 보정된다.
   - `pnpm verify` 통과

## 현재 Firebase pnpm Functions Framework 누락 수정 작업
1. Cloud Run functions build는 `pnpm-lock.yaml`가 있는 Node.js 함수 소스에서 `@google-cloud/functions-framework`를 명시 dependency로 요구한다.
2. 현재 Firebase functions 템플릿은 `firebase-admin`, `firebase-functions`만 넣고 있어, 원격 build에서 `pnpm add @google-cloud/functions-framework`를 요구하며 실패한다.
3. 대응 방향
   - Firebase functions package 템플릿에 `@google-cloud/functions-framework` dependency를 추가한다.
   - 템플릿 테스트로 고정한다.
4. 완료 기준
   - Firebase functions 배포에서 Functions Framework 누락 에러가 재발하지 않는다.
   - `pnpm verify` 통과

## 현재 Yarn Firebase CLI 실행 경로 수정 작업
1. Yarn PnP 환경에서 `yarn dlx firebase-tools ...`는 임시 dlx project 내부 PnP 제약 때문에 실패할 수 있다.
2. 재현 로그 기준 원인
   - `@apphosting/build tried to access yaml, but it isn't declared in its dependencies`
3. 대응 방향
   - Firebase provider용 CLI 실행은 Yarn일 때 `npx firebase-tools ...`로 우회한다.
   - 기존 package manager 선택과 무관하게, Firebase CLI 자체만 안정적인 실행 경로를 쓴다.
4. 완료 기준
   - Yarn 프로젝트에서 Firebase CLI 단계가 `yarn dlx firebase-tools` 대신 PnP 비의존 경로를 사용한다.
   - `pnpm verify` 통과

## 현재 Firebase Functions TypeScript lib check 완화 작업
1. Firebase Functions build는 third-party declaration file까지 검사할 필요가 없다.
2. 재현 로그 기준 현재 실패는 `@firebase/app-types/index.d.ts` 내부의 `@firebase/logger` 해석 문제다.
3. 작은 TypeScript 재현으로 `skipLibCheck: true`면 이 종류의 오류가 사라지는 것을 확인했다.
4. 대응 방향
   - Firebase functions 전용 `tsconfig.json`에 `skipLibCheck: true` 추가
   - 템플릿 테스트로 고정
5. 완료 기준
   - Yarn Firebase Functions build가 dependency `.d.ts` 때문에 멈추지 않는다.
   - `pnpm verify` 통과

## 현재 Yarn Firebase functions linker 조정 작업
1. Firebase CLI의 source analysis는 `functions` source directory에서 `firebase-functions` 실제 설치 위치를 찾으려는 경향이 있다.
2. Yarn PnP nested project는 build는 통과해도 deploy analysis에서 SDK 위치 탐색이 깨질 수 있다.
3. 대응 방향
   - `server/functions`가 Yarn일 때는 독립 nested project를 유지하되 `.yarnrc.yml`에 `nodeLinker: node-modules`를 둔다.
   - 루트는 그대로 PnP를 유지한다.
4. 완료 기준
   - Yarn Firebase functions source directory는 `node_modules` 기반으로 설치된다.
   - `pnpm verify` 통과

## 다음 provider 작업: Firebase 계획
1. `firebase`는 `frontend`/`backoffice`에 Firebase Web SDK 기본 bootstrap을 넣고, `server`는 Firebase Functions workspace로 두는 provider로 구현한다.
2. 이유
   - MiniApp에서도 결국 네트워크 계층은 `fetch`를 쓰므로 Firebase Web SDK를 쓰는 쪽이 기본 데이터 접근 모델과 더 잘 맞다.
   - RN용 Firebase 네이티브 SDK를 기본값으로 넣는 것보다 web SDK bootstrap이 더 가볍고 현재 Granite 정책에도 덜 부딪힌다.
   - Firebase provider의 가장 기본적인 클라이언트 연결면은 `app`, `firestore`, `storage`다.
   - 다만 서버측 권한 로직과 deploy 대상은 여전히 Firebase Functions workspace가 맡는다.
3. 1차 범위
   - `server-provider` registry에 `firebase` 추가
   - `create` / `--add` 흐름에서 Firebase project 선택/생성 IaC 추가
   - `server/`에 Firebase Functions workspace 생성
   - `frontend`/optional `backoffice`에 Firebase app / firestore / storage bootstrap 추가
   - `server/.env.local`에 Firebase project / region / credentials path 자리 추가
   - provider별 `server/README.md`에 Firebase용 운영 가이드 추가
4. 1차에서 의도적으로 제외
   - Firebase Auth 기본 bootstrap
   - Hosting 설정
   - Realtime Database bootstrap
   - Remote Config / Analytics 기본 bootstrap
5. 공식 CLI 기준
   - `firebase login`
   - `firebase projects:list --json`
   - `firebase projects:create <projectId>` 또는 기존 project 선택
   - `firebase init`으로 `server/`를 Firebase project directory로 초기화
   - `firebase deploy --only functions`
   - 필요 시 `firebase apps:create WEB` / `firebase apps:sdkconfig WEB`는 2차 검토
6. IaC 흐름
   - Firebase CLI 설치/로그인 상태 확인
   - 필요 시 `gcloud` 설치/로그인 확인
   - 기존 Firebase project 목록 조회
   - 기존 project 선택 또는 새 project 생성
   - 기존 function region 확인 또는 새 region 선택
   - `server/` Firebase workspace 생성 및 active project 연결
   - Functions deploy
   - Firebase Web app config를 확인할 수 있으면 `frontend/.env.local` / `backoffice/.env.local` 작성
   - `server/.env.local`에 `FIREBASE_PROJECT_ID`, `FIREBASE_FUNCTION_REGION`, `GOOGLE_APPLICATION_CREDENTIALS` 자리 작성
7. 서버 워크스페이스 형태
   - `functions/` TypeScript codebase
   - `firebase.json`
   - `.firebaserc`
   - 필요 최소한의 Firestore rules / indexes 파일은 2차 범위로 미룬다.
   - 루트 monorepo 원칙에 맞게 workspace 내부 lint/formatter 설정은 제거하거나 최소화한다.
8. `frontend` / `backoffice` bootstrap
   - Firebase Web SDK 중심 bootstrap을 쓴다.
   - `frontend`
     - Firebase env 타입 선언
     - `src/lib/firebase.ts`
     - `src/lib/firestore.ts`
     - `src/lib/storage.ts`
     - Granite env plugin patch
   - `backoffice`
     - Firebase env 타입 선언
     - `src/lib/firebase.ts`
     - `src/lib/firestore.ts`
     - `src/lib/storage.ts`
9. `server/.env.local`와 운영 스크립트
   - `FIREBASE_PROJECT_ID=`
   - `FIREBASE_FUNCTION_REGION=`
   - `GOOGLE_APPLICATION_CREDENTIALS=`
   - `deploy`: `firebase deploy --only functions`
   - `build`: functions TypeScript build
   - `emulators:start`: 필요 시 2차 범위
10. env 기본값
   - `frontend`
     - `MINIAPP_FIREBASE_API_KEY=`
     - `MINIAPP_FIREBASE_AUTH_DOMAIN=`
     - `MINIAPP_FIREBASE_PROJECT_ID=`
     - `MINIAPP_FIREBASE_STORAGE_BUCKET=`
     - `MINIAPP_FIREBASE_APP_ID=`
   - `backoffice`
     - `VITE_FIREBASE_API_KEY=`
     - `VITE_FIREBASE_AUTH_DOMAIN=`
     - `VITE_FIREBASE_PROJECT_ID=`
     - `VITE_FIREBASE_STORAGE_BUCKET=`
     - `VITE_FIREBASE_APP_ID=`
   - 필요하면 `MEASUREMENT_ID`는 2차 범위로 둔다.
11. 사용자 안내
   - `GOOGLE_APPLICATION_CREDENTIALS`가 비어 있으면 service account JSON 경로를 직접 넣으라고 마지막 note에 명시한다.
   - Firebase Web app config를 자동으로 못 얻으면 Firebase Console의 project settings / app config 경로를 안내한다.
12. `hot-updater` 참고 구현
   - `/Users/kimhyeongjeong/Desktop/code/hot-updater/plugins/firebase/iac/select.ts`
   - `/Users/kimhyeongjeong/Desktop/code/hot-updater/plugins/firebase/iac/index.ts`
   - project 선택/생성, region 선택, deploy, IAM 안내 흐름은 여기서 재사용 가능한 부분이 많다.
13. 구현 순서
   - `ServerProvider` 타입에 `firebase` 추가
   - CLI / help / tests에 `firebase` 선택지 추가
   - Firebase scaffold command 추가
   - Firebase provisioning module 추가
   - Firebase workspace patch + frontend/backoffice bootstrap 추가
   - README / tests 갱신
14. 테스트 범위
   - CLI가 `firebase` provider를 해석하는지 검증
   - command plan이 Firebase scaffold 단계를 넣는지 검증
   - provisioning finalizer가 Firebase web config를 env 파일에 쓰는지 검증
   - `server/.env.local`이 기존 `GOOGLE_APPLICATION_CREDENTIALS`를 보존하는지 검증
   - Firebase server patch가 README, scripts, cleanup을 적용하는지 검증
   - `frontend`/`backoffice` bootstrap이 `firebase/app`, `firestore`, `storage`를 바로 사용할 수 있는 구조인지 검증
15. 완료 기준
   - `create-miniapp --server-provider firebase`가 Functions 기반 server workspace와 Firebase app / firestore / storage bootstrap을 함께 제공한다.
   - `pnpm verify` 통과

## 현재 changeset / PR 설명 정리 작업
1. PR `#22`는 초기 Cloudflare provider 추가를 넘어서 provider별 IaC, env bootstrap, server README, root README 개편까지 포함하게 됐다.
2. 기존 changeset 한 줄 요약으로는 실제 변경 범위를 설명하지 못하므로, 사용자 관점 release note로 다시 쓴다.
3. PR 본문도 현재 구현 범위에 맞게 다시 정리한다.
   - provider adapter registry
   - Supabase / Cloudflare 인증 및 원격 리소스 선택/생성
   - frontend / backoffice / server env bootstrap
   - provider별 server README
   - root README 및 docs 컨텍스트 보강
4. 완료 기준
   - changeset이 두 패키지 patch 배포 범위를 자세히 설명한다.
   - PR 본문만 읽어도 현재 브랜치의 사용자 영향과 검증 범위를 이해할 수 있다.

## 현재 root README 포지셔닝 보강 작업
1. 루트 README의 첫 설명을 "MiniApp을 생성하는 CLI" 수준에서 끝내지 않고, Granite, `@apps-in-toss/framework`, TDS를 바로 활용할 수 있도록 컨텍스트를 patch하는 스캐폴딩 도구라는 점까지 드러낸다.
2. 공식 CLI 우선 원칙과 함께, 이 저장소가 실제로 덧입히는 가치가 무엇인지 README 앞부분에서 설명한다.
   - 루트 monorepo tooling
   - AI/engineering/product docs 컨텍스트
   - provider별 env/bootstrap patch
   - provider IaC 및 원격 리소스 연결
3. 생성 결과의 `docs/` 구조를 단순 나열이 아니라 용도 중심으로 설명한다.
   - `docs/ai`
   - `docs/engineering`
   - `docs/product`
4. Supabase/Cloudflare provider 설명에는 "server 생성"뿐 아니라 인증, 기존 리소스 선택, 새 리소스 생성, `.env.local` 작성까지 포함된 IaC 흐름이라는 점을 README에 명시한다.
5. 완료 기준
   - 루트 README만 읽어도 이 도구가 "공식 scaffold 위에 MiniApp 실행 컨텍스트와 provider IaC를 patch하는 도구"라는 점이 이해된다.
   - `pnpm verify` 통과
6. README 최상단에는 Cloudflare 생성/연결 흐름을 보여주는 GIF를 raw GitHub URL로 노출한다.

## 현재 provider 인증 스캐폴드 안정화 작업
1. `codex/server-provider-adapters-cloudflare` 브랜치 기준으로 Supabase 인증/프로비저닝 흐름을 Cloudflare provider 지원 위에 병합한다.
2. create 흐름의 실행 순서는 `frontend scaffold -> server scaffold -> provider provisioning -> optional backoffice scaffold -> patch/finalize`로 고정한다.
3. add 흐름의 실행 순서는 `optional server scaffold -> provider provisioning -> optional backoffice scaffold -> patch/finalize`로 고정한다.
4. provider 선택 뒤에는 `create|existing`를 따로 묻지 않고, 먼저 기존 리소스 목록을 가져온 다음 단일 선택 리스트로 보여준다.
5. 선택 리스트에는 기존 리소스들과 함께 `새로 만들기` 항목을 같이 넣는다.
6. `--server-project-mode`는 scripted override로만 유지하고, 인터랙티브 기본 흐름은 provider provisioning 단계의 단일 선택으로 처리한다.
7. Supabase CLI JSON 파싱은 `pnpm`/`yarn` 로그 노이즈가 섞여도 payload만 추출하도록 보강한다.
8. Supabase publishable key를 조회할 수 있으면 `create`/`existing`와 관계없이 `frontend/.env.local`과 optional `backoffice/.env.local`까지 자동 작성한다.
9. publishable key 조회에 실패한 경우에만 Supabase 대시보드 API 설정 URL과 `.env.local` 예시를 마지막 안내 메시지로 출력한다.
10. 자동 `.env.local` 작성이 들어간 기준으로 `frontend`/`backoffice` bootstrap에서 `.env.local.example` 생성은 제거한다.
11. 테스트 범위
   - create/add 실행 순서가 provider provisioning 위치를 보장하는지 검증
   - provider 선택 후 create/existing 추가 질문이 사라지는지 검증
   - Supabase 프로젝트 목록/생성 응답이 패키지 매니저 로그 노이즈가 있어도 파싱되는지 검증
12. 완료 기준
   - `pnpm verify` 통과
   - 변경사항을 PR `#22`에 올릴 수 있는 상태

## 현재 Supabase server 원격 운영 스크립트 작업
1. Supabase provider를 선택해 프로젝트를 연결한 경우 `server/.env.local`도 함께 세팅한다.
2. `server/.env.local`에는 적어도 `SUPABASE_PROJECT_REF`와 `SUPABASE_DB_PASSWORD` 자리를 유지한다.
3. 이미 `server/.env.local`이 있으면 사용자가 넣어둔 `SUPABASE_DB_PASSWORD`는 지우지 않고 보존한다.
4. `server/package.json`의 기본 SQL 반영 스크립트는 원격 기준 `db:apply`를 제공한다.
5. 원격 `db:apply`는 `server/.env.local`을 읽고 `supabase db push --linked --password ...`를 실행해야 한다.
6. 로컬용 명령은 필요할 때를 위해 별도 보조 스크립트로만 남기고, 기본 동선은 원격 push 기준으로 둔다.
7. `server/.env.local`의 `SUPABASE_DB_PASSWORD`가 비어 있으면 최종 안내 문구에서 사용자가 직접 채워 넣어야 한다는 점을 분명히 보여준다.
8. 테스트 범위
   - `applyServerPackageTemplate`가 Supabase 원격 `db:apply`와 helper 스크립트를 생성하는지 검증
   - `finalizeSupabaseProvisioning`가 `server/.env.local`을 만들고 기존 DB password를 보존하는지 검증
9. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare URL bootstrap 작업
1. Cloudflare provider도 원격 Worker 연결 흐름을 가진다.
   - `create`: 새 Worker를 배포하고 URL을 얻는다.
   - `existing`: 기존 Worker를 선택하고 URL을 얻는다.
2. Cloudflare는 `public key` 대신 배포된 `workers.dev` 기반 API URL을 `frontend/.env.local`과 optional `backoffice/.env.local`에 자동 작성한다.
3. 원격 URL 자동 작성이 의미 있으려면 local bootstrap도 같이 들어가야 한다.
   - `frontend`: `MINIAPP_API_BASE_URL` 타입 선언, Granite env plugin 주입, `src/lib/api.ts` 생성
   - `backoffice`: `VITE_API_BASE_URL` 타입 선언, `src/lib/api.ts` 생성
4. Cloudflare 원격 흐름은 `desktop/code/hot-updater/plugins/cloudflare/iac`의 Wrangler auth/account/subdomain 흐름을 참고한다.
   - Wrangler 로그인 상태 확인 및 필요 시 `wrangler login`
   - account 목록 조회 및 선택
   - existing일 때 Worker 목록 조회 및 선택
   - create일 때 Worker 이름 입력 후 deploy
   - account subdomain 조회 또는 필요 시 생성
   - script workers.dev subdomain 활성화
5. 테스트 범위
   - Cloudflare 선택 시 create/existing 연결 모드를 해석하는지 검증
   - Cloudflare bootstrap이 frontend/backoffice에 API env/client 파일을 생성하는지 검증
   - Cloudflare provisioning finalizer가 URL이 있을 때 `.env.local`을 쓰는지 검증
6. 완료 기준
   - `pnpm verify` 통과
   - Cloudflare provider도 생성 직후 frontend/backoffice에서 API base URL을 바로 쓸 수 있는 상태

## 현재 Cloudflare server 원격 운영 스크립트 작업
1. Cloudflare provider를 선택해 Worker를 연결한 경우 `server/.env.local`도 함께 세팅한다.
2. `server/.env.local`에는 적어도 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKER_NAME`, `CLOUDFLARE_API_BASE_URL` 자리를 유지한다.
3. 이미 `server/.env.local`이 있으면 사용자가 넣어둔 `CLOUDFLARE_API_TOKEN` 같은 비밀값은 지우지 않고 보존한다.
4. `server/package.json`에는 원격 Worker 재배포용 기본 `deploy` 스크립트를 제공한다.
5. 원격 `deploy`는 `server/.env.local`을 읽고 `wrangler deploy --env-file ./.env.local --name ...`를 실행해야 한다.
6. 테스트 범위
   - `patchCloudflareServerWorkspace`가 원격 `deploy` 스크립트와 helper 파일을 생성하는지 검증
   - `finalizeCloudflareProvisioning`가 `server/.env.local`을 만들고 기존 API token을 보존하는지 검증
7. 완료 기준
   - `pnpm verify` 통과

## 현재 provider 인증 기반 스캐폴드 연동 작업
1. `--provision` 같은 별도 단계는 두지 않고, `server` provider를 생성/추가하는 `create`와 `--add` 흐름 안에서 인증과 원격 프로젝트 선택/생성을 함께 처리한다.
2. provider UX는 공통으로 맞춘다.
   - `server` provider 선택 후 기존 프로젝트 사용 / 새 프로젝트 생성 여부를 묻는다.
   - 기존 프로젝트를 쓰면 인증 후 프로젝트 목록을 띄워 선택한다.
   - 새 프로젝트를 만들면 provider 공식 CLI나 API를 통해 생성한다.
3. Supabase는 `desktop/code/hot-updater/plugins/supabase/iac` 흐름을 참고해 구현한다.
   - 로그인 상태 확인 및 필요 시 `supabase login`
   - 프로젝트 목록 조회 및 선택
   - 새 프로젝트 생성 후 재조회
   - API key 조회
   - local `supabase link`와 `db push`
   - `frontend`/optional `backoffice` env 파일 작성 또는 마지막 안내 메시지 출력
4. Cloudflare는 `desktop/code/hot-updater/plugins/cloudflare/iac` 흐름을 참고해 구현한다.
   - Wrangler OAuth 토큰 재사용 및 필요 시 `wrangler login`
   - account 목록 조회 및 선택
   - 필요 시 기존 Worker/R2/D1 선택 또는 새 리소스 생성
   - server workspace에 선택 결과를 반영한다.
5. 구조는 provider adapter에 provisioning lifecycle을 추가하는 방향으로 정리한다.
   - auth 확인
   - create/use-existing 선택
   - 원격 리소스 선택/생성
   - local workspace patch/link/env write
   - 최종 안내 메시지 생성
6. 테스트 범위
   - CLI가 provider provisioning 선택 입력을 해석하는지 검증
   - provider adapter가 create/add 시 provisioning 단계를 삽입하는지 검증
   - Supabase 기존/신규 프로젝트 선택 결과가 env/link 단계로 이어지는지 검증
   - Cloudflare 인증 토큰/계정 선택 결과가 Worker 설정 단계로 이어지는지 검증
7. 구현 순서
   - provider provisioning 타입/registry 추가
   - CLI 질문 흐름 확장
   - scaffold/add orchestration에 provisioning 실행 삽입
   - Supabase 구현
   - Cloudflare 구현
   - README와 테스트 갱신

## 현재 root workspace manifest 동적화 작업
1. 루트 workspace 등록은 고정 템플릿이 아니라 실제 생성된 workspace 목록 기준으로 계산한다.
2. 초기 생성 시점에는 `frontend`와 선택된 `server`/`backoffice`만 root manifest에 등록한다.
3. `--add`로 `server`나 `backoffice`를 나중에 추가할 때는 root manifest에도 해당 workspace를 함께 추가한다.
4. `yarn`은 root `package.json.workspaces`, `pnpm`은 `pnpm-workspace.yaml`을 각각 동적으로 맞춘다.
5. 테스트 범위
   - frontend-only 생성 시 root manifest에 `frontend`만 들어가는지 검증
   - 선택된 workspace만 root manifest에 들어가는지 검증
   - add mode에서 새 workspace 추가 후 root manifest가 갱신되는지 검증
6. 릴리스 후속 작업
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates`를 같은 patch changeset에 넣어 함께 배포한다.

## 현재 server provider adapter + Cloudflare 작업
1. `supabase` 하드코딩 분기를 provider adapter registry로 추출한다.
2. `commands`, `scaffold`, `workspace-inspector`, `cli`는 provider registry를 source of truth로 쓰게 바꾼다.
3. `cloudflare` provider를 추가한다.
   - 공식 scaffold는 Cloudflare C3 비대화형 명령을 사용한다.
   - 초기 템플릿은 Worker only + TypeScript 기준으로 생성한다.
4. Cloudflare server workspace 후처리
   - root orchestration에 맞게 `build`, `typecheck` 스크립트를 보강한다.
   - workspace 내부의 `.gitignore`, `.prettierrc`, `.editorconfig`, `.vscode`, `AGENTS.md` 등 중복 하네스/툴링 파일은 제거한다.
   - `wrangler.jsonc`의 `$schema`는 local `node_modules` 경로 대신 remote pinned URL로 정규화한다.
5. Supabase provider는 기존 frontend/backoffice bootstrap 동작을 유지한다.
6. 테스트 범위
   - provider registry가 CLI 선택지와 명령 계획에 반영되는지 검증
   - `supabase`/`cloudflare` create/add command plan이 각각 맞는 CLI를 쓰는지 검증
   - workspace inspector가 기존 server provider를 marker file로 감지하는지 검증
   - Cloudflare server patch가 build/typecheck 스크립트와 cleanup을 적용하는지 검증
7. 릴리스 후속 작업
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates`를 같은 patch changeset에 넣어 함께 배포한다.

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
6. 생성 결과물의 툴체인은 루트 `package manager + nx + biome` 기준으로 맞추고, 내부 워크스페이스는 lint/format 설정을 제거하거나 추가하지 않는다.

## 템플릿 범위
1. `packages/scaffold-templates/root/package.json`
2. `packages/scaffold-templates/root/pnpm-workspace.yaml`
3. `packages/scaffold-templates/root/pnpm.gitignore`
4. `packages/scaffold-templates/root/yarn.gitignore`
5. `packages/scaffold-templates/root/pnpm.biome.json`
6. `packages/scaffold-templates/root/yarn.biome.json`
7. `packages/scaffold-templates/root/nx.json`
8. `packages/scaffold-templates/root/*.project.json`
9. `packages/scaffold-templates/base/AGENTS.md`
10. `packages/scaffold-templates/base/docs/ai/Plan.md`
11. `packages/scaffold-templates/base/docs/ai/Status.md`
12. `packages/scaffold-templates/base/docs/ai/Implement.md`
13. `packages/scaffold-templates/base/docs/ai/Decisions.md`
14. `packages/scaffold-templates/base/docs/ai/Prompt.md`
15. `packages/scaffold-templates/base/docs/product/기능명세서.md`
16. Granite/TDS 참조 안내 문서

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
   - `packages/scaffold-templates/root/*` 기반으로 root `package.json`, `pnpm-workspace.yaml`, `nx.json`, `biome.json` 생성
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

## 현재 package manager 확장 작업
1. 생성 시작 시 `pnpm` 또는 `yarn`을 선택할 수 있게 하고, 이 선택이 전체 scaffold 흐름의 source of truth가 되게 만든다.
2. 기존 `pnpm` 전용 실행 플로우는 `PackageManagerAdapter` 같은 인터페이스로 추상화한다.
3. `yarn`은 같은 인터페이스를 구현하되, 생성 명령, 의존성 설치, `dlx`/`exec`, 루트 install, workspace 실행 명령을 모두 해당 adapter가 반환하게 한다.
4. 선택 순서
   - 인터랙티브에서는 package manager 선택을 가장 먼저 받는다.
   - 그 다음 `appName`, `displayName`, `server provider`, `backoffice` 여부 순으로 이어진다.
   - CLI 옵션으로도 `--package-manager <pnpm|yarn>`을 지원한다.
5. 추상화 대상
   - `packages/create-rn-miniapp/src/commands.ts`의 공식 CLI 실행 명령
   - `packages/create-rn-miniapp/src/scaffold.ts`의 루트 install / biome 실행 단계
   - `packages/create-rn-miniapp/src/templates.ts`의 root 템플릿 파일 선택
   - `packages/create-rn-miniapp/src/patch.ts`의 manager별 lockfile / workspace artifact 정리
   - `packages/scaffold-templates/root/*`의 root `package.json`, workspace 정의, Nx target command, server package scripts
   - CLI help / README / 문서 템플릿의 사용자 안내 문구
6. 설계 방향
   - `pnpm`과 `yarn`이 공통으로 필요한 동작은 adapter 메서드로 고정한다.
     - `install`
     - `add`
     - `exec`
     - `dlx`
     - `createGraniteApp`
     - `createViteApp`
     - `workspaceRun`
   - root 템플릿은 공통 파일과 manager 전용 파일로 나누거나, manager 토큰으로 조건부 생성한다.
   - `yarn`은 Berry + `nodeLinker: pnp`를 명시적으로 사용하는 기준으로 지원한다.
7. 우선 확인할 리스크
   - `yarn dlx`는 Yarn Berry 기준이라 classic 1.x를 지원할지 여부를 명확히 해야 한다.
   - `pnpm-workspace.yaml`은 Yarn에서 제거되어야 하고, 대신 root `package.json`의 `workspaces`와 `.yarnrc.yml`이 필요할 수 있다.
   - workspace 내부에서 생성되는 `pnpm-lock.yaml`, `yarn.lock` 등 manager별 잔여 lockfile 정리 정책이 달라진다.
   - README, AGENTS, generated docs의 `pnpm verify` 표현을 manager 선택과 어떻게 공존시킬지 기준이 필요하다.
8. yarn pnp 안정화
   - `yarn` + `nodeLinker: pnp`에서 Granite dev server가 막히지 않도록 `.yarnrc.yml`에 필요한 `packageExtensions`를 템플릿으로 제공한다.

## 현재 frontend env/codegen 정리 작업
1. `frontend/granite.config.ts` 코드젠 결과에 import 블록, env bootstrap 블록, `defineConfig` 사이 개행을 넣어 읽기 쉽게 만든다.
2. `frontend/src/lib/supabase.ts`는 `process.env` fallback을 제거하고 `import.meta.env`만 source of truth로 사용한다.
3. `frontend/granite.config.ts`에서 `process`, `__dirname`, `node:path`를 사용할 때 타입 오류가 나지 않도록 Node 타입 설정을 보강하되, 파일 상단 triple-slash reference는 넣지 않는다.
4. `frontend/tsconfig.json`은 `compilerOptions.module = "esnext"`를 유지하면서 `types`에 `node`를 포함하도록 JSON AST로 patch한다.
5. `frontend/package.json`에는 `@types/node`를 workspace devDependency로 보강한다.
6. 테스트 범위
   - `granite.config.ts` 출력에 triple-slash reference 없이 개행이 들어가는지 검증
   - `frontend/src/lib/supabase.ts`에서 `process.env`가 제거되는지 검증
   - `frontend/tsconfig.json`에 `types: ["node"]`가 추가되는지 검증
7. Yarn SDK 후처리
   - `yarn` 선택 시 root install 뒤에 `yarn dlx @yarnpkg/sdks base`를 실행해 editor SDK를 생성한다.
   - 이 단계는 `pnpm`에는 추가하지 않고, `skipInstall`일 때도 실행하지 않는다.
8. 저장소 메타데이터
   - 루트 `LICENSE.md`를 MIT 텍스트로 추가해 저장소와 배포 패키지의 라이선스 문서를 명시한다.
8. 테스트 범위
   - CLI가 `--package-manager`를 파싱하고, 프롬프트 첫 단계에서 선택을 받는지 검증

## 현재 package.json 구조 patch 정리 작업
1. `package.json` 계열은 문자열 치환 대신 공용 구조 patch helper로 통일한다.
2. `granite.config.ts`처럼 TS/TSX AST가 필요한 파일과 달리, `package.json`은 JSON 구조 patch로 처리한다.
3. 루트 `package.json`과 각 workspace `package.json`이 같은 helper를 사용하게 맞춘다.
4. workspace patch에서는 객체 parse는 읽기/판단용으로만 쓰고, 최종 파일 write는 구조 patch helper를 거친다.
5. 테스트 범위
   - root `package.json`의 packageManager/workspaces/script merge 회귀가 없는지 검증
   - frontend/backoffice package patch 후 기존 의존성이 유지되는지 검증

## 현재 add mode 작업
1. 목표
   - 이미 생성된 miniapp 모노레포에 `server`나 `backoffice`를 나중에 추가할 수 있는 CLI 흐름을 만든다.
   - 새 리포 생성과 달리, 기존 루트 설정과 문서를 다시 덮어쓰지 않고 필요한 워크스페이스만 증설한다.
2. 지원 범위
   - 대상은 이 CLI가 만든 루트 구조이거나 그와 호환되는 monorepo로 한정한다.
   - `frontend/`가 이미 존재해야 한다.
   - 이번 범위에서는 `server`와 `backoffice` 추가만 지원한다.
   - `frontend` 재생성이나 임의 루트 마이그레이션은 범위 밖으로 둔다.
3. CLI 형태
   - 기존 기본 동작은 그대로 새 워크스페이스 생성으로 유지한다.
   - 새 옵션 `--add`를 추가한다.
   - `--add`와 함께 `--root-dir`를 추가하고 기본값은 현재 디렉터리로 둔다.
   - `--add`에서 `--with-server`, `--server-provider`, `--with-backoffice`는 “없으면 추가” 의미로 재해석한다.
4. add mode 입력 수집
   - package manager는 root `package.json.packageManager`에서 자동 감지한다.
   - `appName`은 `frontend/granite.config.ts`의 `defineConfig.appName`에서 읽는다.
   - `displayName`은 `frontend/granite.config.ts`의 `appsInToss.brand.displayName`에서 읽고, 없을 때만 프롬프트 fallback을 둔다.
   - 현재 포함된 워크스페이스 상태를 감지해 이미 존재하는 선택지는 기본적으로 비활성화하거나 skip한다.
5. 구현 경계
   - `cli.ts`
     - `mode`, `rootDir` 파싱 추가
     - `add` mode 전용 질문 흐름 추가
   - `workspace-inspector.ts` 신규
     - 기존 루트의 package manager, appName, displayName, server/backoffice 존재 여부를 읽는다.
     - `granite.config.ts`는 SWC AST로 읽는다.
   - `commands.ts`
     - 기존 create plan과 별도로 add plan builder를 추가한다.
     - 선택한 워크스페이스만 공식 CLI로 생성한다.
   - `scaffold.ts`
     - create path와 add path를 분리한다.
     - add path는 `ensureEmptyDirectory()`를 사용하지 않는다.
     - root install / yarn sdk / biome 단계는 기존과 같은 finalize plan을 재사용한다.
   - `patch.ts`
     - `server` 추가 시 `frontend`에 Supabase bootstrap이 없으면 같이 보강한다.
     - 기존에 `server`가 있는 상태에서 `backoffice`를 추가하면 backoffice에도 Supabase bootstrap을 넣는다.
   - `templates.ts`
     - root 템플릿 전체 재적용은 하지 않는다.
     - 필요한 `project.json`, `server/package.json`만 additive로 생성한다.
6. 핵심 판단
   - `pnpm-workspace.yaml`과 Yarn `workspaces`는 이미 `frontend`, `server`, `backoffice`를 모두 포함하도록 생성되므로 add mode에서 root workspace manifest를 수정할 필요는 없다.
   - `nx.json`, `biome.json`, `docs/`, `AGENTS.md`는 add mode에서 기본적으로 건드리지 않는다.
   - add mode는 “새 워크스페이스 추가”이지 “전체 루트 재동기화”가 아니다.
7. 작업 순서
   - 기존 루트 검사기 추가
   - CLI mode 분기 추가
   - add command plan / 실행기 추가
   - server 추가 시 frontend bootstrap 보강
   - backoffice 추가 시 existing server provider 연동
   - 테스트와 README 갱신
8. 테스트 범위
   - CLI가 `--add`, `--root-dir`를 해석하는지 검증
   - 루트 검사기가 package manager, appName, displayName, 기존 workspace 상태를 읽는지 검증
   - add plan이 이미 존재하는 workspace는 건너뛰고, 빠진 workspace만 생성하는지 검증
   - temp fixture 기준으로 `frontend-only -> add server`, `frontend-only -> add backoffice`, `frontend+server -> add backoffice` 흐름 검증
9. 완료 기준
   - 기존 생성물 루트에서 `create-miniapp --add --with-server` 또는 `--with-backoffice`가 동작한다.
   - 이미 존재하는 workspace를 다시 생성하려고 하지 않는다.
   - `pnpm verify` 통과
   - command plan이 `pnpm`과 `yarn`에서 각각 다른 명령을 생성하는지 검증
   - root template 결과물이 manager별로 올바른 파일 집합과 명령 문자열을 가지는지 검증
   - patch 단계가 manager별 lockfile과 artifact를 올바르게 정리하는지 검증
9. 완료 기준
   - 사용자가 `pnpm` 또는 `yarn`을 선택해 실제 스캐폴딩을 끝낼 수 있다.
   - generated root가 선택한 manager 기준으로 install, verify, Nx orchestration을 수행한다.
   - 기존 `pnpm` 플로우는 회귀 없이 유지된다.
10. 후속 정리
   - `pnpm` 버전은 `10.32.1`, `yarn` 버전은 `4.13.0` 기준으로 맞춘다.
   - root `biome.json`과 `.gitignore`는 공통 파일이 아니라 manager별 템플릿으로 분리한다.
   - `.pnp.*`, `.yarn/**` ignore는 `yarn` 생성물에만 들어가고, `pnpm` 생성물에는 들어가지 않게 한다.
   - root `package.json` AST patch가 기존 `devDependencies`를 지우지 않도록 회귀 테스트와 함께 보정한다.
   - GitHub Actions의 `pnpm/action-setup`는 루트 `packageManager`를 source of truth로 삼도록 `version` 고정을 제거한다.
   - `nx.json`과 `project.json`의 `$schema`는 더 이상 `node_modules` 상대 경로를 쓰지 않고, editor가 바로 읽을 수 있는 remote schema URL을 사용한다.
   - `yarn pnp`에서 Granite dev server가 막히지 않도록 `.yarnrc.yml`에 필요한 `packageExtensions`를 템플릿으로 제공한다.

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
4. 결과물 루트에 선택한 package manager + `nx` + `biome`가 설정된다. ✅
5. 내부 워크스페이스는 자체 lint/format 도구 없이 루트 오케스트레이션만 사용한다. ✅
6. 생성 직후 루트 `pnpm verify`가 동작한다. ✅
7. 이 저장소 안에는 source scaffold template가 남아 있지 않다. ✅
8. 공개 패키지 릴리스용 Changesets 흐름이 설정된다.
9. PR 검증과 main 릴리스 자동화용 GitHub Actions가 설정된다.

## 현재 Cloudflare Wrangler auth 경로 회귀 수정
1. `wrangler login` 이후 인증 토큰을 찾지 못하는 회귀를 수정한다.
2. 실제 Wrangler 4.73.0이 쓰는 auth 저장 위치와 포맷을 로컬에서 확인한다.
3. `desktop/code/hot-updater/plugins/cloudflare/iac/getWranglerLoginAuthToken.ts` 구현을 참고해 현재 reader를 교체하거나 보강한다.
4. 테스트 범위
   - 새로운 Wrangler auth 파일 포맷을 읽을 수 있는지 검증
   - 기존 fallback 경로도 계속 읽을 수 있는지 검증
5. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare account verify 에러 안내 개선
1. Cloudflare deploy 실패 시 API code 10034(이메일 미인증)를 별도 메시지로 안내한다.
2. Wrangler stderr를 읽어 사용자가 바로 다음 액션을 알 수 있게 URL과 원인을 포함한다.
3. 테스트 범위
   - code 10034 또는 verify-email-address 문구가 있으면 사용자 친화 메시지로 바뀌는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare workers.dev onboarding 순서 수정
1. Cloudflare Worker create 흐름에서 workers.dev subdomain 확보를 deploy 이전으로 옮긴다.
2. onboarding 미완료 에러는 별도 사용자 안내로 바꾼다.
3. 테스트 범위
   - workers.dev onboarding 경고 문구가 사용자 친화 메시지로 바뀌는지 검증
   - create 흐름이 deploy 전에 account subdomain을 확보하도록 순서를 고정하는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare workers.dev false negative 복구
1. `wrangler deploy`가 workers.dev onboarding 에러를 반환하더라도, Cloudflare API에서 account subdomain과 Worker 존재가 확인되면 false negative로 간주하고 계속 진행한다.
2. 실제로 account subdomain이 없을 때만 onboarding 안내를 유지한다.
3. 테스트 범위
   - onboarding 에러 + subdomain 존재 + worker 존재면 복구되는지 검증
   - onboarding 에러라도 subdomain 또는 worker가 없으면 복구하지 않는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare deploy script 정리
1. Cloudflare server `package.json`에서 중복인 `deploy:remote`를 제거하고 `deploy`만 남긴다.
2. 테스트 범위
   - Cloudflare server patch 결과에 `deploy`만 남는지 검증
3. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare API token 안내 보강
1. Cloudflare provision 완료 후 `server/.env.local`의 `CLOUDFLARE_API_TOKEN`이 비어 있으면 사용자가 직접 채워야 한다는 안내를 note에 포함한다.
2. 기존 token이 이미 있으면 불필요한 안내는 생략한다.
3. 테스트 범위
   - 성공 note에 token 입력 안내가 포함되는지 검증
   - 기존 token이 있으면 token 입력 안내가 생략되는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 provider별 server README 추가
1. Supabase server와 Cloudflare server에 provider별 `README.md`를 patch 단계에서 생성한다.
2. README에는 디렉토리 구조, 주요 스크립트, frontend/backoffice 연결 방식을 포함한다.
3. 테스트 범위
   - Supabase server patch 결과에 README가 생성되고 핵심 스크립트/연결 설명이 포함되는지 검증
   - Cloudflare server patch 결과에 README가 생성되고 핵심 스크립트/연결 설명이 포함되는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 Firebase projectId 중복 재시도
1. Firebase 새 프로젝트 생성 시 `projectId`가 이미 존재하면 흐름을 중단하지 않고 같은 세션에서 다시 입력받는다.
2. 중복 판별은 Firebase CLI stderr message를 구조적으로 분리해서 처리한다.
3. 테스트 범위
   - Firebase CLI error message에서 중복 projectId를 감지하는지 검증
   - 관련 사용자 안내 문구가 포함되는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 backoffice React best practices 문서 추가
1. root `AGENTS.md`는 짧게 유지하고, backoffice React 작업용 상세 가이드는 `docs/engineering/backoffice-react-best-practices.md`로 분리한다.
2. 문서 내용은 Vercel `react-best-practices`를 참고하되, Next.js server 전용 규칙은 제외하고 현재 스택인 Vite + React + TypeScript backoffice 기준으로 재구성한다.
3. `AGENTS.md`에는 새 문서를 가리키는 한 줄 인덱스만 추가한다.
4. `docs/index.md`에도 새 engineering 문서 링크를 추가한다.
5. 테스트 범위
   - docs-only 변경으로 `pnpm verify` 통과
6. 완료 기준
   - 생성되는 `AGENTS.md`와 `docs/index.md`에서 새 문서를 찾을 수 있다.

## 현재 optional workspace 문서 동적 생성
1. `backoffice`와 `server provider` 관련 engineering 문서는 더 이상 `base` 공통 템플릿에 두지 않는다.
2. `packages/scaffold-templates/optional/*` 아래에 backoffice 및 provider별 문서를 둔다.
3. create 시에는 최종 선택된 workspace와 provider 기준으로 optional docs를 복사하고 `AGENTS.md`, `docs/index.md`를 동기화한다.
4. `--add` 시에도 기존 문서를 덮어쓰지 않고, 필요한 optional docs만 추가하고 `AGENTS.md`, `docs/index.md` 인덱스만 보강한다.
5. 이전 버전 생성물처럼 marker가 없는 `AGENTS.md`, `docs/index.md`도 `--add`에서 보강 가능해야 한다.
6. 테스트 범위
   - frontend only면 backoffice/provider 문서와 링크가 생기지 않는지 검증
   - backoffice 선택 시에만 backoffice 문서와 링크가 생기는지 검증
   - server provider별로 해당 문서와 링크만 생기는지 검증
   - marker가 없는 예전 문서에도 optional 링크를 삽입할 수 있는지 검증
7. 완료 기준
   - `pnpm verify` 통과
