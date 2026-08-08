import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageField } from "./image-field";
import {
  useContentDraft,
  useDiscardDraft,
  usePublishContent,
  useResetContent,
  useSaveDraft,
} from "../queries/content";
import {
  HIGHLIGHT_ICONS,
  type Highlight,
  type HourRow,
  type SiteContent,
  type Stat,
  type Testimonial,
} from "../lib/site-content";

const SECTIONS = [
  { key: "brand", label: "Marca" },
  { key: "theme", label: "Cores" },
  { key: "seo", label: "SEO" },
  { key: "nav", label: "Menu" },
  { key: "hero", label: "Topo (hero)" },
  { key: "highlights", label: "Destaques" },
  { key: "about", label: "Sobre" },
  { key: "services", label: "Serviços" },
  { key: "gallery", label: "Galeria" },
  { key: "team", label: "Equipe" },
  { key: "pricing", label: "Preços" },
  { key: "shop", label: "Loja" },
  { key: "testimonials", label: "Depoimentos" },
  { key: "cta", label: "Chamada final" },
  { key: "footer", label: "Rodapé e horários" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export function SiteTab() {
  const draftQuery = useContentDraft();
  const saveDraft = useSaveDraft();
  const publish = usePublishContent();
  const discard = useDiscardDraft();
  const reset = useResetContent();

  const [content, setContent] = useState<SiteContent | null>(null);
  const [section, setSection] = useState<SectionKey>("brand");
  const [previewKey, setPreviewKey] = useState(0);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega o rascunho do servidor uma vez (edições locais têm prioridade).
  const serverDraft = draftQuery.data?.draft;
  useEffect(() => {
    if (serverDraft && !content) setContent(serverDraft as SiteContent);
  }, [serverDraft, content]);

  // Salva automaticamente para o preview refletir as edições.
  function edit(next: SiteContent) {
    setContent(next);
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft.mutate({ content: next });
    }, 700);
  }

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const patch = useMemo(
    () =>
      <K extends keyof SiteContent>(key: K, value: Partial<SiteContent[K]>) => {
        if (!content) return;
        edit({ ...content, [key]: { ...content[key], ...value } });
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content],
  );

  if (draftQuery.isLoading || !content) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando conteúdo do site…
      </p>
    );
  }

  const busy = saveDraft.isPending;

  async function reload(fn: () => Promise<{ draft: SiteContent } | unknown>) {
    const res = (await fn()) as { draft?: SiteContent };
    if (res?.draft) setContent(res.draft);
    dirtyRef.current = false;
    setPreviewKey((k) => k + 1);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl">Conteúdo do site</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite os textos, imagens e cores. As mudanças aparecem no preview ao lado e só vão
            para o site quando você clicar em <strong className="text-foreground">Publicar</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] text-muted-foreground">
            {busy ? "Salvando rascunho…" : draftQuery.data?.dirty ? "Rascunho não publicado" : "Tudo publicado"}
          </span>
          <button
            type="button"
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              saveDraft.mutate(
                { content },
                { onSuccess: () => setPreviewKey((k) => k + 1) },
              );
            }}
            className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors hover:border-primary"
          >
            <Check className="size-3.5" /> Salvar rascunho
          </button>
          <button
            type="button"
            disabled={publish.isPending}
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              saveDraft.mutate(
                { content },
                { onSuccess: () => publish.mutate({}) },
              );
            }}
            className="inline-flex items-center gap-2 bg-primary px-6 py-2.5 text-[10px] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
          >
            {publish.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Publicar
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------- editor */}
        <div className="bg-card">
          <nav className="flex flex-wrap gap-1 border-b border-border p-3">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors",
                  section === s.key
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="space-y-5 p-5 md:p-6">
            {section === "brand" && (
              <>
                <ImageField
                  label="Logotipo"
                  value={content.brand.logoUrl}
                  onChange={(v) => patch("brand", { logoUrl: v })}
                  hint="PNG com fundo transparente"
                />
                <Text label="Nome" value={content.brand.name} onChange={(v) => patch("brand", { name: v })} />
                <Text
                  label="Nome curto (menu)"
                  value={content.brand.nameShort}
                  onChange={(v) => patch("brand", { nameShort: v })}
                />
                <Text
                  label="Assinatura"
                  value={content.brand.tagline}
                  onChange={(v) => patch("brand", { tagline: v })}
                />
              </>
            )}

            {section === "theme" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Color label="Fundo" value={content.theme.background} onChange={(v) => patch("theme", { background: v })} />
                <Color label="Cartões" value={content.theme.surface} onChange={(v) => patch("theme", { surface: v })} />
                <Color label="Cor principal" value={content.theme.primary} onChange={(v) => patch("theme", { primary: v })} />
                <Color label="Cor principal (escura)" value={content.theme.primaryDark} onChange={(v) => patch("theme", { primaryDark: v })} />
                <Color label="Texto" value={content.theme.foreground} onChange={(v) => patch("theme", { foreground: v })} />
              </div>
            )}

            {section === "seo" && (
              <>
                <Text label="Título da aba" value={content.seo.title} onChange={(v) => patch("seo", { title: v })} />
                <Area
                  label="Descrição (Google)"
                  value={content.seo.description}
                  onChange={(v) => patch("seo", { description: v })}
                />
                <ImageField
                  label="Imagem de compartilhamento (OG)"
                  value={content.seo.ogImage}
                  onChange={(v) => patch("seo", { ogImage: v })}
                  hint="1200×630 px"
                />
              </>
            )}

            {section === "nav" && (
              <>
                <Text
                  label="Texto do botão"
                  value={content.nav.ctaLabel}
                  onChange={(v) => patch("nav", { ctaLabel: v })}
                />
                <List
                  label="Links do menu"
                  items={content.nav.links}
                  onChange={(links) => patch("nav", { links })}
                  create={() => ({ label: "Nova seção", href: "/#" })}
                  render={(item, set) => (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Text label="Texto" value={item.label} onChange={(v) => set({ ...item, label: v })} />
                      <Text label="Link" value={item.href} onChange={(v) => set({ ...item, href: v })} />
                    </div>
                  )}
                />
              </>
            )}

            {section === "hero" && (
              <>
                <Toggle
                  label="Mostrar seção"
                  value={content.hero.enabled}
                  onChange={(v) => patch("hero", { enabled: v })}
                />
                <Text label="Linha de apoio" value={content.hero.eyebrow} onChange={(v) => patch("hero", { eyebrow: v })} />
                <Text label="Título" value={content.hero.title} onChange={(v) => patch("hero", { title: v })} />
                <Text
                  label="Título (parte destacada)"
                  value={content.hero.titleAccent}
                  onChange={(v) => patch("hero", { titleAccent: v })}
                />
                <Area label="Texto" value={content.hero.text} onChange={(v) => patch("hero", { text: v })} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Text label="Botão principal" value={content.hero.primaryCta} onChange={(v) => patch("hero", { primaryCta: v })} />
                  <Text label="Botão secundário" value={content.hero.secondaryCta} onChange={(v) => patch("hero", { secondaryCta: v })} />
                </div>
                <ImageField label="Imagem" value={content.hero.image} onChange={(v) => patch("hero", { image: v })} />
                <List<Stat>
                  label="Números"
                  items={content.hero.stats}
                  onChange={(stats) => patch("hero", { stats })}
                  create={() => ({ value: "0", label: "descrição" })}
                  render={(item, set) => (
                    <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                      <Text label="Valor" value={item.value} onChange={(v) => set({ ...item, value: v })} />
                      <Text label="Descrição" value={item.label} onChange={(v) => set({ ...item, label: v })} />
                    </div>
                  )}
                />
                <Toggle
                  label="Mostrar selo de avaliação"
                  value={content.hero.badgeEnabled}
                  onChange={(v) => patch("hero", { badgeEnabled: v })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Text label="Selo — título" value={content.hero.badgeTitle} onChange={(v) => patch("hero", { badgeTitle: v })} />
                  <Text label="Selo — texto" value={content.hero.badgeText} onChange={(v) => patch("hero", { badgeText: v })} />
                </div>
              </>
            )}

            {section === "highlights" && (
              <>
                <Toggle
                  label="Mostrar seção"
                  value={content.highlights.enabled}
                  onChange={(v) => patch("highlights", { enabled: v })}
                />
                <List<Highlight>
                  label="Destaques"
                  items={content.highlights.items}
                  onChange={(items) => patch("highlights", { items })}
                  create={() => ({ icon: "star", title: "Novo destaque", text: "" })}
                  render={(item, set) => (
                    <>
                      <Select
                        label="Ícone"
                        value={item.icon}
                        options={HIGHLIGHT_ICONS as readonly string[]}
                        onChange={(v) => set({ ...item, icon: v })}
                      />
                      <Text label="Título" value={item.title} onChange={(v) => set({ ...item, title: v })} />
                      <Area label="Texto" value={item.text} onChange={(v) => set({ ...item, text: v })} />
                    </>
                  )}
                />
              </>
            )}

            {section === "about" && (
              <>
                <Toggle label="Mostrar seção" value={content.about.enabled} onChange={(v) => patch("about", { enabled: v })} />
                <Text label="Linha de apoio" value={content.about.eyebrow} onChange={(v) => patch("about", { eyebrow: v })} />
                <Text label="Título" value={content.about.title} onChange={(v) => patch("about", { title: v })} />
                <Text
                  label="Título (parte destacada)"
                  value={content.about.titleAccent}
                  onChange={(v) => patch("about", { titleAccent: v })}
                />
                <ImageField label="Imagem" value={content.about.image} onChange={(v) => patch("about", { image: v })} />
                <List<string>
                  label="Parágrafos"
                  items={content.about.paragraphs}
                  onChange={(paragraphs) => patch("about", { paragraphs })}
                  create={() => ""}
                  render={(item, set) => <Area label="Texto" value={item} onChange={set} />}
                />
                <List<string>
                  label="Itens da lista"
                  items={content.about.bullets}
                  onChange={(bullets) => patch("about", { bullets })}
                  create={() => "Novo item"}
                  render={(item, set) => <Text label="Item" value={item} onChange={set} />}
                />
              </>
            )}

            {section === "services" && (
              <>
                <Toggle label="Mostrar seção" value={content.services.enabled} onChange={(v) => patch("services", { enabled: v })} />
                <Text label="Linha de apoio" value={content.services.eyebrow} onChange={(v) => patch("services", { eyebrow: v })} />
                <Text label="Título" value={content.services.title} onChange={(v) => patch("services", { title: v })} />
                <Area label="Texto" value={content.services.text} onChange={(v) => patch("services", { text: v })} />
                <Note>
                  Os serviços em si (nome, preço e imagem) ficam na aba{" "}
                  <strong className="text-foreground">Serviços</strong>.
                </Note>
              </>
            )}

            {section === "gallery" && (
              <>
                <Toggle label="Mostrar seção" value={content.gallery.enabled} onChange={(v) => patch("gallery", { enabled: v })} />
                <Text label="Linha de apoio" value={content.gallery.eyebrow} onChange={(v) => patch("gallery", { eyebrow: v })} />
                <Text label="Título" value={content.gallery.title} onChange={(v) => patch("gallery", { title: v })} />
                <Area label="Texto" value={content.gallery.text} onChange={(v) => patch("gallery", { text: v })} />
                <List<string>
                  label="Fotos"
                  items={content.gallery.images}
                  onChange={(images) => patch("gallery", { images })}
                  create={() => ""}
                  render={(item, set) => <ImageField label="Foto" value={item} onChange={set} />}
                />
              </>
            )}

            {section === "team" && (
              <>
                <Toggle label="Mostrar seção" value={content.team.enabled} onChange={(v) => patch("team", { enabled: v })} />
                <Text label="Linha de apoio" value={content.team.eyebrow} onChange={(v) => patch("team", { eyebrow: v })} />
                <Text label="Título" value={content.team.title} onChange={(v) => patch("team", { title: v })} />
                <Area label="Texto" value={content.team.text} onChange={(v) => patch("team", { text: v })} />
                <Note>
                  Os barbeiros (nome, foto e especialidade) ficam na aba{" "}
                  <strong className="text-foreground">Barbeiros</strong>.
                </Note>
              </>
            )}

            {section === "pricing" && (
              <>
                <Toggle label="Mostrar seção" value={content.pricing.enabled} onChange={(v) => patch("pricing", { enabled: v })} />
                <Text label="Linha de apoio" value={content.pricing.eyebrow} onChange={(v) => patch("pricing", { eyebrow: v })} />
                <Text label="Título" value={content.pricing.title} onChange={(v) => patch("pricing", { title: v })} />
                <Area label="Texto" value={content.pricing.text} onChange={(v) => patch("pricing", { text: v })} />
                <Text label="Texto do botão" value={content.pricing.ctaLabel} onChange={(v) => patch("pricing", { ctaLabel: v })} />
              </>
            )}

            {section === "shop" && (
              <>
                <Toggle
                  label="Mostrar vitrine na home"
                  value={content.shop.enabled}
                  onChange={(v) => patch("shop", { enabled: v })}
                />
                <Note>
                  Os produtos são cadastrados na aba <strong>Produtos</strong>. Aqui você edita os
                  textos da vitrine da home e do topo da página da loja.
                </Note>
                <Text
                  label="Linha de apoio (home)"
                  value={content.shop.eyebrow}
                  onChange={(v) => patch("shop", { eyebrow: v })}
                />
                <Text
                  label="Título (home)"
                  value={content.shop.title}
                  onChange={(v) => patch("shop", { title: v })}
                />
                <Area
                  label="Texto (home)"
                  value={content.shop.text}
                  onChange={(v) => patch("shop", { text: v })}
                />
                <Text
                  label="Botão da vitrine"
                  value={content.shop.ctaLabel}
                  onChange={(v) => patch("shop", { ctaLabel: v })}
                />
                <Text
                  label="Linha de apoio (página da loja)"
                  value={content.shop.pageEyebrow}
                  onChange={(v) => patch("shop", { pageEyebrow: v })}
                />
                <Text
                  label="Título (página da loja)"
                  value={content.shop.pageTitle}
                  onChange={(v) => patch("shop", { pageTitle: v })}
                />
                <Area
                  label="Texto (página da loja)"
                  value={content.shop.pageText}
                  onChange={(v) => patch("shop", { pageText: v })}
                />
                <Area
                  label="Aviso no carrinho"
                  value={content.shop.checkoutNote}
                  onChange={(v) => patch("shop", { checkoutNote: v })}
                />
              </>
            )}

            {section === "testimonials" && (
              <>
                <Toggle
                  label="Mostrar seção"
                  value={content.testimonials.enabled}
                  onChange={(v) => patch("testimonials", { enabled: v })}
                />
                <List<Testimonial>
                  label="Depoimentos"
                  items={content.testimonials.items}
                  onChange={(items) => patch("testimonials", { items })}
                  create={() => ({ quote: "", author: "" })}
                  render={(item, set) => (
                    <>
                      <Area label="Depoimento" value={item.quote} onChange={(v) => set({ ...item, quote: v })} />
                      <Text label="Quem falou" value={item.author} onChange={(v) => set({ ...item, author: v })} />
                    </>
                  )}
                />
              </>
            )}

            {section === "cta" && (
              <>
                <Toggle label="Mostrar seção" value={content.cta.enabled} onChange={(v) => patch("cta", { enabled: v })} />
                <Text label="Linha de apoio" value={content.cta.eyebrow} onChange={(v) => patch("cta", { eyebrow: v })} />
                <Text label="Título" value={content.cta.title} onChange={(v) => patch("cta", { title: v })} />
                <Area label="Texto" value={content.cta.text} onChange={(v) => patch("cta", { text: v })} />
                <ImageField label="Imagem de fundo" value={content.cta.image} onChange={(v) => patch("cta", { image: v })} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Text label="Botão principal" value={content.cta.primaryLabel} onChange={(v) => patch("cta", { primaryLabel: v })} />
                  <Text label="Botão secundário" value={content.cta.secondaryLabel} onChange={(v) => patch("cta", { secondaryLabel: v })} />
                </div>
              </>
            )}

            {section === "footer" && (
              <>
                <Area label="Texto sobre a barbearia" value={content.footer.about} onChange={(v) => patch("footer", { about: v })} />
                <Text label="Texto do botão" value={content.footer.ctaLabel} onChange={(v) => patch("footer", { ctaLabel: v })} />
                <Text label="Título dos horários" value={content.footer.hoursTitle} onChange={(v) => patch("footer", { hoursTitle: v })} />
                <List<HourRow>
                  label="Horário de funcionamento"
                  items={content.footer.hours}
                  onChange={(hours) => patch("footer", { hours })}
                  create={() => ({ day: "Sábado", time: "Fechado" })}
                  render={(item, set) => (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Text label="Dia" value={item.day} onChange={(v) => set({ ...item, day: v })} />
                      <Text label="Horário" value={item.time} onChange={(v) => set({ ...item, time: v })} />
                    </div>
                  )}
                />
                <Text label="Observação" value={content.footer.note} onChange={(v) => patch("footer", { note: v })} />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border p-5">
            <button
              type="button"
              disabled={discard.isPending}
              onClick={() => void reload(() => discard.mutateAsync({}))}
              className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:border-primary disabled:opacity-40"
            >
              <Undo2 className="size-3.5" /> Descartar rascunho
            </button>
            <button
              type="button"
              disabled={reset.isPending}
              onClick={() => {
                if (!confirm("Restaurar todo o conteúdo padrão do site?")) return;
                void reload(() => reset.mutateAsync({}));
              }}
              className="inline-flex items-center gap-2 border border-destructive/30 px-4 py-2 text-[10px] font-semibold tracking-[0.14em] text-destructive uppercase transition-colors hover:bg-destructive/10 disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" /> Restaurar padrão
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------ preview */}
        <div className="bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="eyebrow flex items-center gap-2 text-[10px] text-muted-foreground">
              <Eye className="size-3.5" /> Preview do rascunho
            </span>
            <a
              href="/?preview=1"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              abrir em nova aba
            </a>
          </div>
          <iframe
            key={previewKey}
            title="Preview do site"
            src="/?preview=1"
            className="h-[80vh] w-full border-0 bg-black xl:sticky xl:top-4"
          />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- campos */

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-[9px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-[9px] text-muted-foreground">{label}</span>
      <textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-[9px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-card">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-[9px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 border border-input px-2 py-1.5">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between border border-border px-4 py-3 text-left"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          value ? "bg-primary" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-all",
            value ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="border-l-2 border-primary/50 pl-3 text-[12px] text-muted-foreground">{children}</p>;
}

function List<T>({
  label,
  items,
  onChange,
  create,
  render,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, set: (next: T) => void) => React.ReactNode;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="eyebrow text-[9px] text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...items, create()])}
          className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:border-primary"
        >
          <Plus className="size-3" /> Adicionar
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
              <div className="flex items-center gap-1">
                <IconButton onClick={() => move(i, i - 1)} title="Subir">
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton onClick={() => move(i, i + 1)} title="Descer">
                  <ArrowDown className="size-3.5" />
                </IconButton>
                <IconButton
                  danger
                  title="Remover"
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </div>
            <div className="space-y-3">
              {render(item, (next) => onChange(items.map((it, idx) => (idx === i ? next : it))))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
            Nenhum item.
          </p>
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center border border-border transition-colors",
        danger ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
