const inertLockCounts = new Map<HTMLElement, number>();
const inertLockActive = new Set<HTMLElement>();

export function acquireInertLock(scope: HTMLElement): void {
  const count = inertLockCounts.get(scope) ?? 0;
  inertLockCounts.set(scope, count + 1);
  if (count === 0) {
    inertLockActive.add(scope);
    scope.setAttribute("inert", "");
  }
}

export function releaseInertLock(scope: HTMLElement): void {
  const count = inertLockCounts.get(scope);
  if (count === undefined) return;
  if (count <= 1) {
    inertLockCounts.delete(scope);
    inertLockActive.delete(scope);
    scope.removeAttribute("inert");
  } else {
    inertLockCounts.set(scope, count - 1);
  }
}
