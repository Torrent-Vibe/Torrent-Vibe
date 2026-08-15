import type { DesiredStateOp, HelperReplica } from './types'

function replicaKey(replica: HelperReplica): string {
  return JSON.stringify([
    replica.id,
    replica.bangumiId,
    replica.title,
    replica.bangumiSubjectId ?? null,
    replica.subgroupId,
    replica.subgroupName,
    replica.rssUrl,
  ])
}

export function desiredStateDiff(
  desired: HelperReplica[],
  current: HelperReplica[],
): DesiredStateOp[] {
  const desiredById = new Map(desired.map(r => [r.id, r]))
  const currentById = new Map(current.map(r => [r.id, r]))
  const ops: DesiredStateOp[] = []

  for (const [id, currentReplica] of currentById) {
    const desiredReplica = desiredById.get(id)
    if (
      !desiredReplica
      || replicaKey(desiredReplica) !== replicaKey(currentReplica)
    ) {
      ops.push({ type: 'remove', id })
    }
  }

  for (const [id, desiredReplica] of desiredById) {
    const currentReplica = currentById.get(id)
    if (
      !currentReplica
      || replicaKey(desiredReplica) !== replicaKey(currentReplica)
    ) {
      ops.push({ type: 'add', replica: desiredReplica })
    }
  }

  return ops
}
