"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Invalid password");
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center min-h-screen">
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 w-full max-w-sm p-8 rounded-xl border border-[#1f2937] bg-[#11161d]"
      >
        <h1 className="text-xl font-semibold">Personal AI Assistant</h1>
        <p className="text-sm text-[#8b949e]">Enter your password to continue</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="px-3 py-2 rounded-lg bg-[#0b0f14] border border-[#30363d] text-sm focus:outline-none focus:border-[#4f8cff]"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[#4f8cff] text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}