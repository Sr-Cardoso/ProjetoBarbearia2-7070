/**
 * Conteúdo editável do site (CMS por unidade).
 *
 * Este arquivo é puro (sem dependências de servidor) porque também é
 * importado pelo frontend para tipagem e valores padrão.
 */

export type Stat = { value: string; label: string };
export type Highlight = { icon: string; title: string; text: string };
export type Testimonial = { quote: string; author: string };
export type HourRow = { day: string; time: string };

export type SiteContent = {
  brand: {
    logoUrl: string;
    name: string;
    nameShort: string;
    tagline: string;
  };
  theme: {
    background: string;
    surface: string;
    primary: string;
    primaryDark: string;
    foreground: string;
  };
  seo: {
    title: string;
    description: string;
    ogImage: string;
  };
  nav: {
    ctaLabel: string;
    links: { label: string; href: string }[];
  };
  hero: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    titleAccent: string;
    text: string;
    primaryCta: string;
    secondaryCta: string;
    image: string;
    stats: Stat[];
    badgeEnabled: boolean;
    badgeTitle: string;
    badgeText: string;
  };
  highlights: {
    enabled: boolean;
    items: Highlight[];
  };
  about: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    titleAccent: string;
    image: string;
    paragraphs: string[];
    bullets: string[];
  };
  services: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    text: string;
  };
  gallery: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    text: string;
    images: string[];
  };
  team: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    text: string;
  };
  pricing: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    text: string;
    ctaLabel: string;
  };
  shop: {
    /** Vitrine de destaques na home. */
    enabled: boolean;
    eyebrow: string;
    title: string;
    text: string;
    ctaLabel: string;
    /** Topo da página /loja. */
    pageEyebrow: string;
    pageTitle: string;
    pageText: string;
    /** Aviso exibido no resumo do carrinho. */
    checkoutNote: string;
  };
  testimonials: {
    enabled: boolean;
    items: Testimonial[];
  };
  cta: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    text: string;
    image: string;
    primaryLabel: string;
    secondaryLabel: string;
  };
  footer: {
    about: string;
    ctaLabel: string;
    hoursTitle: string;
    hours: HourRow[];
    note: string;
  };
};

/** Ícones disponíveis para os destaques (mapeados no frontend). */
export const HIGHLIGHT_ICONS = [
  "clock",
  "shield",
  "sparkles",
  "scissors",
  "star",
  "calendar",
  "map-pin",
  "heart",
] as const;

export const DEFAULT_CONTENT: SiteContent = {
  brand: {
    logoUrl: "/images/logo.png",
    name: "Barbearia Cardoso",
    nameShort: "Cardoso",
    tagline: "Barbearia",
  },
  theme: {
    background: "#000000",
    surface: "#141414",
    primary: "#e50914",
    primaryDark: "#b20710",
    foreground: "#f5f5f5",
  },
  seo: {
    title: "Barbearia Cardoso — Agendamento Online",
    description:
      "Barbearia Cardoso — corte, barba e navalha. Agende seu horário online em segundos.",
    ogImage: "/og-image.png",
  },
  nav: {
    ctaLabel: "Agendar",
    links: [
      { label: "Serviços", href: "/#servicos" },
      { label: "Equipe", href: "/#equipe" },
      { label: "Preços", href: "/#precos" },
      { label: "Contato", href: "/#contato" },
    ],
  },
  hero: {
    enabled: true,
    eyebrow: "Seg — Sex · 08h às 18h",
    title: "Seu horário na cadeira certa,",
    titleAccent: "sem espera.",
    text: "Escolha o serviço, o profissional e o horário. A agenda é atualizada em tempo real — o que aparece disponível está realmente livre.",
    primaryCta: "Agendar horário",
    secondaryCta: "Ver serviços",
    image: "/images/hero-barber.jpg",
    stats: [
      { value: "14", label: "anos de navalha" },
      { value: "6", label: "horários por dia" },
      { value: "4.9", label: "avaliação dos clientes" },
    ],
    badgeEnabled: true,
    badgeTitle: "Nota 4,9 de 5",
    badgeText: "mais de 800 atendimentos",
  },
  highlights: {
    enabled: true,
    items: [
      {
        icon: "clock",
        title: "1h30 por cliente",
        text: "Blocos exclusivos de uma hora e meia. Ninguém espera na fila.",
      },
      {
        icon: "shield",
        title: "Horário garantido",
        text: "O sistema bloqueia o horário no mesmo instante em que você agenda.",
      },
      {
        icon: "sparkles",
        title: "Acabamento na navalha",
        text: "Toalha quente, óleo e finalização feita à mão em todo atendimento.",
      },
    ],
  },
  about: {
    enabled: true,
    eyebrow: "A casa",
    title: "Barbearia de bairro com",
    titleAccent: "padrão de ateliê",
    image: "/images/sobre.jpg",
    paragraphs: [
      "A Cardoso nasceu de uma ideia simples: cada cliente merece tempo. Por isso trabalhamos com blocos de 1h30 — dá espaço para conversar, ajustar detalhe por detalhe e entregar o corte do jeito que você imaginou.",
      "Tesoura, máquina, navalha e toalha quente. Nada de pressa e nada de improviso.",
    ],
    bullets: [
      "Agenda online 24h",
      "Confirmação no WhatsApp",
      "Profissionais fixos",
      "Produtos de barbearia premium",
    ],
  },
  services: {
    enabled: true,
    eyebrow: "Serviços",
    title: "O que fazemos na cadeira",
    text: "Todos os serviços ocupam um bloco de 1h30. Escolha o seu na hora de agendar.",
  },
  gallery: {
    enabled: true,
    eyebrow: "Trabalhos",
    title: "Feito aqui dentro",
    text: "Uma amostra do acabamento que sai da cadeira todos os dias.",
    images: [
      "/images/galeria-1.jpg",
      "/images/galeria-2.jpg",
      "/images/galeria-3.jpg",
      "/images/galeria-4.jpg",
    ],
  },
  team: {
    enabled: true,
    eyebrow: "Equipe",
    title: "Escolha quem vai te atender",
    text: "Cada profissional tem agenda própria. Na hora de agendar você decide com quem senta.",
  },
  pricing: {
    enabled: true,
    eyebrow: "Tabela",
    title: "Preços claros, sem surpresa",
    text: "O valor é o mesmo com qualquer profissional da casa. Pagamento no local: dinheiro, cartão ou Pix.",
    ctaLabel: "Reservar meu horário",
  },
  shop: {
    enabled: true,
    eyebrow: "Loja da barbearia",
    title: "Leve para casa o que usamos na cadeira",
    text: "Pomadas, óleos e acessórios testados no dia a dia. Peça pelo site e pague no salão — se você tem horário marcado, entra na mesma comanda.",
    ctaLabel: "Ver a loja",
    pageEyebrow: "Loja da barbearia",
    pageTitle: "Os produtos que usamos na cadeira",
    pageText:
      "Faça o pedido aqui e pague no salão ou combine pelo WhatsApp. Se você já tem horário marcado, os produtos entram na mesma comanda do seu atendimento.",
    checkoutNote: "Sem pagamento online: você paga no salão ou combina pelo WhatsApp.",
  },
  testimonials: {
    enabled: true,
    items: [
      {
        quote:
          "Marquei pelo site em trinta segundos, cheguei e a cadeira estava me esperando. É o único lugar em que não perco meia hora de sábado na fila.",
        author: "Marcelo A. — cliente desde 2021",
      },
    ],
  },
  cta: {
    enabled: true,
    eyebrow: "Vamos nessa",
    title: "Escolha seu horário agora",
    text: "A agenda abre 6 horários por dia, de segunda a sexta. Depois de confirmar, você recebe a mensagem pronta para enviar no nosso WhatsApp.",
    image: "/images/cta.jpg",
    primaryLabel: "Agendar horário",
    secondaryLabel: "Falar com a barbearia",
  },
  footer: {
    about:
      "Corte, barba e navalha com acabamento de verdade. Cada atendimento tem 1h30 reservada só para você — sem fila, sem pressa.",
    ctaLabel: "Agendar horário",
    hoursTitle: "Funcionamento",
    hours: [
      { day: "Seg — Sex", time: "08:00 — 18:00" },
      { day: "Sábado", time: "Fechado" },
      { day: "Domingo", time: "Fechado" },
    ],
    note: "Atendimentos em blocos de 1h30",
  },
};

type Plain = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Mescla o conteúdo salvo sobre os padrões — campos novos nunca ficam vazios. */
export function mergeContent(stored: unknown): SiteContent {
  const merge = (base: unknown, patch: unknown): unknown => {
    if (!isPlainObject(base) || !isPlainObject(patch)) {
      return patch === undefined ? base : patch;
    }
    const out: Plain = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      out[key] = key in base ? merge(base[key], value) : value;
    }
    return out;
  };

  return merge(DEFAULT_CONTENT, stored ?? {}) as SiteContent;
}

/** Lê JSON salvo no banco sem quebrar quando o valor está corrompido. */
export function parseContent(raw: string | null | undefined): SiteContent {
  if (!raw) return DEFAULT_CONTENT;
  try {
    return mergeContent(JSON.parse(raw));
  } catch {
    return DEFAULT_CONTENT;
  }
}
