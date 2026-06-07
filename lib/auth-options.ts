import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Credenciales inválidas");
        }

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email },
          include: { unidad: true },
        });

        if (!usuario || !usuario.activo) {
          throw new Error("Usuario no encontrado o inactivo");
        }

        const isValid = await bcrypt.compare(credentials.password, usuario.password);
        if (!isValid) {
          throw new Error("Contraseña incorrecta");
        }

        return {
          id: String(usuario.id),
          email: usuario.email,
          name: usuario.nombre,
          rol: usuario.rol,
          tenantId: usuario.tenantId,
          unidadId: usuario.unidadId,
          unidadNombre: usuario.unidad?.nombre || null,
          hasPin: !!usuario.pinCode,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.rol = (user as any).rol;
        token.tenantId = (user as any).tenantId;
        token.unidadId = (user as any).unidadId;
        token.unidadNombre = (user as any).unidadNombre;
        token.pinVerified = false;
        // pinCode nunca viaja en el token — verify-pin consulta la BD directamente
      }
      if (trigger === "update" && session) {
        if (session.pinVerified !== undefined) token.pinVerified = session.pinVerified;
        if (session.unidadId !== undefined) token.unidadId = session.unidadId;
        if (session.unidadNombre !== undefined) token.unidadNombre = session.unidadNombre;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).rol = token.rol;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).unidadId = token.unidadId;
        (session.user as any).unidadNombre = token.unidadNombre;
        (session.user as any).pinVerified = token.pinVerified;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
