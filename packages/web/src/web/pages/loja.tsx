import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Check,
  Loader2,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SiteTheme } from "../components/site-theme";
import { useSiteContent } from "../queries/content";
import { useCreateOrder, useLinkableAppointments, useProducts } from "../queries/shop";
import {
  addToCart,
  cartCount,
  cartTotal,
  clearCart,
  removeFromCart,
  setQuantity,
  useCart,
} from "../lib/cart";
import { formatDateBr, formatPrice, maskPhone } from "../lib/format";

type Product = NonNullable<ReturnType<typeof useProducts>["data"]>["items"][number];

interface Success {
  orderId: number;
  totalCents: number;
  items: { name: string; quantity: number; totalCents: number }[];
  appointment: { date: string; range: string } | null;
  whatsappUrl: string | null;
}

const TODOS = "Todos";

export default function Loja() {
  const content = useSiteContent();
  const catalog = useProducts();
  const cart = useCart();
  const createOrder = useCreateOrder();

  const [category, setCategory] = useState(TODOS);
  const [openCart, setOpenCart] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const appointments = useLinkableAppointments(phone);
  const items = catalog.data?.items ?? [];
  const categories = [TODOS, ...(catalog.data?.categories ?? [])];

  const visible = useMemo(
    () => (category === TODOS ? items : items.filter((item) => item.category === category)),
    [items, category],
  );

  const total = cartTotal(cart);
  const count = cartCount(cart);
  const canSubmit = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10 && count > 0;

  function submit() {
    setError(null);
    createOrder.mutate(
      {
        items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        customerName: name.trim(),
        customerPhone: phone.trim(),
        notes: notes.trim() || undefined,
        appointmentId,
      },
      {
        onSuccess: (data) => {
          setSuccess({
            orderId: data.order.id,
            totalCents: data.totalCents,
            items: data.items,
            appointment: data.appointment
              ? { date: data.appointment.date, range: data.appointment.range }
              : null,
            whatsappUrl: data.whatsappUrl,
          });
          clearCart();
          setOpenCart(false);
          setCheckout(false);
          catalog.refetch();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
        },
      },
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteTheme content={content} />
        <SiteHeader />
        <section className="hero-gradient noise px-5 pt-32 pb-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center text-white">
            <span className="rise d1 mx-auto grid size-16 place-items-center bg-card/15">
              <Check className="size-8" strokeWidth={2.4} />
            </span>
            <h1 className="rise d2 mt-8 font-display text-4xl md:text-5xl">
              Pedido #{success.orderId} enviado
            </h1>
            <p className="rise d3 mt-4 text-white/80">
              {success.appointment
                ? `Separamos tudo para o seu horário de ${formatDateBr(success.appointment.date)}, ${success.appointment.range}. Você paga no salão junto com o serviço.`
                : "Reservamos os produtos no balcão. Combine o pagamento e a retirada pelo WhatsApp."}
            </p>

            <div className="rise d4 mt-10 bg-card/10 p-7 text-left">
              <ul className="space-y-2.5 text-sm text-white/85">
                {success.items.map((item) => (
                  <li key={item.name} className="flex justify-between gap-4">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span>{formatPrice(item.totalCents)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-white/15 pt-4 font-display text-xl text-white">
                <span>Total</span>
                <span>{formatPrice(success.totalCents)}</span>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {success.whatsappUrl && (
                  <a
                    href={success.whatsappUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center gap-2 bg-card px-7 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-foreground uppercase transition-colors hover:bg-primary/90"
                  >
                    <ShoppingBag className="size-4" />
                    Combinar no WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSuccess(null)}
                  className="border border-white/35 px-7 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary/10"
                >
                  Continuar comprando
                </button>
              </div>
            </div>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteTheme content={content} />
      <SiteHeader />

      <section className="hero-gradient noise px-5 pt-28 pb-16 lg:px-8">
        <div className="mx-auto max-w-6xl text-white">
          <span className="eyebrow rise d1 text-white/70">{content.shop.pageEyebrow}</span>
          <h1 className="rise d2 mt-4 max-w-2xl font-display text-4xl leading-[1.05] md:text-6xl">
            {content.shop.pageTitle}
          </h1>
          <p className="rise d3 mt-4 max-w-xl text-white/80">
            {content.shop.pageText}
          </p>
        </div>
      </section>

      <section className="px-5 pb-28 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative z-10 -mt-10">
            {/* Categorias */}
            <div className="flex flex-wrap gap-2 bg-card p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)]">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={cn(
                    "px-4 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors",
                    category === item
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>

            {catalog.isLoading && (
              <div className="flex items-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando produtos...
              </div>
            )}

            {!catalog.isLoading && visible.length === 0 && (
              <div className="mt-8 border border-dashed border-border p-12 text-center text-muted-foreground">
                <Package className="mx-auto size-8 opacity-50" />
                <p className="mt-3 text-sm">Nenhum produto nesta categoria por enquanto.</p>
              </div>
            )}

            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={() => setOpenCart(true)} />
              ))}
            </div>
          </div>

          {/* Carrinho (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 bg-card p-6">
              <CartPanel
                cart={cart}
                total={total}
                onCheckout={() => setCheckout(true)}
                compact={false}
              />
            </div>
          </aside>
        </div>
      </section>

      {/* Barra do carrinho (mobile) */}
      {count > 0 && (
        <button
          type="button"
          onClick={() => setOpenCart(true)}
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between bg-primary px-5 py-4 text-white lg:hidden"
        >
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
            <ShoppingBag className="size-4" />
            {count} {count === 1 ? "item" : "itens"}
          </span>
          <span className="font-display text-lg">{formatPrice(total)}</span>
        </button>
      )}

      {/* Gaveta do carrinho (mobile) */}
      {openCart && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpenCart(false)}
            className="flex-1 bg-black/70"
          />
          <div className="w-[86%] max-w-sm overflow-y-auto bg-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl">Seu carrinho</h2>
              <button type="button" onClick={() => setOpenCart(false)} aria-label="Fechar">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
            <CartPanel
              cart={cart}
              total={total}
              onCheckout={() => {
                setOpenCart(false);
                setCheckout(true);
              }}
              compact
            />
          </div>
        </div>
      )}

      {/* Checkout */}
      {checkout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-lg bg-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="eyebrow text-primary">Finalizar pedido</span>
                <h2 className="mt-2 font-display text-2xl">Onde te encontramos?</h2>
              </div>
              <button type="button" onClick={() => setCheckout(false)} aria-label="Fechar">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              O pagamento é combinado no WhatsApp ou feito no salão na retirada.
            </p>

            <div className="mt-6 space-y-4">
              <Field label="Seu nome">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </Field>

              {(appointments.data?.length ?? 0) > 0 && (
                <Field label="Somar na comanda de um horário?">
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setAppointmentId(null)}
                      className={cn(
                        "w-full border px-4 py-3 text-left text-sm transition-colors",
                        appointmentId === null
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary",
                      )}
                    >
                      Não, só retirar os produtos
                    </button>
                    {appointments.data?.map((appointment) => (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => setAppointmentId(appointment.id)}
                        className={cn(
                          "w-full border px-4 py-3 text-left text-sm transition-colors",
                          appointmentId === appointment.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary",
                        )}
                      >
                        <span className="block font-medium text-foreground">
                          {formatDateBr(appointment.date)} · {appointment.range}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {appointment.serviceName} com {appointment.barberName} ·{" "}
                          {formatPrice(appointment.servicePriceCents)} + produtos
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Observação (opcional)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex.: prefiro retirar na sexta à tarde"
                  className="w-full resize-none border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </Field>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
              <span className="eyebrow text-muted-foreground">Total</span>
              <span className="font-display text-2xl text-primary">{formatPrice(total)}</span>
            </div>

            {error && <p className="mt-4 bg-primary/10 p-3 text-sm text-primary">{error}</p>}

            <button
              type="button"
              disabled={!canSubmit || createOrder.isPending}
              onClick={submit}
              className="mt-5 flex w-full items-center justify-center gap-2 bg-primary py-4 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
            >
              {createOrder.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShoppingBag className="size-4" />
              )}
              Enviar pedido
            </button>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const gallery = [product.imageUrl, ...product.gallery].filter(Boolean) as string[];
  const [active, setActive] = useState(0);
  const image = gallery[active] ?? null;

  return (
    <article className="flex flex-col bg-card">
      <div className="relative aspect-square bg-white">
        {image ? (
          <img src={image} alt={product.name} className="size-full object-contain p-4" />
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
        {product.featured && !product.onSale && (
          <span className="absolute top-3 left-3 flex items-center gap-1 bg-black px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-white uppercase">
            <Sparkles className="size-3" /> Destaque
          </span>
        )}
        {!product.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/80 py-2 text-center text-[10px] font-semibold tracking-[0.18em] text-white uppercase">
            Esgotado
          </span>
        )}

        {gallery.length > 1 && (
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {gallery.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Foto ${index + 1} de ${product.name}`}
                className={cn(
                  "size-9 border bg-white p-1",
                  index === active ? "border-primary" : "border-black/15",
                )}
              >
                <img src={src} alt="" className="size-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <span className="eyebrow text-[10px] text-primary">{product.category}</span>
        <h3 className="mt-2 font-display text-lg leading-tight text-foreground">{product.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3">
          <span>
            {product.listPriceCents && (
              <span className="block text-xs text-muted-foreground line-through">
                {formatPrice(product.listPriceCents)}
              </span>
            )}
            <span className="font-display text-xl text-foreground">
              {formatPrice(product.priceCents)}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {product.inStock ? `${product.stock} em estoque` : "—"}
          </span>
        </div>

        <button
          type="button"
          disabled={!product.inStock}
          onClick={() => {
            addToCart(
              {
                productId: product.id,
                name: product.name,
                priceCents: product.priceCents,
                imageUrl: product.imageUrl,
              },
              product.stock,
            );
            onAdd();
          }}
          className="mt-4 flex items-center justify-center gap-2 bg-primary py-3 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-4" />
          {product.inStock ? "Adicionar" : "Indisponível"}
        </button>
      </div>
    </article>
  );
}

function CartPanel({
  cart,
  total,
  onCheckout,
  compact,
}: {
  cart: ReturnType<typeof useCart>;
  total: number;
  onCheckout: () => void;
  compact: boolean;
}) {
  const { shop } = useSiteContent();

  if (cart.length === 0) {
    return (
      <div className="text-center">
        {!compact && <h2 className="font-display text-xl">Seu carrinho</h2>}
        <ShoppingBag className="mx-auto mt-6 size-8 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">
          Carrinho vazio. Escolha um produto para começar.
        </p>
        <Link
          to="/agendar"
          className="mt-6 inline-block border border-border px-5 py-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:border-primary hover:text-primary"
        >
          Agendar horário
        </Link>
      </div>
    );
  }

  return (
    <div>
      {!compact && <h2 className="font-display text-xl">Seu carrinho</h2>}
      <ul className="mt-5 space-y-4">
        {cart.map((line) => (
          <li key={line.productId} className="flex gap-3">
            <span className="size-14 shrink-0 bg-white p-1">
              {line.imageUrl ? (
                <img src={line.imageUrl} alt={line.name} className="size-full object-contain" />
              ) : (
                <Package className="size-full p-3 text-muted-foreground/40" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {line.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatPrice(line.priceCents)} cada
              </span>
              <span className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Menos"
                  onClick={() => setQuantity(line.productId, line.quantity - 1)}
                  className="grid size-7 place-items-center border border-border transition-colors hover:border-primary"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-6 text-center text-sm">{line.quantity}</span>
                <button
                  type="button"
                  aria-label="Mais"
                  onClick={() => setQuantity(line.productId, line.quantity + 1)}
                  className="grid size-7 place-items-center border border-border transition-colors hover:border-primary"
                >
                  <Plus className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label="Remover"
                  onClick={() => removeFromCart(line.productId)}
                  className="ml-auto text-muted-foreground transition-colors hover:text-primary"
                >
                  <Trash2 className="size-4" />
                </button>
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
        <span className="eyebrow text-muted-foreground">Total</span>
        <span className="font-display text-2xl text-primary">{formatPrice(total)}</span>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        className="mt-4 w-full bg-primary py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark"
      >
        Finalizar pedido
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">{shop.checkoutNote}</p>
    </div>
  );
}
