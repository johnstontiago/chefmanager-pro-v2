import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const cookieStore = cookies();
  const hasSession =
    cookieStore.has("next-auth.session-token") ||
    cookieStore.has("__Secure-next-auth.session-token");

  redirect(hasSession ? "/dashboard" : "/login");
}
