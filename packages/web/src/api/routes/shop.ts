/**
 * Loja da barbearia (parte pública).
 *
 * O cliente monta o carrinho no site e envia o pedido; o pagamento é
 * combinado no WhatsApp ou feito no salão. Quando o pedido é vinculado a um
 * agendamento futuro, os produtos entram na comanda daquele horário
 * (corte + produtos = total a pagar no salão).
 */
import { z } from "zod";
import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as schema from "../database/schema";
import { tenantBase, withUser } from "../middleware/auth";
import {
  BUSY_STATUSES,
  formatPrice,
  normalizePhone,
  slotRange,
  todayISO,
} from "../lib/schedule";

/** Preço realmente cobrado: promocional quando houver. */
export function chargedPrice(product: { priceCents: number; salePriceCents: number | null }) {
  return product.salePriceCents && product.salePriceCents > 0
    ? product.salePriceCents
    : product.priceCents;
}

/** Fotos extras guardadas como JSON no banco. */
function parseImages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

type ProductRow = typeof schema.products.$inferSelect;

/** Formato exposto ao front (preço já resolvido e galeria pronta). */
export function toPublicProduct(row: ProductRow) {
  const price = chargedPrice(row);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category || "Geral",
    priceCents: price,
    listPriceCents: price === row.priceCents ? null : row.priceCents,
    onSale: price !== row.priceCents,
    stock: row.stock,
    inStock: row.stock > 0,
    imageUrl: row.imageUrl ?? null,
    gallery: parseImages(row.images),
    featured: row.featured,
  };
}

const orderItemInput = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
});

export const shop = {
  /** Catálogo ativo, agrupado por categoria. */
  products: tenantBase.handler(async ({ context }) => {
    const rows = await db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.tenantId, context.tenant.id), eq(schema.products.active, true)))
      .orderBy(asc(schema.products.sortOrder), asc(schema.products.id));

    const items = rows.map(toPublicProduct);
    const categories = [...new Set(items.map((item) => item.category))];

    return { items, categories };
  }),

  /** Produtos marcados como destaque — usados na home. */
  featured: tenantBase.handler(async ({ context }) => {
    const rows = await db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.tenantId, context.tenant.id),
          eq(schema.products.active, true),
          eq(schema.products.featured, true),
        ),
      )
      .orderBy(asc(schema.products.sortOrder), asc(schema.products.id));

    return rows.map(toPublicProduct);
  }),

  /**
   * Agendamentos futuros aos quais o pedido pode ser vinculado.
   * Encontra pela conta logada ou pelo telefone informado no checkout.
   */
  linkableAppointments: withUser
    .input(z.object({ phone: z.string().trim().max(30).optional() }))
    .handler(async ({ input, context }) => {
      const digits = input.phone ? normalizePhone(input.phone).slice(-8) : "";
      const userId = context.user?.id ?? null;
      if (!userId && digits.length < 8) return [];

      const rows = await db
        .select({
          id: schema.appointments.id,
          date: schema.appointments.date,
          slot: schema.appointments.slot,
          phone: schema.appointments.customerPhone,
          userId: schema.appointments.userId,
          serviceName: schema.services.name,
          servicePriceCents: schema.services.priceCents,
          barberName: schema.barbers.name,
        })
        .from(schema.appointments)
        .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
        .innerJoin(schema.barbers, eq(schema.barbers.id, schema.appointments.barberId))
        .where(
          and(
            eq(schema.appointments.tenantId, context.tenant.id),
            gte(schema.appointments.date, todayISO()),
            inArray(schema.appointments.status, [...BUSY_STATUSES]),
          ),
        )
        .orderBy(asc(schema.appointments.date), asc(schema.appointments.slot));

      return rows
        .filter(
          (row) =>
            (userId && row.userId === userId) ||
            (digits.length >= 8 && normalizePhone(row.phone).endsWith(digits)),
        )
        .map((row) => ({
          id: row.id,
          date: row.date,
          slot: row.slot,
          range: slotRange(row.slot),
          serviceName: row.serviceName,
          servicePriceCents: row.servicePriceCents,
          barberName: row.barberName,
        }));
    }),

  /**
   * Fecha o pedido: valida estoque, congela nome/preço dos itens, baixa o
   * estoque e devolve um link de WhatsApp já preenchido para combinar o
   * pagamento e a retirada.
   */
  createOrder: withUser
    .input(
      z.object({
        items: z.array(orderItemInput).min(1, "Adicione pelo menos um produto"),
        customerName: z.string().trim().min(2, "Informe seu nome"),
        customerPhone: z.string().trim().min(8, "Informe um WhatsApp válido"),
        notes: z.string().trim().max(500).optional(),
        appointmentId: z.number().int().positive().nullable().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const tenantId = context.tenant.id;

      // Soma quantidades repetidas do mesmo produto.
      const wanted = new Map<number, number>();
      for (const item of input.items) {
        wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + item.quantity);
      }

      const rows = await db
        .select()
        .from(schema.products)
        .where(
          and(
            eq(schema.products.tenantId, tenantId),
            eq(schema.products.active, true),
            inArray(schema.products.id, [...wanted.keys()]),
          ),
        );

      if (rows.length !== wanted.size) {
        throw new ORPCError("NOT_FOUND", {
          message: "Um dos produtos saiu do catálogo. Revise o carrinho.",
        });
      }

      const lines = rows.map((product) => {
        const quantity = wanted.get(product.id)!;
        if (product.stock < quantity) {
          throw new ORPCError("CONFLICT", {
            message: `Temos apenas ${product.stock} unidade(s) de ${product.name} em estoque.`,
          });
        }
        const unitPriceCents = chargedPrice(product);
        return { product, quantity, unitPriceCents, totalCents: unitPriceCents * quantity };
      });

      const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);

      // Vínculo opcional com um agendamento futuro (comanda única).
      let appointment: { id: number; date: string; slot: string } | null = null;
      if (input.appointmentId) {
        const digits = normalizePhone(input.customerPhone).slice(-8);
        const [found] = await db
          .select()
          .from(schema.appointments)
          .where(
            and(
              eq(schema.appointments.id, input.appointmentId),
              eq(schema.appointments.tenantId, tenantId),
              inArray(schema.appointments.status, [...BUSY_STATUSES]),
              context.user?.id
                ? or(
                    eq(schema.appointments.userId, context.user.id),
                    eq(schema.appointments.customerPhone, input.customerPhone),
                  )
                : undefined,
            ),
          );

        if (!found) {
          throw new ORPCError("NOT_FOUND", { message: "Agendamento não encontrado." });
        }
        if (!context.user?.id && !normalizePhone(found.customerPhone).endsWith(digits)) {
          throw new ORPCError("FORBIDDEN", {
            message: "Esse agendamento é de outro WhatsApp.",
          });
        }
        appointment = { id: found.id, date: found.date, slot: found.slot };
      }

      const [order] = await db
        .insert(schema.orders)
        .values({
          tenantId,
          userId: context.user?.id ?? null,
          appointmentId: appointment?.id ?? null,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          notes: input.notes ?? "",
          totalCents,
          status: "pending",
        })
        .returning();

      await db.insert(schema.orderItems).values(
        lines.map((line) => ({
          orderId: order!.id,
          productId: line.product.id,
          name: line.product.name,
          unitPriceCents: line.unitPriceCents,
          quantity: line.quantity,
        })),
      );

      // Baixa de estoque item por item.
      for (const line of lines) {
        await db
          .update(schema.products)
          .set({ stock: Math.max(line.product.stock - line.quantity, 0) })
          .where(eq(schema.products.id, line.product.id));
      }

      const settings = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.tenantId, tenantId));
      const whatsapp = normalizePhone(
        settings.find((row) => row.key === "whatsapp")?.value ?? "",
      );

      const list = lines
        .map((line) => `• ${line.quantity}x ${line.product.name} — ${formatPrice(line.totalCents)}`)
        .join("%0A");
      const retirada = appointment
        ? `%0A*Retirada:* no meu horário de ${appointment.date
            .split("-")
            .reverse()
            .join("/")} às ${slotRange(appointment.slot)}`
        : "";
      const message =
        `Olá! Fiz o pedido *#${order!.id}* na loja da ${context.tenant.name}.%0A%0A` +
        `*Cliente:* ${input.customerName}%0A${list}%0A` +
        `*Total:* ${formatPrice(totalCents)}${retirada}`;

      return {
        order: order!,
        items: lines.map((line) => ({
          name: line.product.name,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.totalCents,
        })),
        totalCents,
        appointment: appointment
          ? { ...appointment, range: slotRange(appointment.slot) }
          : null,
        whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}?text=${message}` : null,
      };
    }),

  /** Pedidos da conta logada, com os itens. */
  myOrders: withUser.handler(async ({ context }) => {
    if (!context.user) return [];

    const orders = await db
      .select()
      .from(schema.orders)
      .where(
        and(eq(schema.orders.tenantId, context.tenant.id), eq(schema.orders.userId, context.user.id)),
      )
      .orderBy(asc(schema.orders.id));

    if (orders.length === 0) return [];

    const items = await db
      .select()
      .from(schema.orderItems)
      .where(
        inArray(
          schema.orderItems.orderId,
          orders.map((order) => order.id),
        ),
      );

    return orders
      .map((order) => ({
        ...order,
        items: items.filter((item) => item.orderId === order.id),
      }))
      .reverse();
  }),
};
