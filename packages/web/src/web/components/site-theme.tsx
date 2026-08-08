import { useEffect } from "react";
import type { SiteContent } from "../lib/site-content";

function setMeta(selector: string, attr: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    const [key, val] = selector.replace(/^meta\[|\]$/g, "").split("=");
    el.setAttribute(key, val.replace(/["']/g, ""));
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/**
 * Aplica cores, favicon e SEO definidos no painel. Sem UI própria —
 * só efeitos no documento.
 */
export function SiteTheme({ content }: { content: SiteContent }) {
  const { theme, seo, brand } = content;

  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = {
      "--background": theme.background,
      "--surface": theme.surface,
      "--card": theme.surface,
      "--primary": theme.primary,
      "--primary-dark": theme.primaryDark,
      "--foreground": theme.foreground,
    };
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
    return () => {
      for (const key of Object.keys(vars)) root.style.removeProperty(key);
    };
  }, [theme.background, theme.surface, theme.primary, theme.primaryDark, theme.foreground]);

  useEffect(() => {
    document.title = seo.title;
    setMeta('meta[name="description"]', "content", seo.description);
    setMeta('meta[property="og:title"]', "content", seo.title);
    setMeta('meta[property="og:description"]', "content", seo.description);
    if (seo.ogImage) setMeta('meta[property="og:image"]', "content", seo.ogImage);
  }, [seo.title, seo.description, seo.ogImage]);

  useEffect(() => {
    if (!brand.logoUrl) return;
    let icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = brand.logoUrl;
  }, [brand.logoUrl]);

  return null;
}
