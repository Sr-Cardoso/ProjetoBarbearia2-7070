import { useMemo, useState } from "react";
import {
  Boxes,
  Check,
  Package,
  PackageX,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageField } from "./image-field";
import { formatPrice } from "../lib/format";
import {
  useDeleteProduct,
  useSaveProduct,
  useStoreProducts,
  useStoreStats,
} from "../queries/store";

/** Formulário de produto no formato que a API espera. */
interface ProductForm {
  id?: number;
  name: string;
  description: string;
  category: string;
  price: string;
  salePrice: string;
  stock: string;
  imageUrl: string;
  images: string[];
  featured: boolean;
  active: boolean;
  sortOrder: string;
}

const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  category: "Geral",
  price: "",
  salePrice: "",
  stock: "0",
  imageUrl: "",
  images: [],
  featured: false,
  active: true,
  sortOrder: "0",
};

/** "39,90" | "39.90" -> 3990 centavos. */
function toCents(raw: string): number {
  const clean = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function fromCents(cents: number | null): string {
  return cents && cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

/** Aba Produtos: catálogo da loja com fotos, estoque, promoção e destaque. */
export function AdminProductsTab() {
  const products = useStoreProducts();
  const stats = useStoreStats();
  const save = useSaveProduct();
  const remove = useDeleteProduct();

  const [form, setForm] = useState<ProductForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const categories = useMemo(() => {
    const list = new Set<string>();
    for (const product of products.data ?? []) list.add(product.category);
    return [...list].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [products.data]);

  function patch(values: Partial<ProductForm>) {
    setForm((current) => (current ? { ...current, ...values } : current));
  }

  function edit(product: NonNullable<typeof products.data>[number]) {
    let images: string[] = [];
    try {
      const parsed: unknown = JSON.parse(product.images);
      if (Array.isArray(parsed)) images = parsed.filter((v): v is string => typeof v === "string");
    } catch {
      images = [];
    }
    setForm({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: fromCents(product.priceCents),
      salePrice: fromCents(product.salePriceCents),
      stock: String(product.stock),
      imageUrl: product.imageUrl ?? "",
      images,
      featured: product.featured,
      active: product.active,
      sortOrder: String(product.sortOrder),
    });
  }

  async function submit() {
    if (!form) return;
    await save.mutateAsync({
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim() || "Geral",
      priceCents: toCents(form.price),
      salePriceCents: form.salePrice ? toCents(form.salePrice) : null,
      stock: Number.parseInt(form.stock || "0", 10) || 0,
      imageUrl: form.imageUrl.trim(),
      images: form.images.filter(Boolean),
      featured: form.featured,
      active: form.active,
      sortOrder: Number.parseInt(form.sortOrder || "0", 10) || 0,
    });
    setForm(null);
  }

  const data = stats.data;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Produtos" value={data ? String(data.products) : "—"} icon={Package} />
        <MiniStat label="Ativos" value={data ? String(data.activeProducts) : "—"} icon={Check} />
        <MiniStat label="Sem estoque" value={data ? String(data.outOfStock) : "—"} icon={PackageX} />
        <MiniStat
          label="Recebido (pagos)"
          value={data ? formatPrice(data.paidRevenueCents) : "—"}
          icon={Boxes}
        />
      </div>

      <section className="bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="font-display text-xl">Catálogo da loja</h2>
            <p className="text-sm text-muted-foreground">
              O cliente monta o pedido no site e paga no WhatsApp ou no salão.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-[11px] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-primary-dark"
          >
            <Plus className="size-4" /> Novo produto
          </button>
        </div>

        {products.isLoading ? (
          <p className="px-6 py-10 text-sm text-muted-foreground">Carregando…</p>
        ) : products.data && products.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {products.data.map((product) => (
              <li key={product.id} className="flex flex-wrap items-center gap-5 px-6 py-4">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden border border-border bg-surface">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Package className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-52 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    {product.name}
                    {product.featured && (
                      <span className="inline-flex items-center gap-1 bg-primary/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-primary uppercase">
                        <Star className="size-2.5" /> Destaque
                      </span>
                    )}
                    {!product.active && (
                      <span className="bg-secondary px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        Inativo
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {product.category} · estoque {product.stock}
                  </p>
                </div>
                <div className="w-32 shrink-0">
                  {product.salePriceCents ? (
                    <p className="text-sm">
                      <span className="font-display text-lg text-primary">
                        {formatPrice(product.salePriceCents)}
                      </span>
                      <span className="ml-2 text-muted-foreground line-through">
                        {formatPrice(product.priceCents)}
                      </span>
                    </p>
                  ) : (
                    <p className="font-display text-lg">{formatPrice(product.priceCents)}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RowButton onClick={() => edit(product)}>
                    <Pencil className="size-3.5" /> Editar
                  </RowButton>
                  {confirmDelete === product.id ? (
                    <RowButton
                      danger
                      onClick={() => {
                        remove.mutate({ id: product.id });
                        setConfirmDelete(null);
                      }}
                    >
                      <Check className="size-3.5" /> Confirmar
                    </RowButton>
                  ) : (
                    <RowButton danger onClick={() => setConfirmDelete(product.id)}>
                      <Trash2 className="size-3.5" /> Excluir
                    </RowButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-sm text-muted-foreground">
            Nenhum produto cadastrado ainda. Clique em “Novo produto”.
          </p>
        )}
      </section>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-black/70 p-4 sm:p-8">
          <div className="mx-auto w-full max-w-2xl bg-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <h3 className="font-display text-xl">
                {form.id ? "Editar produto" : "Novo produto"}
              </h3>
              <button
                type="button"
                onClick={() => setForm(null)}
                aria-label="Fechar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <Field label="Nome" value={form.name} onChange={(v) => patch({ name: v })} />
              <label className="block">
                <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                  Descrição
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={3}
                  className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                    Categoria
                  </span>
                  <input
                    value={form.category}
                    onChange={(e) => patch({ category: e.target.value })}
                    list="categorias-produto"
                    className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                  <datalist id="categorias-produto">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </label>
                <Field
                  label="Estoque"
                  value={form.stock}
                  onChange={(v) => patch({ stock: v.replace(/\D/g, "") })}
                />
                <Field
                  label="Preço (R$)"
                  value={form.price}
                  onChange={(v) => patch({ price: v })}
                />
                <Field
                  label="Preço promocional (opcional)"
                  value={form.salePrice}
                  onChange={(v) => patch({ salePrice: v })}
                />
              </div>

              <ImageField
                label="Foto principal"
                value={form.imageUrl}
                onChange={(v) => patch({ imageUrl: v })}
              />

              <div>
                <span className="eyebrow text-[10px] text-muted-foreground">Fotos extras</span>
                <div className="mt-2 space-y-3">
                  {form.images.map((image, index) => (
                    <div key={index} className="flex items-end gap-3">
                      <div className="flex-1">
                        <ImageField
                          label={`Foto ${index + 2}`}
                          value={image}
                          onChange={(v) =>
                            patch({
                              images: form.images.map((item, i) => (i === index ? v : item)),
                            })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          patch({ images: form.images.filter((_, i) => i !== index) })
                        }
                        aria-label="Remover foto"
                        className="mb-1 grid size-9 place-items-center border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => patch({ images: [...form.images, ""] })}
                    className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary"
                  >
                    <Plus className="size-3.5" /> Adicionar foto
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <Toggle
                  label="Destaque na home"
                  checked={form.featured}
                  onChange={(v) => patch({ featured: v })}
                />
                <Toggle
                  label="Ativo na loja"
                  checked={form.active}
                  onChange={(v) => patch({ active: v })}
                />
                <label className="flex items-center gap-3">
                  <span className="eyebrow text-[10px] text-muted-foreground">Ordem</span>
                  <input
                    value={form.sortOrder}
                    onChange={(e) => patch({ sortOrder: e.target.value.replace(/[^\d-]/g, "") })}
                    className="w-16 border border-input px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </div>

              {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={save.isPending || form.name.trim().length < 2}
                  className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
                >
                  <Check className="size-4" /> Salvar produto
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="border border-border px-6 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Package;
}) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[10px] text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-3 font-display text-3xl text-foreground">{value}</p>
    </div>
  );
}

function RowButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors",
        danger
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}
