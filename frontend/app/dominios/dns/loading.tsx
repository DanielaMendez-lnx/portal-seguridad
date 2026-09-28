import LoadingRadar from "@/app/components/radar/LoadingRadar";

export default function DnsLoading() {
  return (
    <main className="min-h-screen bg-umbra-bg text-umbra-ink flex flex-col items-center justify-center p-6">
      <LoadingRadar variant="fullscreen" />
    </main>
  );
}
