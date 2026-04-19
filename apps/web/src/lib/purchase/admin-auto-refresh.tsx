"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AdminAutoRefreshProps {
  readonly intervalMs?: number;
}

export function AdminAutoRefresh({ intervalMs = 3_000 }: AdminAutoRefreshProps): null {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs, router]);

  return null;
}
