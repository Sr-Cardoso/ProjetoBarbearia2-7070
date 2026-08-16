import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";

/**
 * Unidades (multi-tenant por domínio). Cada domínio tem a própria agenda,
 * serviços, barbeiros, bloqueios e configurações.
 */
export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull().unique(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** E-mails Google autorizados a administrar uma unidade. */
export const tenantAdmins = sqliteTable(
  "tenant_admins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: text("email").notNull(),
    /** Nome de referência do convidado (só para o dono se localizar na lista). */
    name: text("name").notNull().default(""),
    /** Super admin gerencia todas as unidades. */
    superAdmin: integer("super_admin", { mode: "boolean" }).notNull().default(false),
    /**
     * Áreas do painel liberadas para esse e-mail (CSV — ver `lib/permissions.ts`).
     * Vazio = sem nenhuma aba. Super admin ignora o campo e vê tudo.
     */
    sections: text("sections").notNull().default(""),
    /**
     * Pode configurar a integração de plataforma de mensagens (BlipBeauty ou
     * outra). Falso por padrão: convidado não vê URL nem API key.
     */
    canIntegrations: integer("can_integrations", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique("tenant_admins_tenant_email_uq").on(table.tenantId, table.email)],
);

/** Serviços oferecidos pela barbearia (corte, barba, combo...). */
export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull().default(90),
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Profissionais que atendem. */
export const barbers = sqliteTable("barbers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  role: text("role").notNull().default("Barbeiro"),
  bio: text("bio").notNull().default(""),
  photoUrl: text("photo_url"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Agendamentos. `date` é YYYY-MM-DD e `slot` é o início do bloco (HH:MM),
 * sempre um dos blocos fixos de 1h30 definidos em routes/schedule.ts.
 */
export const appointments = sqliteTable(
  "appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id),
    barberId: integer("barber_id")
      .notNull()
      .references(() => barbers.id),
    date: text("date").notNull(),
    slot: text("slot").notNull(),
    /** Conta do cliente, quando o agendamento foi feito logado. */
    userId: text("user_id"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    notes: text("notes").notNull().default(""),
    /** pending | confirmed | done | cancelled */
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("appointments_date_idx").on(table.date)],
);

/** Bloqueios manuais: dia inteiro (slot null) ou um horário específico. */
export const blocks = sqliteTable(
  "blocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** null = bloqueia todos os barbeiros */
    barberId: integer("barber_id").references(() => barbers.id),
    date: text("date").notNull(),
    /** null = dia inteiro */
    slot: text("slot"),
    reason: text("reason").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("blocks_date_idx").on(table.date)],
);

/**
 * Aberturas extraordinárias: libera um dia que estaria fechado pela regra
 * semanal (setting `workDays`), para o dono abrir horários quando precisar.
 */
export const openDays = sqliteTable(
  "open_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    date: text("date").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("open_days_tenant_date_uq").on(table.tenantId, table.date),
    index("open_days_date_idx").on(table.date),
  ],
);

/** Configurações simples chave/valor (whatsapp, endereço, textos). */
export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (table) => [unique("settings_tenant_key_uq").on(table.tenantId, table.key)],
);

/** Produtos vendidos na loja do salão (pomadas, shampoos, acessórios...). */
export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Categoria livre: pomada, shampoo, barba, acessórios... */
    category: text("category").notNull().default("Geral"),
    priceCents: integer("price_cents").notNull(),
    /** Preço promocional — quando preenchido, vira o preço cobrado. */
    salePriceCents: integer("sale_price_cents"),
    stock: integer("stock").notNull().default(0),
    /** Foto principal. */
    imageUrl: text("image_url"),
    /** Fotos extras (JSON com array de URLs). */
    images: text("images").notNull().default("[]"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("products_tenant_idx").on(table.tenantId)],
);

/**
 * Pedido da loja. O pagamento é combinado no WhatsApp ou feito no salão;
 * quando `appointmentId` está preenchido o pedido entra na comanda do corte.
 */
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Conta do cliente, quando o pedido foi feito logado. */
    userId: text("user_id"),
    /** Agendamento ao qual o pedido está vinculado (comanda única). */
    appointmentId: integer("appointment_id").references(() => appointments.id),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    notes: text("notes").notNull().default(""),
    totalCents: integer("total_cents").notNull().default(0),
    /** pending | confirmed | paid | cancelled */
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("orders_tenant_idx").on(table.tenantId),
    index("orders_appointment_idx").on(table.appointmentId),
  ],
);

/** Itens do pedido, com nome e preço congelados no momento da compra. */
export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id),
    name: text("name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

/**
 * Fila de mensagens automáticas (lembrete de horário e reativação de
 * clientes inativos). O worker em `lib/messenger.ts` envia o que estiver
 * vencido; sem provedor configurado a mensagem fica pronta para envio
 * manual pelo painel (link do WhatsApp).
 */
export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** reminder | reactivation */
    kind: text("kind").notNull(),
    /** whatsapp | sms | manual */
    channel: text("channel").notNull().default("manual"),
    toPhone: text("to_phone").notNull(),
    toName: text("to_name").notNull().default(""),
    body: text("body").notNull(),
    appointmentId: integer("appointment_id").references(() => appointments.id),
    userId: text("user_id"),
    /** Evita duplicar a mesma mensagem para o mesmo cliente/agendamento. */
    dedupeKey: text("dedupe_key").notNull(),
    /** queued | sent | failed | cancelled */
    status: text("status").notNull().default("queued"),
    error: text("error"),
    scheduledFor: integer("scheduled_for", { mode: "timestamp" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("messages_tenant_dedupe_uq").on(table.tenantId, table.dedupeKey),
    index("messages_status_idx").on(table.status),
  ],
);

/**
 * Conteúdo editável do site por unidade: rascunho (`draft`) e versão
 * publicada (`published`), ambos JSON serializado de `SiteContent`.
 */
export const siteContent = sqliteTable("site_content", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id)
    .unique(),
  draft: text("draft").notNull().default("{}"),
  published: text("published").notNull().default("{}"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  publishedAt: integer("published_at", { mode: "timestamp" }),
});

export * from "./auth-schema";
