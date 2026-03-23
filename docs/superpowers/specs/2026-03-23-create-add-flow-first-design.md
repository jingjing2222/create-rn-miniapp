# Create/Add Flow-First Refactor Design

## Goal

`packages/create-rn-miniapp/src`를 새로 읽는 사람이 `create`와 `add`의 실행 흐름부터 바로 따라갈 수 있게 재구성한다. 디렉토리 분리 자체보다 중요한 목표는 `src/index.ts`에서 시작해 `src/create/index.ts` 또는 `src/add/index.ts`로 내려가고, 그 아래에서 phase와 domain facade를 따라가며 흐름을 이해할 수 있게 만드는 것이다.

## Current Problem

- 현재 구조는 `scaffold/`, `providers/`, `patching/`, `templates/`가 이미 나뉘어 있지만, top-level에 orchestration/contract 파일이 많이 남아 있어 읽기 시작점이 흐려져 있다.
- 실제 생성 흐름은 `index.ts -> cli.ts -> scaffold/index.ts`로 이어지지만, create와 add가 한 coordinator 안에 함께 있어 두 흐름의 차이가 코드 구조에서 바로 드러나지 않는다.
- import 경계를 맞추기 위해 forwarding file이나 re-export를 늘리면 경로는 짧아질 수 있어도 흐름은 더 숨겨진다.

## Design Principles

1. 흐름 우선
   - `create`와 `add`는 각각 독립적인 메인 coordinator 파일을 가진다.
   - coordinator를 열면 phase 순서가 위에서 아래로 직접 보여야 한다.

2. 선언적 흐름
   - generic `runFlow()` 같은 추상화로 coordinator를 감추지 않는다.
   - 중복 10~20줄은 허용하고, 대신 각 흐름이 무엇을 먼저 하고 다음에 무엇을 하는지가 코드에 그대로 드러나야 한다.

3. domain facade
   - coordinator는 깊은 구현 파일을 직접 보지 않는다.
   - `phase -> domain facade -> implementation` 방향으로만 의존한다.

4. no forwarding re-export
   - `index.ts`를 제외한 re-export forwarding file은 만들지 않는다.
   - import 경로가 어색하면 re-export로 감추지 말고 파일 위치나 facade 경계를 다시 자른다.

## Target Structure

```text
packages/create-rn-miniapp/src/
  index.ts

  cli/
    index.ts
    parse.ts
    prompts.ts

  create/
    index.ts
    context.ts
    phases/
      resolve.ts
      scaffold.ts
      patch.ts
      provision.ts
      finalize.ts

  add/
    index.ts
    context.ts
    phases/
      inspect.ts
      resolve.ts
      scaffold.ts
      patch.ts
      provision.ts
      finalize.ts

  runtime/
    command-spec.ts
    commands.ts
    dedent.ts
    external-tooling.ts
    package-manager.ts
    structured-output.ts

  workspace/
    inspect.ts
    topology.ts
    root-workspaces.ts
    layout.ts

  server/
    client-contract.ts
    guide-assets.ts
    project-state.ts
    readme-cli-versions.ts
    script-catalog.ts

  skills/
    catalog-generator.ts
    contract.ts
    frontmatter.ts
    install.ts

  providers/
    index.ts
    shared.ts
    cloudflare/
      index.ts
      provision.ts
    firebase/
      index.ts
      provision.ts
    supabase/
      index.ts
      provision.ts

  patching/
  templates/
```

## Coordinator Rules

### `src/index.ts`

- CLI entry only.
- argument parsing과 모드 분기까지만 담당한다.
- 실제 create/add 실행은 각각 `src/create/index.ts`, `src/add/index.ts`로 위임한다.

### `src/create/index.ts`

- create 전용 흐름의 단일 진입점이다.
- `CreateContext`, `CreateResult`를 직접 소유한다.
- phase 순서를 coordinator 안에 직접 적는다.

대략 다음 형태를 목표로 한다.

```ts
export async function runCreate(input: CreateInput): Promise<CreateResult> {
  let ctx = await resolveCreateContext(input)

  ctx = await prepareCreateRoot(ctx)
  ctx = await scaffoldCreateFrontend(ctx)
  ctx = await scaffoldCreateOptionalServer(ctx)
  ctx = await scaffoldCreateOptionalBackoffice(ctx)
  ctx = await patchCreateWorkspaces(ctx)
  ctx = await provisionCreateServer(ctx)
  ctx = await finalizeCreateWorkspace(ctx)

  return toCreateResult(ctx)
}
```

### `src/add/index.ts`

- add 전용 흐름의 단일 진입점이다.
- `AddContext`, `AddResult`를 직접 소유한다.
- inspect/resolve 이후 missing workspace만 다루는 phase 순서를 그대로 보여준다.

```ts
export async function runAdd(input: AddInput): Promise<AddResult> {
  let ctx = await inspectAddWorkspace(input)

  ctx = await resolveAddContext(ctx)
  ctx = await scaffoldAddMissingWorkspaces(ctx)
  ctx = await patchAddedWorkspaces(ctx)
  ctx = await provisionAddedServer(ctx)
  ctx = await finalizeAddedWorkspace(ctx)

  return toAddResult(ctx)
}
```

## Dependency Direction

의존 방향은 다음으로 고정한다.

```text
src/index.ts
  -> src/cli/*
  -> src/create/index.ts | src/add/index.ts

src/create/index.ts | src/add/index.ts
  -> own phases/*

phases/*
  -> workspace/*, server/*, skills/*, runtime/*
  -> providers/index.ts
  -> patching/index.ts
  -> templates/index.ts or root-level facade

providers/index.ts
  -> providers/<provider>/index.ts
  -> providers/<provider>/provision.ts
```

중요한 제약은 coordinator가 `providers/cloudflare/provision.ts`, `patching/frontend.ts`, `templates/server.ts` 같은 깊은 구현 파일을 직접 import 하지 않는 것이다.

## Re-Export Policy

- `index.ts`만 entry/facade로 허용한다.
- non-index re-export file은 금지한다.
- pure forwarding facade는 금지한다.
- 경로 통일을 위해 파일을 추가하지 말고, 진짜 소유 위치를 옮긴다.

## Migration Strategy

1. outer entry split
   - `index.ts`에서 create/add 진입을 분리한다.
   - `scaffold/index.ts`의 create/add orchestration을 `create/index.ts`, `add/index.ts`로 이동한다.

2. shared domain relocation
   - 기존 top-level 파일을 `cli`, `runtime`, `workspace`, `server`, `skills`로 이동한다.
   - import 경로를 새 도메인 기준으로 정리한다.

3. facade tightening
   - `providers`, `patching`, `templates`에 외부 진입점을 정리한다.
   - coordinator와 phase가 깊은 구현 파일을 직접 보지 않게 만든다.

4. structure verification
   - import 방향과 re-export 금지 규칙을 테스트로 고정한다.
   - 기존 기능 검증은 `pnpm verify`로 유지한다.

## Success Criteria

- 새로 들어온 사람이 `src/index.ts`, `src/create/index.ts`, `src/add/index.ts`만 보고 흐름을 설명할 수 있다.
- create와 add의 차이가 파일 구조와 phase 순서 둘 다에서 드러난다.
- non-index forwarding re-export file이 없다.
- 기존 기능과 검증 계약은 `pnpm verify`로 그대로 통과한다.
