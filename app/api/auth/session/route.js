import { NextResponse } from "next/server";
import { getServerSession, BACKEND_URL } from "@/lib/session";
import { fetchBackend } from "@/lib/backend-fetch";
import { detectEdgeBlock } from "@/lib/edge-block";
import { log429 } from "@/lib/log-429";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sin sesión" },
      { status: 401 }
    );
  }

  try {
    const meRes = await fetchBackend(`${BACKEND_URL}/api/user`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (meRes.ok) {
      const me = await meRes.json();
      return NextResponse.json({ success: true, data: me.data || session.user });
    }
    // Se responde igual con los datos del token, pero el 429 queda registrado.
    if (meRes.status === 429 || detectEdgeBlock(meRes)) {
      log429({
        source: detectEdgeBlock(meRes)?.source || "backend",
        method: "GET",
        route: "/api/user",
        res: meRes,
        bodyText: await meRes.text().catch(() => ""),
      });
    }
  } catch {
    // fall through to JWT claims
  }

  return NextResponse.json({ success: true, data: session.user });
}
