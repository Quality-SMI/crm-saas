// Next 16 proxy (anteriormente "middleware"). Roda em runtime Node.js antes de cada request.
// Função: redireciona rotas internas para /login quando não há cookie de sessão.
// A validação criptográfica ocorre nas chamadas /api (JwtStrategy do backend).

import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/forgot-password",
  "/reset-password",
]);

const PUBLIC_PREFIXES = [
  "/_next",
  "/api",
  "/favicon",
  "/logo",
  "/robots.txt",
  "/sitemap.xml",
];

const isPublic = (pathname: string): boolean => {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Root "/" não é protegido; o app.page.tsx já redireciona para /login.
  if (pathname === "/" || isPublic(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("refresh_token") || request.cookies.has("access_token");
  if (hasSession) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Casa tudo exceto arquivos estáticos do Next e o favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
