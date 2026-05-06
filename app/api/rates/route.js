import { NextResponse } from "next/server";

// Server-side in-memory cache — avoids hammering frankfurter.app on every request
let serverCache = null;
let serverCachedAt = 0;
const TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  const now = Date.now();

  if (serverCache && now - serverCachedAt < TTL) {
    return NextResponse.json(serverCache);
  }

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR");
    const data = await res.json();
    const rates = { EUR: 1, ...data.rates };
    serverCache = rates;
    serverCachedAt = now;
    return NextResponse.json(rates);
  } catch {
    // Return stale cache if available rather than failing completely
    if (serverCache) return NextResponse.json(serverCache);
    return NextResponse.json({ error: "Failed to fetch rates" }, { status: 500 });
  }
}
