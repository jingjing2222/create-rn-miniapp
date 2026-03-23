import type { AddOptions, AddResult } from './context.js'
import { finalizeAddWorkspace } from './phases/finalize.js'
import { inspectAddWorkspace } from './phases/inspect.js'
import { patchAddWorkspace } from './phases/patch.js'
import { provisionAddWorkspace } from './phases/provision.js'
import { resolveAddContext } from './phases/resolve.js'
import { scaffoldAddWorkspace } from './phases/scaffold.js'

export async function runAdd(options: AddOptions): Promise<AddResult> {
  let ctx = await inspectAddWorkspace(options)

  ctx = await resolveAddContext(ctx)
  ctx = await scaffoldAddWorkspace(ctx)
  ctx = await provisionAddWorkspace(ctx)
  ctx = await patchAddWorkspace(ctx)
  ctx = await finalizeAddWorkspace(ctx)

  return {
    targetRoot: ctx.targetRoot,
    notes: ctx.notes,
  }
}
