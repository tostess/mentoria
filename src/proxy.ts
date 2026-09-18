import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { parseClaims } from "@/lib/auth/claims";
import { canAccess, HOME_BY_ROLE, isPublicPath, matchesPrefix, safeNext } from "@/lib/auth/routes";
import { hasSupabasePublicEnv, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * No Next 16 o `middleware.ts` virou `proxy.ts` — mesmo lugar, nome novo, e
 * sempre no runtime Node.
 *
 * Duas responsabilidades, nesta ordem:
 *
 * 1. **Renovar a sessão.** O token do Supabase expira em uma hora e só é
 *    renovado por quem consegue gravar cookie. Server Component não consegue
 *    — por isso `supabase/server.ts` engole o erro de escrita. É aqui que a
 *    renovação acontece de verdade, e é por isso que este arquivo existe.
 *
 * 2. **Mandar cada papel para a sua casca.** Conveniência, não segurança: o
 *    que protege o dado é a RLS, e a rota é só o caminho até ele.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A galeria do sistema de design não tem sessão nem dado — e em produção a
  // própria página devolve 404.
  if (process.env.NODE_ENV !== "production" && matchesPrefix(pathname, "/design")) {
    return NextResponse.next();
  }

  // Sem Supabase configurado, nada de sessão existe. Fecha em vez de abrir:
  // um deploy com variável faltando não pode virar uma aplicação sem porta.
  // A tela de entrada continua de pé e diz o que está faltando.
  if (!hasSupabasePublicEnv) {
    return isPublicPath(pathname) ? NextResponse.next() : redirectTo(request, "/entrar");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // O cookie renovado precisa valer para esta requisição (para a página
        // que vem a seguir) e voltar ao navegador (para a próxima). Daí gravar
        // nos dois lados e refazer a resposta.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const session = parseClaims(data?.claims);

  if (session === null) {
    if (isPublicPath(pathname)) return response;

    // Token válido mas sem papel utilizável — inativo, excluído, ou o hook de
    // claims ainda não ligado. É diferente de não ter entrado, e a tela de
    // entrada diz isso em vez de pedir a senha de novo.
    const semAcesso = Boolean(data?.claims);
    const destino = new URL("/entrar", request.url);
    if (semAcesso) {
      destino.searchParams.set("erro", "sem-acesso");
    } else if (pathname !== "/") {
      destino.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    }
    return keepCookies(NextResponse.redirect(destino), response);
  }

  const casa = HOME_BY_ROLE[session.role];

  // `/` e `/entrar` para quem já entrou: vai para a casca do papel, ou para
  // onde a pessoa tentava ir antes de ser interrompida.
  if (pathname === "/" || isPublicPath(pathname)) {
    const next = safeNext(request.nextUrl.searchParams.get("next"), session.role);
    return keepCookies(NextResponse.redirect(new URL(next ?? casa, request.url)), response);
  }

  if (!canAccess(session.role, pathname)) {
    return keepCookies(NextResponse.redirect(new URL(casa, request.url)), response);
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

/**
 * Redirecionar descarta a resposta que carregava o cookie renovado. Sem
 * copiar, a sessão recém-renovada se perderia justamente em quem foi
 * redirecionado — e a pessoa cairia na entrada a cada hora.
 */
function keepCookies(destino: NextResponse, origem: NextResponse) {
  for (const cookie of origem.cookies.getAll()) destino.cookies.set(cookie);
  return destino;
}

export const config = {
  matcher: [
    /**
     * Tudo que é página. Fora:
     *
     * - `_next/*` e arquivo estático — não têm sessão a renovar e o custo por
     *   requisição seria pago em toda imagem.
     * - `api/*` — Route Handler se protege sozinho. Cron da Vercel e webhook
     *   do Daily chegam com segredo em cabeçalho, sem cookie nenhum: passar
     *   pelo guarda de sessão só os barraria.
     */
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
