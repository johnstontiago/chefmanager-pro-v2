import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import OnboardingForm from "./_components/onboarding-form";

export default async function NuevoTenantPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.rol !== "superuser") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/superadmin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Panel Admin
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Nuevo Negocio</h1>
          <p className="text-muted-foreground text-sm">Incorpora un nuevo cliente al sistema</p>
        </div>
      </div>
      <OnboardingForm />
    </div>
  );
}
