import type { DrawSnapshot } from "@lottery/domain";

export function selectSeedDrawSnapshots(
  existingSnapshots: readonly DrawSnapshot[],
  defaultSnapshots: readonly DrawSnapshot[]
): readonly DrawSnapshot[] {
  return existingSnapshots.length === 0 ? cloneDrawSnapshots(defaultSnapshots) : [];
}

function cloneDrawSnapshots(snapshots: readonly DrawSnapshot[]): readonly DrawSnapshot[] {
  return snapshots.map((snapshot) => ({
    ...snapshot,
    ...(snapshot.availableDraws
      ? {
          availableDraws: snapshot.availableDraws.map((draw) => ({ ...draw }))
        }
      : {})
  }));
}
