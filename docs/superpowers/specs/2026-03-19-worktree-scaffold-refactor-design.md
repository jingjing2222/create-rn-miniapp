# Worktree Scaffold Refactor Design

## Problem

현재 worktree opt-in 흐름은 scaffold가 `targetRoot`에 모든 파일을 생성한 뒤, 마지막에 `convertSingleRootToWorktreeLayout`으로 파일을 staging 디렉터리로 옮기고 bare repo를 만들고 다시 `main/`으로 이동하는 구조.

문제:
1. **파일 이동이 위험** — 수십~수백 개 파일을 rename하는 과정에서 실패하면 중간 상태로 남음, 롤백 없음
2. **프롬프트 타이밍이 늦음** — 모든 scaffold 작업이 끝난 뒤에 worktree 여부를 물어봄
3. **하네스 유도 부재** — worktree로 만들어도 `main/` 안의 AGENTS.md, 하네스-실행가이드에 worktree 워크플로우 안내가 없음

## Solution: "Scaffold into the right place from the start"

worktree 여부를 scaffold 시작 전에 확정하고, worktree면 bare repo + `main/` worktree를 먼저 세팅한 뒤, scaffold는 처음부터 `main/` 안에 파일을 생성한다. 파일 이동 로직(`convertSingleRootToWorktreeLayout`)은 완전 삭제.

추가로, worktree 환경에서의 하네스 문서를 기존 optional docs 패턴에 태워 삽입한다.

## Design

### Part 1: Worktree 결정을 scaffold 앞으로 이동

#### 1-1. `resolveCliOptions`에서 worktree 확정

`resolveCreateWorktreeLayout`의 로직을 `resolveCliOptions`(또는 그 안에서 호출)로 이동한다.

- `--worktree` 플래그 명시 → 그대로
- `--no-git` → false
- `--yes` → false (기본값)
- 그 외 → interactive prompt

결과: `ResolvedCliOptions.worktree`가 항상 `boolean` (더 이상 `boolean | undefined` 아님).

#### 1-2. `scaffoldWorkspace` 시작부 변경

```typescript
// before
const targetRoot = path.resolve(options.outputDir, options.appName)
let workspaceRoot = targetRoot
await ensureEmptyDirectory(targetRoot)

// after
const controlRoot = path.resolve(options.outputDir, options.appName)
await ensureEmptyDirectory(controlRoot)

let workspaceRoot: string

if (options.worktree && !options.noGit) {
  await initBareWorktreeLayout(controlRoot)
  workspaceRoot = path.join(controlRoot, MAIN_WORKTREE_DIRECTORY)
} else {
  workspaceRoot = controlRoot
}
```

이후 scaffold 본문의 `targetRoot` 참조를 `workspaceRoot`로 변경한다. 구체적으로:

- `mkdir(path.join(targetRoot, 'server'))` → `workspaceRoot`
- `buildCreateCommandPhases({ targetRoot })` → `workspaceRoot` (expo create 등의 cwd)
- `maybeWriteNpmWorkspaceConfig(path.join(targetRoot, 'frontend'))` → `workspaceRoot`
- `maybePrepareServerWorkspace({ targetRoot })` → `workspaceRoot`
- `applyRootTemplates(targetRoot, ...)` → `workspaceRoot`
- `maybePrepareTrpcWorkspace({ targetRoot })` → `workspaceRoot`
- `maybePatchServerWorkspace({ targetRoot })` → `workspaceRoot`
- `syncRootWorkspaceManifest(targetRoot, ...)` → `workspaceRoot`
- `maybeProvisionSupabaseProject({ targetRoot })` → `workspaceRoot`
- `maybeProvisionCloudflareWorker({ targetRoot })` → `workspaceRoot`
- `maybeProvisionFirebaseProject({ targetRoot })` → `workspaceRoot`
- `patchFrontendWorkspace(targetRoot, ...)` → `workspaceRoot`
- `patchBackofficeWorkspace(targetRoot, ...)` → `workspaceRoot`
- `applyDocsTemplates(targetRoot, ...)` → `workspaceRoot`
- `syncOptionalDocsTemplates(targetRoot, ...)` → `workspaceRoot`
- `maybeFinalizeSupabaseProvisioning({ targetRoot })` → `workspaceRoot`
- `maybeFinalizeCloudflareProvisioning({ targetRoot })` → `workspaceRoot`
- `maybeFinalizeFirebaseProvisioning({ targetRoot })` → `workspaceRoot`
- `buildRootFinalizePlan({ targetRoot })` → `workspaceRoot`

`controlRoot`는 리턴값과 `createWorktreeLayoutNote`에서만 사용한다.

#### 1-3. `worktree.ts` 변경

**삭제:**
- `convertSingleRootToWorktreeLayout` 함수 전체
- `WORKTREE_BOOTSTRAP_STAGING_DIR` 상수

**추가:**
```typescript
export async function initBareWorktreeLayout(controlRoot: string) {
  await runCommand({
    cwd: controlRoot,
    command: 'git',
    args: ['init', '--bare', '.bare'],
    label: 'worktree control root git 저장소 만들기',
  })
  await writeFile(path.join(controlRoot, '.git'), 'gitdir: ./.bare\n', 'utf8')
  await runCommand({
    cwd: controlRoot,
    command: 'git',
    args: ['worktree', 'add', '--orphan', MAIN_WORKTREE_DIRECTORY],
    label: '`main` worktree 만들기',
  })
  await writeControlRootShims(controlRoot)
}
```

**유지:**
- `resolveCreateWorktreeLayout` — `resolveCliOptions` 안에서 호출. 구체적으로:
  ```typescript
  // cli.ts resolveCliOptions() 끝부분, return 직전
  const worktree = await resolveCreateWorktreeLayout({
    prompt,
    noGit: argv.noGit ?? false,
    yes: argv.yes,
    explicitWorktree: argv.worktree,
  })
  return { ..., worktree }
  ```
  이로써 `ResolvedCliOptions.worktree`는 항상 `boolean`이 된다.
- `createWorktreeLayoutNote`
- `writeControlRootShims`
- `MAIN_WORKTREE_DIRECTORY`

#### 1-4. git 세팅 분기

scaffold 끝부분의 git 처리:

```typescript
// worktree가 아닌 경우에만 git init (worktree는 이미 세팅됨)
if (!options.noGit && !options.worktree) {
  for (const command of buildRootGitSetupPlan({ targetRoot: workspaceRoot })) {
    log.step(command.label)
    await runCommand(command)
  }
}
```

#### 1-5. 리턴 타입 변경

```typescript
return {
  controlRoot,  // 기존 targetRoot → controlRoot로 rename
  workspaceRoot,
  notes,
  worktree: options.worktree && !options.noGit,
}
```

`main()` (index.ts)에서 `result.workspaceRoot`를 최종 경로로 사용하는 건 현재와 동일.

### Part 2: Worktree 하네스 유도

기존 optional docs 패턴(`OptionalDocsOptions` → `resolveOptionalDocTemplates` → 마커 삽입)에 worktree를 추가한다.

#### 2-1. `OptionalDocsOptions` 확장

```typescript
export type OptionalDocsOptions = {
  hasBackoffice: boolean
  serverProvider: OptionalDocsServerProvider | null
  hasTrpc: boolean
  hasWorktree: boolean  // 추가
}
```

#### 2-2. 새 optional 템플릿 디렉터리

```
packages/scaffold-templates/optional/worktree/
  docs/engineering/worktree-workflow.md
```

`worktree-workflow.md` 내용:
- worktree 레이아웃 구조 설명 (control root vs main worktree)
- `wt add -c <branch> -b main`으로 새 작업 시작
- `wt status`, `wt pull` 사용법
- `wt remove <branch> -b`로 정리
- control root에서 직접 commit/push 금지

#### 2-3. `resolveOptionalDocTemplates` 확장

```typescript
if (options.hasWorktree) {
  templates.push({ templateDir: 'worktree' })
}
```

#### 2-4. `AGENTS.md` 마커 삽입

`renderOptionalAgentsSection`에 추가:
```typescript
if (options.hasWorktree) {
  lines.push(
    '- `docs/engineering/worktree-workflow.md`',
    '  - worktree 레이아웃에서 브랜치 생성, 동기화, 정리 흐름을 먼저 보는 문서',
  )
}
```

`renderOptionalGoldenRulesSection`에 추가:
```typescript
if (options.hasWorktree) {
  lines.push(
    'N. Worktree discipline: 새 작업은 `wt add`로 worktree를 만들어 시작하고, control root에서 직접 commit하지 않는다.',
  )
}
```

번호는 동적으로 결정한다. 현재 tRPC golden rule이 8번이므로, tRPC + worktree면 tRPC=8, worktree=9. worktree만이면 worktree=8. `renderOptionalGoldenRulesSection`에서 tRPC 줄이 있으면 그 뒤에, 없으면 단독으로 추가한다.

#### 2-5. `하네스-실행가이드.md`에 optional 마커 추가

base 템플릿의 `하네스-실행가이드.md` 14번 항목(브랜치 생성, 커밋, 브랜치 푸시, PR 생성) 부분에 마커 삽입:

```markdown
<!-- optional-worktree-workflow:start -->
<!-- optional-worktree-workflow:end -->
14. 브랜치 생성, 커밋, 브랜치 푸시, PR 생성 순으로 마무리한다.
```

worktree가 켜지면 마커 안에:
```markdown
14. `wt add -c <branch> -b main`으로 worktree를 만들고, 그 안에서 구현, 커밋, 푸시, PR 생성.
15. 작업이 끝나면 `wt remove <branch> -b`로 정리.
```

worktree가 켜지면 마커 안에 worktree 전용 단계가 들어가고, 기존 14번(single-root용)은 마커 뒤에서 **제거**된다. 구현: `replaceMarkedSection`으로 마커 내용을 채운 뒤, worktree가 활성화된 경우 기존 14번 줄을 별도로 제거하는 처리를 추가한다. worktree가 아니면 마커는 비어 있고 기존 14번이 그대로 보임.

#### 2-6. `docs/index.md`에 링크 추가

`renderOptionalDocsIndexSection`에:
```typescript
if (options.hasWorktree) {
  lines.push('- Worktree workflow: `engineering/worktree-workflow.md`')
}
```

#### 2-7. 호출부 변경

`syncOptionalDocsTemplates` 호출 시 `hasWorktree` 전달:

```typescript
await syncOptionalDocsTemplates(workspaceRoot, tokens, {
  hasBackoffice: ...,
  serverProvider: ...,
  hasTrpc: ...,
  hasWorktree: options.worktree && !options.noGit,
})
```

### Part 3: 테스트 변경

#### 3-1. `worktree.test.ts`

- `convertSingleRootToWorktreeLayout` 테스트 삭제
- `initBareWorktreeLayout` 테스트 추가:
  - `.bare` 디렉터리 생성 확인
  - `.git` 파일이 `gitdir: ./.bare`를 가리키는지 확인
  - `main/` 디렉터리 존재 확인
  - control root에 `AGENTS.md`, `README.md` shim 존재 확인
- `resolveCreateWorktreeLayout` 테스트는 유지 (호출 위치만 바뀜)

#### 3-2. `cli.test.ts`

- `resolveCliOptions`에서 worktree 결정이 이루어지는 테스트 추가
  - `--worktree` → `true`
  - `--no-git` → `false`
  - `--yes` → `false`
  - interactive → prompt 결과

#### 3-3. `templates/index.test.ts`

- `syncOptionalDocsTemplates`에 `hasWorktree: true`일 때:
  - `AGENTS.md`에 worktree-workflow.md 링크 삽입 확인
  - Golden Rules에 worktree discipline 삽입 확인
  - `docs/index.md`에 worktree 링크 삽입 확인

## Files Changed

| File | Change |
|------|--------|
| `src/cli.ts` | `resolveCliOptions`에서 worktree 결정 호출, `ResolvedCliOptions.worktree: boolean` |
| `src/index.ts` | `describeWorktreeSelection` 단순화 (undefined 분기 제거) |
| `src/scaffold/index.ts` | scaffold 시작부에 bare repo 세팅, `targetRoot` → `workspaceRoot` 치환, 파일 이동 로직 제거 |
| `src/scaffold/worktree.ts` | `convertSingleRootToWorktreeLayout` 삭제, `initBareWorktreeLayout` 추가 |
| `src/scaffold/types.ts` | `worktree: boolean` (optional 제거) |
| `src/templates/index.ts` | `OptionalDocsOptions.hasWorktree`, render 함수들 확장, 하네스-실행가이드 마커 처리 |
| `scaffold-templates/base/AGENTS.md` | 마커 위치 기존과 동일 (이미 있음) |
| `scaffold-templates/base/docs/engineering/하네스-실행가이드.md` | optional worktree 마커 추가 |
| `scaffold-templates/base/docs/index.md` | optional 마커 이미 있음 |
| `scaffold-templates/optional/worktree/docs/engineering/worktree-workflow.md` | 신규 |
| `src/scaffold/worktree.test.ts` | convert 테스트 → init 테스트로 교체 |
| `src/cli.test.ts` | worktree 결정 테스트 추가 |
| `src/templates/index.test.ts` | hasWorktree 테스트 추가 |

## Edge Cases

### `--worktree` + `--add`

`--add`는 이미 존재하는 workspace에 서버/백오피스를 추가하는 모드다. worktree 레이아웃 전환은 create 전용이므로, `--add`와 `--worktree`를 함께 쓰면 yargs validation error로 거부한다. `cli.ts`의 `parseCliArgs`에서 `.conflicts('add', 'worktree')` 추가.

### `addWorkspaces`의 `syncOptionalDocsTemplates` 호출

`OptionalDocsOptions`에 `hasWorktree`가 필수 필드가 되므로, `addWorkspaces`에서도 전달해야 한다. `addWorkspaces`는 이미 존재하는 workspace를 대상으로 하므로 `hasWorktree: false`를 전달한다. (기존 worktree 레이아웃의 workspace라도, `addWorkspaces`는 `main/` 안에서 동작하므로 하네스 문서 변경은 불필요.)

### `describeWorktreeSelection`의 `undefined` 분기

`ResolvedCliOptions.worktree`가 `boolean`이 되면 `undefined` 분기("마지막 git 단계 직전에 물어볼게요")는 dead code가 된다. 이 분기를 제거하고, `true`/`false`/`noGit` 세 가지만 남긴다.

### `git worktree add --orphan` 최소 버전

`--orphan` 플래그는 git 2.38+ 필요. `initBareWorktreeLayout` 시작 시 `git --version`을 체크하여 2.38 미만이면 명확한 에러 메시지를 보여준다:
```
worktree 레이아웃에는 git 2.38 이상이 필요해요. 현재: <version>
```

### Initial commit

worktree 경로에서는 `buildRootGitSetupPlan`(git init + symbolic-ref)을 건너뛰지만, 별도 initial commit을 만들지는 않는다. 이는 single-root 경로도 마찬가지 — `buildRootGitSetupPlan`은 `git init` + `symbolic-ref HEAD`만 하고 commit은 안 한다. 두 경로 모두 사용자가 첫 commit을 직접 하는 구조이므로, worktree 경로에서도 동일하게 유지한다.

## Not Changed

- `src/scaffold/orders.ts` — `buildRootGitSetupPlan`, `buildRootFinalizePlan` 그대로
- `src/workspace-inspector.ts` — 기존 worktree 감지 로직 그대로
- `addWorkspaces` — worktree 레이아웃 전환 로직 없음 (`hasWorktree: false` 전달만 추가)
