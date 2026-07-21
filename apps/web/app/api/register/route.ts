import { NextResponse } from "next/server";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const payload = await response.json().catch(() => ({}));
    const responseHeaders = new Headers();

    // Copy auth headers (cookies, auth tokens)
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "set-cookie" || lowerKey === "set-auth-token" || lowerKey === "set-auth-jwt") {
        responseHeaders.append(key, value);
      }
    });

    return NextResponse.json(payload, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("[REGISTRATION_PROXY_ERROR]", error);
    return NextResponse.json({ error: "Internal registration proxy error" }, { status: 500 });
  }
}
