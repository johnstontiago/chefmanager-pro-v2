"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

interface PinVerificationProps {
  userName: string;
}

export default function PinVerification({ userName }: PinVerificationProps) {
  const [pin, setPin] = useState(["" , "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const { update } = useSession() ?? {};

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newPin.every(d => d !== "") && newPin.join("").length === 4) {
      verifyPin(newPin.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyPin = async (pinValue: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || "PIN incorrecto");
        setPin(["", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        toast.success("PIN verificado correctamente");
        await update?.({ pinVerified: true });
        router.replace("/dashboard");
      }
    } catch (error) {
      toast.error("Error al verificar PIN");
      setPin(["", "", "", ""]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Hola, <span className="font-semibold">{userName}</span>
      </p>

      <div className="flex justify-center gap-3">
        {pin.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={loading}
            className="w-14 h-14 text-center text-2xl font-bold border-2 border-input rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:opacity-50"
          />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      <div className="pt-4 border-t">
        <Button
          variant="ghost"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}
