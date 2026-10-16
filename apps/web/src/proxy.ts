import { COOKIE_KEYS } from "@fmbase/constants";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyAuthCookiesToResponse } from "./features/auth/cookies";
import * as jose from "jose";

const AUTH_ROUTES = ["/login", "register"];
const PROTECTED_ROUTES = ["/organizations", "/dashboard"];

async function refreshSession(
  refreshToken: string,
  response: NextResponse,
): Promise<boolean> {
  const apiurl = process.env.API_URL;
  if (!apiurl) throw new Error("check f env.");

  const refreshResponse = await fetch(`${apiurl}/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: `${COOKIE_KEYS.REFRESH_TOKEN}=${refreshToken}`,
    },
  });

  if (!refreshResponse.ok) return false;

  applyAuthCookiesToResponse(response, refreshResponse.headers.getSetCookie());
  return true;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(COOKIE_KEYS.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(COOKIE_KEYS.REFRESH_TOKEN)?.value;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));

  let isValid = false;
  if (accessToken && process.env.JWT_ACCESS_SECRET) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
      await jose.jwtVerify(accessToken, secret);
      isValid = true;
    } catch {}
  }

  if (isAuthRoute && isValid) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAuthRoute && refreshToken) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    if (await refreshSession(refreshToken, response)) return response;
  }

  if (isProtected && !isValid) {
    if (refreshToken) {
      const response = NextResponse.next();
      if (await refreshSession(refreshToken, response)) {
        return response;
      }
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
