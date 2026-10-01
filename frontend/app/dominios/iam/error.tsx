"use client";

import { useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import LoadingRadar from "@/app/components/radar/LoadingRadar";

export default function IamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[IAM Dashboard Error]:", error);
  }, [error]);

  const handleRetry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <main className="min-h-screen bg-umbra-bg text-umbra-ink flex flex-col items-center justify-center p-6">
      <LoadingRadar
        variant="fullscreen"
        error={error}
        onRetry={handleRetry}
      />
    </main>
  );
}
