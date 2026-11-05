import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";

export async function POST(request) {
  // Sin body: solo se exige mismo origen (ver lib/csrf.js).
  const rejected = checkCsrf(request, { json: false });
  if (rejected) return rejected;

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
