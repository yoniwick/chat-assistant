import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";

function getEnv(name) {
  const env = readFileSync(".env", "utf8");
  const match = env.match(new RegExp("^" + name + "=(.*)$", "m"));
  return match ? match[1].trim() : "";
}

const PASSWORD = getEnv("APP_PASSWORD");

async function auth() {
  const res = await fetch(BASE + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  console.log("POST /api/auth status:", res.status);
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  console.log("  cookie:", cookie ? "SET" : "MISSING");
  return cookie;
}

async function getConversations(cookie) {
  const res = await fetch(BASE + "/api/conversations", {
    headers: { Cookie: cookie || "" },
  });
  const body = await res.json().catch(() => ({}));
  const count = Array.isArray(body.conversations) ? body.conversations.length : "n/a";
  console.log("GET /api/conversations status:", res.status, "| count:", count);
}

async function createConversation(cookie) {
  const res = await fetch(BASE + "/api/conversations", {
    method: "POST",
    headers: { Cookie: cookie || "", "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  console.log("POST /api/conversations status:", res.status, "| id:", body.conversation?.id ?? "n/a");
  return body.conversation?.id;
}

async function chat(cookie, conversationId, message) {
  console.log("--- Chat test:", message, "---");
  const res = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { Cookie: cookie || "", "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, message }),
  });
  console.log("POST /api/chat status:", res.status, "| ctype:", res.headers.get("content-type"));
  const text = await res.text();
  const events = text.split("\n\n").filter((e) => e.includes("data:"));
  let content = "";
  for (const evt of events) {
    const data = JSON.parse(evt.replace("data: ", ""));
    if (data.delta) content += data.delta;
    if (data.error) console.log("  SSE error:", data.error);
  }
  console.log("  streamed chars:", content.length);
  console.log("  preview:", content.slice(0, 150).replace(/\n/g, " "));
  return content;
}

async function getHistory(cookie, conversationId) {
  const res = await fetch(BASE + "/api/conversations/" + conversationId, {
    headers: { Cookie: cookie || "" },
  });
  const body = await res.json().catch(() => ({}));
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  console.log("GET /api/conversations/[id] status:", res.status, "| messages:", msgs.length);
  for (const m of msgs) {
    console.log("  [" + m.role + "]", m.content.slice(0, 60).replace(/\n/g, " "), "| search:", m.searchUsed);
  }
}

async function testSearch(cookie, conversationId) {
  console.log("\n--- Web search test ---");
  const res = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { Cookie: cookie || "", "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId,
      message: "What is the latest stable version of Next.js?",
    }),
  });
  const text = await res.text();
  const events = text.split("\n\n").filter((e) => e.includes("data:"));
  let content = "";
  for (const evt of events) {
    const data = JSON.parse(evt.replace("data: ", ""));
    if (data.delta) content += data.delta;
    if (data.error) console.log("  SSE error:", data.error);
  }
  console.log("  search answer chars:", content.length);
  console.log("  preview:", content.slice(0, 200).replace(/\n/g, " "));
}

async function testMemories(cookie) {
  const res = await fetch(BASE + "/api/memories", {
    headers: { Cookie: cookie || "" },
  });
  const body = await res.json().catch(() => ({}));
  const mems = Array.isArray(body.memories) ? body.memories : [];
  console.log("\nGET /api/memories status:", res.status, "| memories:", mems.length);
  for (const m of mems) {
    console.log("  [" + m.kind + " " + m.importance + "] " + m.content);
  }
}

async function testGlobalSearch(cookie) {
  const res = await fetch(BASE + "/api/search?q=Next.js", {
    headers: { Cookie: cookie || "" },
  });
  const body = await res.json().catch(() => ({}));
  const hits = Array.isArray(body.results) ? body.results : [];
  console.log("\nGET /api/search?q=Next.js status:", res.status, "| hits:", hits.length);
  for (const h of hits.slice(0, 3)) {
    console.log("  [" + h.type + "] " + h.content.slice(0, 60).replace(/\n/g, " "));
  }
}

async function main() {
  const cookie = await auth();
  await getConversations(cookie);
  const id = await createConversation(cookie);
  if (!id) return;
  await chat(cookie, id, "Hello! What is 2+2?");
  await chat(cookie, id, "My name is Jonathan and I prefer PowerShell.");
  await testSearch(cookie, id);
  await getHistory(cookie, id);
  await testMemories(cookie);
  await testGlobalSearch(cookie);
}

main().catch((e) => console.error("FAILED:", e.message));
