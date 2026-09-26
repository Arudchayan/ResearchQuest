import { Suspense, useEffect, useState, type ReactNode } from "react";
import {
  isKeepAliveVisible,
  recordKeepAliveVisit,
  shouldMountKeepAlive,
  type KeepAliveView,
} from "../../lib/keepAlive";

interface KeepAlivePanesProps {
  currentView: string;
  notes: ReactNode;
  focus: ReactNode;
}

export function KeepAlivePanes({
  currentView,
  notes,
  focus,
}: KeepAlivePanesProps) {
  const [visited, setVisited] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setVisited((previous) => recordKeepAliveVisit(previous, currentView));
  }, [currentView]);

  return (
    <>
      <KeepAlivePane view="notes" currentView={currentView} visited={visited}>
        {notes}
      </KeepAlivePane>
      <KeepAlivePane view="focus" currentView={currentView} visited={visited}>
        {focus}
      </KeepAlivePane>
    </>
  );
}

function KeepAlivePane({
  view,
  currentView,
  visited,
  children,
}: {
  view: KeepAliveView;
  currentView: string;
  visited: ReadonlySet<string>;
  children: ReactNode;
}) {
  if (!shouldMountKeepAlive(view, currentView, visited)) {
    return null;
  }
  const visible = isKeepAliveVisible(view, currentView);
  return (
    <div hidden={!visible} {...(!visible ? { inert: true } : {})}>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
