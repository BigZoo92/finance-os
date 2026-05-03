/**
 * Pick the source/target pair for "Tracer entre les épinglés".
 *
 * Rules (as agreed in the spec):
 *   - the action requires at least 2 pinned nodes;
 *   - if the currently selected node is one of the pinned ones, it
 *     becomes the source;
 *   - the next pinned node (in pin order) that is not the source
 *     becomes the target;
 *   - if no selected pin matches, the first two pinned nodes are used.
 *
 * Returns `null` when the rules can't be satisfied (e.g. <2 visible pins).
 */
export const pickPinPathEndpoints = (
  pinnedIds: ReadonlyArray<string>,
  visibleIds: ReadonlySet<string>,
  selectedNodeId: string | null
): { fromId: string; toId: string } | null => {
  const visiblePins = pinnedIds.filter(id => visibleIds.has(id))
  if (visiblePins.length < 2) return null

  if (selectedNodeId !== null && visiblePins.includes(selectedNodeId)) {
    const target = visiblePins.find(id => id !== selectedNodeId)
    if (target !== undefined) return { fromId: selectedNodeId, toId: target }
  }

  const [fromId, toId] = visiblePins
  if (fromId === undefined || toId === undefined) return null
  return { fromId, toId }
}
