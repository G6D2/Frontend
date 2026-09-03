import { NextResponse } from "next/server";
import { getServerSession, BACKEND_URL } from "@/lib/session";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sin sesión" },
      { status: 401 }
    );
  }

  try {
    const meRes = await fetch(`${BACKEND_URL}/api/user`, {
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
  } catch {
    // fall through to JWT claims
  }

  return NextResponse.json({ success: true, data: session.user });
}
