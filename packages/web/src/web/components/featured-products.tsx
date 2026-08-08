/**
 * Vitrine dos produtos em destaque, exibida na home.
 * O botão adiciona direto ao carrinho e leva para a loja concluir o pedido.
 */
import { Link } from "wouter";
import { ArrowRight, Package, Plus } from "lucide-react";
import { useFeaturedProducts } from "../queries/shop";
import { useSiteContent } from "../queries/content";
import { addToCart } from "../lib/cart";
import { formatPrice } from "../lib/format";

export function FeaturedProducts() {
  const featured = useFeaturedProducts();
  const { shop } = useSiteContent();
  const items = featured.data ?? [];

  if (!shop.enabled || featured.isLoading || items.length === 0) return null;

  return (
    <section id="loja" className="bg-surface py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="eyebrow text-primary">{shop.eyebrow}</span>
            <h2 className="mt-5 max-w-xl font-display text-4xl leading-tight font-semibold lg:text-5xl">
              {shop.title}
            </h2>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted-foreground">
              {shop.text}
            </p>
          </div>
          <Link
            to="/loja"
            className="group inline-flex items-center gap-3 border border-border px-7 py-3.5 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:border-primary hover:text-primary"
          >
            {shop.ctaLabel}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map((product) => (
            <article key={product.id} className="flex flex-col bg-card">
              <Link to="/loja" className="relative block aspect-square bg-white">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="size-full object-contain p-4"
                  />
                ) : (
                  <span className="grid size-full place-items-center">
                    <Package className="size-10 text-muted-foreground/40" />
                  </span>
                )}
                {product.onSale && (
                  <span className="absolute top-3 left-3 bg-primary px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-white uppercase">
                    Promoção
                  </span>
                )}
              </Link>

              <div className="flex flex-1 flex-col p-5">
                <span className="eyebrow text-[10px] text-primary">{product.category}</span>
                <h3 className="mt-2 flex-1 font-display text-lg leading-tight">{product.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  {product.listPriceCents && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(product.listPriceCents)}
                    </span>
                  )}
                  <span className="font-display text-xl">{formatPrice(product.priceCents)}</span>
                </div>
                <button
                  type="button"
                  disabled={!product.inStock}
                  onClick={() =>
                    addToCart(
                      {
                        productId: product.id,
                        name: product.name,
                        priceCents: product.priceCents,
                        imageUrl: product.imageUrl,
                      },
                      product.stock,
                    )
                  }
                  className="mt-4 flex items-center justify-center gap-2 bg-primary py-3 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
                >
                  <Plus className="size-4" />
                  {product.inStock ? "Adicionar" : "Esgotado"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
