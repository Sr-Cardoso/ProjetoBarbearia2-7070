import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteContent } from "../queries/content";
import { cartCount, useCart } from "../lib/cart";

export function SiteHeader() {
  const content = useSiteContent();
  const { brand, nav } = content;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const onHome = location === "/";
  const items = cartCount(useCart());

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || !onHome;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        solid ? "bg-black/95 backdrop-blur shadow-[0_1px_0_rgba(255,255,255,0.08)]" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-white"
          onClick={() => setOpen(false)}
        >
          {brand.logoUrl && (
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-14 w-auto shrink-0 object-contain"
            />
          )}
          <span className="leading-none">
            <span className="block font-display text-lg font-semibold tracking-tight">
              {brand.nameShort}
            </span>
            <span className="eyebrow block text-[9px] text-white/60">{brand.tagline}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {nav.links.map((l) => (
            <a
              key={`${l.href}-${l.label}`}
              href={l.href}
              className="text-[13px] font-medium tracking-wide text-white/75 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/loja"
            className={cn(
              "text-[13px] font-medium tracking-wide transition-colors hover:text-white",
              location === "/loja" ? "text-white" : "text-white/75",
            )}
          >
            Loja
          </Link>
          <Link
            to="/loja"
            aria-label="Carrinho"
            className="relative text-white/75 transition-colors hover:text-white"
          >
            <ShoppingBag className="size-[18px]" />
            {items > 0 && (
              <span className="absolute -top-2 -right-2 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-white">
                {items}
              </span>
            )}
          </Link>
          <Link
            to="/agendar"
            className="bg-primary px-6 py-2.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark"
          >
            {nav.ctaLabel}
          </Link>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <Link
            to="/loja"
            aria-label="Carrinho"
            onClick={() => setOpen(false)}
            className="relative grid size-10 place-items-center text-white"
          >
            <ShoppingBag className="size-[18px]" />
            {items > 0 && (
              <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-white">
                {items}
              </span>
            )}
          </Link>
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
          className="grid size-10 place-items-center text-white"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-black px-5 pb-6 md:hidden">
          <nav className="flex flex-col">
            {nav.links.map((l) => (
              <a
                key={`${l.href}-${l.label}`}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-white/10 py-3.5 text-sm text-white/80"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/loja"
              onClick={() => setOpen(false)}
              className="border-b border-white/10 py-3.5 text-sm text-white/80"
            >
              Loja de produtos
            </Link>
            <Link
              to="/agendar"
              onClick={() => setOpen(false)}
              className="mt-5 bg-primary py-3 text-center text-[11px] font-semibold tracking-[0.18em] text-white uppercase"
            >
              {nav.ctaLabel}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
