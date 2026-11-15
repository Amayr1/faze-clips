import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export function database() { if (!env.DB) throw new Error("Post storage is unavailable."); return env.DB; }
export function bucket() { if (!env.BUCKET) throw new Error("Video storage is unavailable."); return env.BUCKET; }
export async function writer(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("Invalid request origin.");
  const user = await getChatGPTUser();
  if (!user) throw new Error("Sign in with ChatGPT to post or like clips.");
  return user;
}
export function failure(error: unknown) { const message = error instanceof Error ? error.message : "Please try again."; return Response.json({error: message}, {status: message.startsWith("Sign in") ? 401 : message.includes("unavailable") ? 503 : 400}); }
