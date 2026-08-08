import { Link } from "wouter";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Clock,
  Heart,
  MapPin,
  Quote,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SiteTheme } from "../components/site-theme";
import { FeaturedProducts } from "../components/featured-products";
import { useBarbers, useServices, useShopSettings } from "../queries/booking";
import { useSiteContent } from "../queries/content";
import { formatPrice } from "../lib/format";

const ICONS: Record<string, typeof Clock> = {
  clock: Clock,
  shield: ShieldCheck,
  sparkles: Sparkles,
  scissors: Scissors,
  star: Star,
  calendar: CalendarDays,
  "map-pin": MapPin,
  heart: Heart,
};

function SectionEyebrow({ children }: { children: string }) {
  return <span className="eyebrow text-primary">{children}</span>;
}

export default function Index() {
  const services = useServices();
  const barbers = useBarbers();
  const settings = useShopSettings();
  const content = useSiteContent();
  const shop = settings.data ?? {};
  const { hero, highlights, about, gallery, team, pricing, testimonials, cta } = content;
  const fallbackImages = gallery.images.length ? gallery.images : ["/images/galeria-1.jpg"];

  return (
    <div className="bg-background">
      <SiteTheme content={content} />
      <SiteHeader />

      {/* HERO */}
      {hero.enabled && (
        <section className="hero-gradient relative overflow-hidden pt-28 pb-20 text-white lg:pt-36 lg:pb-28">
          <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.07]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8">
            <div>
              {hero.eyebrow && (
                <span className="eyebrow rise d1 inline-block border-l-2 border-white/70 pl-3 text-white/80">
                  {hero.eyebrow}
                </span>
              )}
              <h1 className="rise d2 mt-6 font-display text-[2.9rem] leading-[1.03] font-semibold sm:text-6xl lg:text-[4.4rem]">
                {hero.title}
                {hero.titleAccent && (
                  <>
                    <br />
                    <span className="italic">{hero.titleAccent}</span>
                  </>
                )}
              </h1>
              <p className="rise d3 mt-7 max-w-md text-[17px] leading-relaxed text-white/85">
                {hero.text}
              </p>
              <div className="rise d4 mt-9 flex flex-wrap items-center gap-4">
                <Link
                  to="/agendar"
                  className="group flex items-center gap-3 bg-primary px-8 py-4 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-primary-dark"
                >
                  {hero.primaryCta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                {hero.secondaryCta && (
                  <a
                    href="#servicos"
                    className="border border-white/40 px-8 py-4 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-primary/10"
                  >
                    {hero.secondaryCta}
                  </a>
                )}
              </div>

              {hero.stats.length > 0 && (
                <div className="rise d5 mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/20 pt-7">
                  {hero.stats.map((stat, i) => (
                    <div key={`${stat.label}-${i}`}>
                      <p className="font-display text-3xl font-semibold">{stat.value}</p>
                      <p className="mt-0.5 text-[11px] tracking-[0.14em] text-white/65 uppercase">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rise d3 relative">
              <img
                src={hero.image}
                alt={content.brand.name}
                className="aspect-4/5 w-full object-cover shadow-2xl"
              />
              {hero.badgeEnabled && (
                <div className="absolute -bottom-6 -left-6 hidden bg-card px-6 py-5 text-foreground shadow-xl sm:block">
                  <div className="flex items-center gap-2 text-primary">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="mt-2 font-display text-lg font-semibold">{hero.badgeTitle}</p>
                  <p className="text-xs text-muted-foreground">{hero.badgeText}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* DESTAQUES */}
      {highlights.enabled && highlights.items.length > 0 && (
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-6xl gap-px px-5 sm:grid-cols-3 lg:px-8">
            {highlights.items.map((h, i) => {
              const Icon = ICONS[h.icon] ?? Sparkles;
              return (
                <div
                  key={`${h.title}-${i}`}
                  className="border-white/10 py-10 sm:border-r sm:px-8 sm:last:border-r-0 sm:first:pl-0"
                >
                  <Icon className="size-6 text-primary" strokeWidth={1.6} />
                  <h3 className="mt-4 text-lg font-semibold">{h.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{h.text}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SOBRE */}
      {about.enabled && (
        <section className="bg-surface py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
            <div className="relative">
              <img
                src={about.image}
                alt={about.title}
                className="aspect-square w-full object-cover"
              />
              <div className="barber-stripe absolute -top-4 -right-4 hidden h-24 w-4 lg:block" />
            </div>
            <div>
              <SectionEyebrow>{about.eyebrow}</SectionEyebrow>
              <h2 className="mt-5 font-display text-4xl leading-tight font-semibold lg:text-5xl">
                {about.title} <span className="text-primary">{about.titleAccent}</span>
              </h2>
              {about.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="mt-6 text-[16px] leading-relaxed text-muted-foreground first:mt-6"
                >
                  {p}
                </p>
              ))}
              {about.bullets.length > 0 && (
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {about.bullets.map((item, i) => (
                    <li
                      key={`${item}-${i}`}
                      className="flex items-center gap-2.5 text-sm text-foreground"
                    >
                      <Scissors className="size-3.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SERVIÇOS */}
      {content.services.enabled && (
        <section id="servicos" className="py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <SectionEyebrow>{content.services.eyebrow}</SectionEyebrow>
              <h2 className="mt-5 font-display text-4xl leading-tight font-semibold lg:text-5xl">
                {content.services.title}
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
                {content.services.text}
              </p>
            </div>

            {services.isLoading ? (
              <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-72 animate-pulse bg-muted" />
                ))}
              </div>
            ) : services.isError ? (
              <p className="mt-14 text-sm text-destructive">
                Não foi possível carregar os serviços agora.
              </p>
            ) : (
              <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {services.data?.map((service, i) => (
                  <article
                    key={service.id}
                    className="group flex flex-col border border-border bg-card transition-colors hover:border-primary"
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={service.imageUrl ?? fallbackImages[i % fallbackImages.length]}
                        alt={service.name}
                        className="aspect-4/3 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <span className="absolute top-0 left-0 bg-primary px-3 py-1.5 text-[11px] font-semibold tracking-wider text-white">
                        {formatPrice(service.priceCents)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-xl font-semibold">{service.name}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {service.description}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="size-3.5" /> {service.durationMin} min
                        </span>
                        <Link
                          to="/agendar"
                          className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase"
                        >
                          Agendar <ArrowRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* GALERIA */}
      {gallery.enabled && gallery.images.length > 0 && (
        <section className="bg-black py-20 text-white lg:py-28">
          <div className="mx-auto max-w-6xl px-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-xl">
                <SectionEyebrow>{gallery.eyebrow}</SectionEyebrow>
                <h2 className="mt-5 font-display text-4xl leading-tight font-semibold lg:text-5xl">
                  {gallery.title}
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-white/55">{gallery.text}</p>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {gallery.images.map((src, i) => (
                <img
                  key={`${src}-${i}`}
                  src={src}
                  alt={`Trabalho ${i + 1}`}
                  className={`w-full object-cover ${i % 2 === 0 ? "aspect-3/4" : "aspect-3/4 lg:mt-8"}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* EQUIPE */}
      {team.enabled && (
        <section id="equipe" className="bg-surface py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <SectionEyebrow>{team.eyebrow}</SectionEyebrow>
              <h2 className="mt-5 font-display text-4xl leading-tight font-semibold lg:text-5xl">
                {team.title}
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">{team.text}</p>
            </div>

            {barbers.isLoading ? (
              <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-96 animate-pulse bg-muted" />
                ))}
              </div>
            ) : (
              <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {barbers.data?.map((barber) => (
                  <article key={barber.id} className="group">
                    <div className="relative overflow-hidden bg-black">
                      <img
                        src={barber.photoUrl ?? "/images/barbeiro-1.jpg"}
                        alt={barber.name}
                        className="aspect-4/5 w-full object-cover transition-all duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="mt-5">
                      <span className="eyebrow text-primary">{barber.role}</span>
                      <h3 className="mt-2 font-display text-2xl font-semibold">{barber.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {barber.bio}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* PREÇOS */}
      {pricing.enabled && (
        <section id="precos" className="py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <SectionEyebrow>{pricing.eyebrow}</SectionEyebrow>
              <h2 className="mt-5 font-display text-4xl leading-tight font-semibold lg:text-5xl">
                {pricing.title}
              </h2>
              <p className="mt-6 text-[16px] leading-relaxed text-muted-foreground">
                {pricing.text}
              </p>
              <Link
                to="/agendar"
                className="mt-8 inline-flex items-center gap-3 bg-primary px-8 py-4 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark"
              >
                <CalendarCheck className="size-4" /> {pricing.ctaLabel}
              </Link>
            </div>

            <div className="border-t border-border">
              {services.isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse border-b border-border bg-muted/40" />
                  ))
                : services.data?.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-baseline gap-4 border-b border-border py-5"
                    >
                      <span className="font-display text-lg font-semibold whitespace-nowrap">
                        {service.name}
                      </span>
                      <span className="min-w-6 flex-1 border-b border-dotted border-border/80" />
                      <span className="text-lg font-semibold text-primary">
                        {formatPrice(service.priceCents)}
                      </span>
                    </div>
                  ))}
            </div>
          </div>
        </section>
      )}

      {/* LOJA */}
      <FeaturedProducts />

      {/* DEPOIMENTOS */}
      {testimonials.enabled && testimonials.items.length > 0 && (
        <section className="hero-gradient relative overflow-hidden py-20 text-white lg:py-24">
          <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.07]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 lg:px-8">
            {testimonials.items.map((t, i) => (
              <div key={i} className="mx-auto max-w-3xl text-center">
                <Quote className="mx-auto size-8 text-white/60" />
                <blockquote className="mt-7 font-display text-2xl leading-snug font-medium italic sm:text-3xl">
                  “{t.quote}”
                </blockquote>
                <p className="mt-7 text-[11px] tracking-[0.2em] text-white/75 uppercase">
                  {t.author}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      {cta.enabled && (
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-6xl items-stretch gap-0 lg:grid-cols-2">
            <img
              src={cta.image}
              alt={cta.title}
              className="h-64 w-full object-cover lg:h-full"
            />
            <div className="px-5 py-16 lg:px-12 lg:py-20">
              <SectionEyebrow>{cta.eyebrow}</SectionEyebrow>
              <h2 className="mt-5 font-display text-4xl leading-tight font-semibold lg:text-5xl">
                {cta.title}
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-white/65">{cta.text}</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/agendar"
                  className="bg-primary px-8 py-4 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-primary-dark"
                >
                  {cta.primaryLabel}
                </Link>
                <a
                  href="#contato"
                  className="border border-white/30 px-8 py-4 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-primary/10"
                >
                  {cta.secondaryLabel}
                </a>
              </div>
              {shop.address && (
                <p className="mt-9 flex items-start gap-2.5 text-sm text-white/55">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  {shop.address}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
