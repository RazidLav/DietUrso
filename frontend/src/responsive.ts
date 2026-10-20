import { AccessibilityInfo, Platform, useWindowDimensions } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { breakpoints } from "./theme";

export type LayoutMode = "phone" | "tablet" | "desktop";

export function resolveLayoutMode(width: number): LayoutMode {
  if (width >= breakpoints.desktop) return "desktop";
  if (width >= breakpoints.tablet) return "tablet";
  return "phone";
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const mode = resolveLayoutMode(width);
    return {
      width,
      height,
      mode,
      isPhone: mode === "phone",
      isTablet: mode === "tablet",
      isDesktop: mode === "desktop",
      isWide: width >= breakpoints.wide,
      landscape: width > height,
      columns: width >= 1180 ? 3 : width >= breakpoints.tablet ? 2 : 1,
    };
  }, [height, width]);
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    Platform.OS === "web" && typeof window !== "undefined" && "matchMedia" in window
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);

    if (Platform.OS === "web" && typeof window !== "undefined" && "matchMedia" in window) {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
      media.addEventListener?.("change", listener);
      return () => { mounted = false; subscription.remove(); media.removeEventListener?.("change", listener); };
    }

    return () => { mounted = false; subscription.remove(); };
  }, []);

  return reduced;
}
