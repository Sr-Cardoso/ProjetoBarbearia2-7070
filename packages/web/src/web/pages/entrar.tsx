import { useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SiteTheme } from "../components/site-theme";
import { AuthPanel } from "../components/auth-panel";
import { useSiteContent } from "../queries/content";
import { useSession } from "../queries/account";

export default function Entrar() {
  const content = useSiteContent();
  const search = useSearch();
  const [, navigate] = useLocation();
  const next = new URLSearchParams(search).get("next") ?? "/conta";
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) navigate(next, { replace: true });
  }, [session, isPending, next, navigate]);

  return (
    <>
      <SiteTheme content={content} />
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />

        <main className="mx-auto flex max-w-md flex-col justify-center px-5 pt-36 pb-24">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-xs text-white/50 hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Voltar ao site
          </Link>

          <p className="eyebrow text-[10px] text-primary">Área do cliente</p>
          <h1 className="mt-3 font-display text-4xl leading-tight font-semibold text-white">
            Entre na sua conta
          </h1>
          <p className="mt-3 mb-9 text-sm leading-relaxed text-white/60">
            Agende mais rápido, acompanhe seu histórico e cancele quando precisar. Você também pode
            agendar sem conta, se preferir.
          </p>

          <AuthPanel onDone={() => navigate(next, { replace: true })} />

          <p className="mt-8 text-center text-xs text-white/40">
            Prefere agendar sem entrar?{" "}
            <Link to="/agendar" className="text-primary hover:underline">
              Agendar como visitante
            </Link>
          </p>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
