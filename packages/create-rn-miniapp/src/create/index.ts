import type { CreateOptions, CreateResult } from './context.js'
import { finalizeCreateWorkspace } from './phases/finalize.js'
import { patchCreateWorkspace } from './phases/patch.js'
import { provisionCreateWorkspace } from './phases/provision.js'
import { resolveCreateContext } from './phases/resolve.js'
import { scaffoldCreateWorkspace } from './phases/scaffold.js'

export async function runCreate(options: CreateOptions): Promise<CreateResult> {
  let ctx = await resolveCreateContext(options)

  ctx = await scaffoldCreateWorkspace(ctx)
  ctx = await provisionCreateWorkspace(ctx)
  ctx = await patchCreateWorkspace(ctx)
  ctx = await finalizeCreateWorkspace(ctx)

  return {
    targetRoot: ctx.targetRoot,
    notes: ctx.notes,
  }
}
