import { useEffect } from "react";
import { subscribeCloudData } from "./cloudSync";

export function useCloudDataRefresh(refresh: () => void | Promise<void>) {
  useEffect(() => subscribeCloudData(() => void refresh()), [refresh]);
}
