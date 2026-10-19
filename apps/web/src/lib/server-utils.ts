import { COOKIE_KEYS } from "@fmbase/constants";
import { cookies } from "next/headers.js";
import { redirect } from "next/navigation.js";

export async function retrieveAccessTokenFromCookie(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_KEYS.ACCESS_TOKEN)?.value;
  if (!token) redirect("/login");
  return token;
}
