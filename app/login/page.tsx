import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LoginForm from "./_components/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const cookieStore = cookies();
  const hasSession =
    cookieStore.has("next-auth.session-token") ||
    cookieStore.has("__Secure-next-auth.session-token");

  if (hasSession) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">ChefManager Pro</h1>
            <p className="text-slate-500 mt-1">Sistema de Gestión de Inventario</p>
          </div>
          <LoginForm />
        </div>
        <p className="text-center text-white/70 text-sm mt-6">
          © 2026 ChefManager Pro - Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
