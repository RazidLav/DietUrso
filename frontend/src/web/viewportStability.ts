type VisualViewportLike = {
  width: number;
  height: number;
  scale: number;
  addEventListener: (type: "resize" | "scroll", listener: () => void) => void;
  removeEventListener: (type: "resize" | "scroll", listener: () => void) => void;
};

type StableWindow = Window & { visualViewport?: VisualViewportLike | null };

const NORMAL_SCALE_TOLERANCE = 0.02;

function px(value: number) {
  return `${Math.max(1, Math.round(value))}px`;
}

/**
 * Reconciles the layout viewport with Safari's visual viewport after pinch zoom.
 * Zoom remains available; the correction only recenters the app when scale returns
 * to approximately 100%, avoiding residual horizontal and vertical page scrolling.
 */
export function installViewportStability(
  targetWindow: StableWindow = window as StableWindow,
  targetDocument: Document = document,
) {
  const root = targetDocument.documentElement;
  const body = targetDocument.body;
  const appRoot = targetDocument.getElementById("root");
  const visualViewport = targetWindow.visualViewport;
  let frame = 0;

  const resetDocumentScroll = () => {
    targetWindow.scrollTo(0, 0);
    root.scrollLeft = 0;
    root.scrollTop = 0;
    body.scrollLeft = 0;
    body.scrollTop = 0;
  };

  const reconcile = () => {
    frame = 0;
    const scale = visualViewport?.scale ?? 1;
    if (Math.abs(scale - 1) > NORMAL_SCALE_TOLERANCE) return;

    const width = visualViewport?.width ?? targetWindow.innerWidth;
    const height = visualViewport?.height ?? targetWindow.innerHeight;
    root.style.setProperty("--uf-app-viewport-width", px(width));
    root.style.setProperty("--uf-app-viewport-height", px(height));
    appRoot?.style.setProperty("--uf-app-viewport-width", px(width));
    appRoot?.style.setProperty("--uf-app-viewport-height", px(height));
    resetDocumentScroll();
  };

  const scheduleReconcile = () => {
    if (frame) targetWindow.cancelAnimationFrame(frame);
    frame = targetWindow.requestAnimationFrame(reconcile);
  };

  targetWindow.addEventListener("resize", scheduleReconcile, { passive: true });
  targetWindow.addEventListener("orientationchange", scheduleReconcile, { passive: true });
  targetWindow.addEventListener("pageshow", scheduleReconcile, { passive: true });
  visualViewport?.addEventListener("resize", scheduleReconcile);
  visualViewport?.addEventListener("scroll", scheduleReconcile);
  scheduleReconcile();

  return () => {
    if (frame) targetWindow.cancelAnimationFrame(frame);
    targetWindow.removeEventListener("resize", scheduleReconcile);
    targetWindow.removeEventListener("orientationchange", scheduleReconcile);
    targetWindow.removeEventListener("pageshow", scheduleReconcile);
    visualViewport?.removeEventListener("resize", scheduleReconcile);
    visualViewport?.removeEventListener("scroll", scheduleReconcile);
    root.style.removeProperty("--uf-app-viewport-width");
    root.style.removeProperty("--uf-app-viewport-height");
    appRoot?.style.removeProperty("--uf-app-viewport-width");
    appRoot?.style.removeProperty("--uf-app-viewport-height");
  };
}
