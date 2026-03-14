# Granite SSoT (Single Source of Truth)

- owner: miniapp engineering
- scope: `frontend` 라우팅, 페이지 구조, 검증 규칙
- last_verified: 2026-03-14

이 문서는 MiniApp `frontend`에서 반드시 지켜야 하는 규칙 문서입니다.
API 후보를 찾는 용도는 `appsintoss-granite-api-index.md`와 `appsintoss-granite-full-api-index.md`가 담당하고, 이 문서는 규칙과 금지/허용 기준만 정의합니다.

## 1) Routing Policy

### 원칙
1. MiniApp 라우트는 고정 path만 사용한다.
2. App Router 스타일 동적 세그먼트(`/$param`)를 금지한다.
3. 파라미터 전달은 `navigation.navigate('/fixed-path', { ... })`와 `createRoute(... validateParams ...)` 조합으로 처리한다.

### 금지 패턴
- `/$[a-zA-Z]` 형태 경로 문자열
- 파일명이나 라우트명에 `$` 세그먼트 사용
- 예시: `book.$bookId`, `$bookId.tsx`, `/book/$bookId`

### 허용 대안
- `/book-detail` 같은 고정 경로
- `navigation.navigate('/book-detail', { bookId })`
- `createRoute('/book-detail', { validateParams, component })`

## 2) Pages Structure Policy

### 원칙
- `frontend/pages/*`: entry layer
- `frontend/src/pages/*`: implementation layer

### 규칙
1. `frontend/pages/*`는 `frontend/src/pages/*`를 re-export하거나 얇은 entry만 유지한다.
2. 비즈니스 로직과 화면 구현은 `frontend/src/pages/*`에 둔다.
3. 엔트리 파일명과 구현 파일명은 고정 경로 정책과 정합해야 한다.

## 3) Validation Policy

작업 완료 전 아래를 모두 통과해야 한다.

1. `router.gen.ts` 동기화 확인
   - route key와 entry 파일 구조가 일치해야 한다.
2. 정적 검증
   - `pnpm verify`

## 4) Forbidden vs Allowed

| 분류 | 금지 | 허용 |
|---|---|---|
| route path | `/book/$bookId` | `/book-detail` |
| entry filename | `pages/book/$bookId.tsx` | `pages/book-detail.tsx` |
| impl filename | `src/pages/book/$bookId.tsx` | `src/pages/book-detail.tsx` |
| navigation | `navigate('/book/$bookId', ...)` | `navigate('/book-detail', { bookId })` |

## 5) Rule Catalog

### Forbidden patterns

| id | description | regex | targets |
|---|---|---|---|
| `route-dynamic-segment-dollar` | App Router style `$param` path is forbidden in MiniApp routes | `/$[a-zA-Z][a-zA-Z0-9_]*` | `frontend/pages/**/*.tsx`, `frontend/src/pages/**/*.tsx`, `frontend/src/**/*.ts`, `frontend/src/**/*.tsx` |
| `filename-dollar-pattern` | file or symbol names like `book.$bookId` are forbidden | `book\.\$[a-zA-Z][a-zA-Z0-9_]*|\$[a-zA-Z][a-zA-Z0-9_]*\.tsx` | `frontend/pages/**/*.tsx`, `frontend/src/pages/**/*.tsx` |

### Allowed alternatives

| id | examples |
|---|---|
| `fixed-path-routing` | `/book-detail`, `navigation.navigate('/book-detail', { bookId })` |
| `params-validation` | `createRoute('/book-detail', { validateParams, component })` |

### Required checks

| id | command | pass criteria |
|---|---|---|
| `router-sync` | `test -f frontend/src/router.gen.ts` | `router.gen.ts` exists and route keys match entry pages |
| `verify` | `pnpm verify` | exit code 0 |

### Required report evidence fields

- `task`
- `date`
- `branch`
- `commit`
- `changed_files`
- `checks`
- `granite_reference_sections`
- `applied_locations`
- `risks_or_followups`

## 6) References

- Quick API lookup: `./appsintoss-granite-api-index.md`
- Full API catalog: `./appsintoss-granite-full-api-index.md`
- Native modules policy: `./native-modules-policy.md`

## 7) Granite Reference Evidence

근거로 확인해야 하는 섹션:
- routing
- navigation
- params validation
- 생성 라우터(`router.gen.ts`)와 pages entry 연결 규칙
