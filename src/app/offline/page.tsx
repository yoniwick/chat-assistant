import Link from "next/link";

export const metadata = {
  title: "Offline",
  description: "You're offline",
};

export default function OfflinePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">{"You're offline"}</h1>
      <p className="text-sm text-[#8b949e] max-w-sm">
        This screen is cached so your installed app still opens. Reconnect to
        the internet to chat with your assistant.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-lg bg-[#4f8cff] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3f7ae6] transition-colors"
      >
        Try again
      </Link>
    </main>
  );
}