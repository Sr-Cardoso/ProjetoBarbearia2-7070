import { Link } from "wouter";
import { Clock, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { useShopSettings } from "../queries/booking";
import { useSiteContent } from "../queries/content";
import { waNumber } from "../lib/format";

export function SiteFooter() {
  const settings = useShopSettings();
  const content = useSiteContent();
  const { brand, footer } = content;
  const s = settings.data ?? {};
  const wa = waNumber(s.whatsapp);

  return (
    <footer id="contato" className="bg-black text-white">
      <div className="barber-stripe h-1.5" />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-4 lg:px-8 lg:py-20">
        <div className="lg:col-span-2">
          {brand.logoUrl && (
            <img src={brand.logoUrl} alt={brand.name} className="h-24 w-auto object-contain" />
          )}
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/60">{footer.about}</p>
          <Link
            to="/agendar"
            className="mt-7 inline-block bg-primary px-7 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-primary-dark"
          >
            {footer.ctaLabel}
          </Link>
        </div>

        <div>
          <h3 className="eyebrow text-primary">Contato</h3>
          <ul className="mt-5 space-y-3.5 text-sm text-white/70">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              {s.mapsUrl ? (
                <a
                  href={s.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {s.address ?? "Ver no mapa"}
                </a>
              ) : (
                <span>{s.address ?? "—"}</span>
              )}
            </li>
            {wa && (
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {s.phone ?? s.whatsapp}
                </a>
              </li>
            )}
            {s.email && (
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                <a href={`mailto:${s.email}`} className="transition-colors hover:text-white">
                  {s.email}
                </a>
              </li>
            )}
            {s.instagram && (
              <li className="flex gap-3">
                <Instagram className="mt-0.5 size-4 shrink-0 text-primary" />
                <a
                  href={`https://instagram.com/${s.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {s.instagram}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow text-primary">{footer.hoursTitle}</h3>
          <ul className="mt-5 space-y-2.5 text-sm text-white/70">
            {footer.hours.map((row, i) => (
              <li
                key={`${row.day}-${i}`}
                className="flex items-center justify-between gap-4 border-b border-white/10 pb-2.5 last:border-b-0 last:pb-0"
              >
                <span>{row.day}</span>
                <span className={/fechad/i.test(row.time) ? "text-white/40" : "text-white"}>
                  {row.time}
                </span>
              </li>
            ))}
          </ul>
          {footer.note && (
            <p className="mt-5 flex items-start gap-2 text-xs text-white/45">
              <Clock className="mt-0.5 size-3.5 shrink-0" />
              {footer.note}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>
            © {new Date().getFullYear()} {brand.name}. Todos os direitos reservados.
          </p>
          <Link to="/admin" className="transition-colors hover:text-white/70">
            Área do administrador
          </Link>
        </div>
      </div>
    </footer>
  );
}
