/**
 * Carrinho da loja guardado no navegador (localStorage).
 *
 * O pedido só é enviado ao servidor no checkout — o pagamento é combinado no
 * WhatsApp ou feito no salão. Um `store` mínimo com listeners mantém o header
 * e a página da loja sincronizados sem dependência extra.
 */
import { useEffect, useState } from "react";

const KEY = "barbearia-cardoso.carrinho";

export interface CartLine {
  productId: number;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
}

const listeners = new Set<(lines: CartLine[]) => void>();
let lines: CartLine[] = read();

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

function commit(next: CartLine[]) {
  lines = next.filter((line) => line.quantity > 0);
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage indisponível */
  }
  for (const listener of listeners) listener(lines);
}

/** Adiciona (ou soma) um produto ao carrinho, respeitando o estoque. */
export function addToCart(item: Omit<CartLine, "quantity">, max = 20, quantity = 1) {
  const current = lines.find((line) => line.productId === item.productId);
  if (current) {
    commit(
      lines.map((line) =>
        line.productId === item.productId
          ? { ...line, ...item, quantity: Math.min(line.quantity + quantity, max) }
          : line,
      ),
    );
    return;
  }
  commit([...lines, { ...item, quantity: Math.min(quantity, max) }]);
}

/** Define a quantidade exata de um item (0 remove). */
export function setQuantity(productId: number, quantity: number) {
  commit(lines.map((line) => (line.productId === productId ? { ...line, quantity } : line)));
}

export function removeFromCart(productId: number) {
  commit(lines.filter((line) => line.productId !== productId));
}

export function clearCart() {
  commit([]);
}

export function cartTotal(items: CartLine[]): number {
  return items.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
}

export function cartCount(items: CartLine[]): number {
  return items.reduce((sum, line) => sum + line.quantity, 0);
}

/** Assina o carrinho — devolve as linhas atuais e reage a mudanças. */
export function useCart(): CartLine[] {
  const [state, setState] = useState<CartLine[]>(lines);

  useEffect(() => {
    const listener = (next: CartLine[]) => setState(next);
    listeners.add(listener);
    setState(lines);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}
