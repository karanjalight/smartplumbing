import type { CartItem } from "@/components/client/cart-provider";

const ORDERS_KEY = "smartone-client-orders-v1";

export type ClientOrder = {
  id: string;
  createdAtIso: string;
  phoneNumber: string;
  deliveryAddress: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceKes: number;
    lineTotalKes: number;
  }>;
  subtotalKes: number;
  vatKes: number;
  deliveryFeeKes: number;
  totalKes: number;
  status: "pending-payment" | "paid" | "processing" | "delivered";
};

type CreateOrderInput = {
  items: CartItem[];
  phoneNumber: string;
  deliveryAddress: string;
  subtotalKes: number;
  vatKes: number;
  deliveryFeeKes: number;
  totalKes: number;
};

export function createClientOrder(input: CreateOrderInput): ClientOrder {
  const order: ClientOrder = {
    id: generateOrderId(),
    createdAtIso: new Date().toISOString(),
    phoneNumber: input.phoneNumber.trim(),
    deliveryAddress: input.deliveryAddress.trim(),
    items: input.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      unitPriceKes: item.product.priceKes,
      lineTotalKes: item.lineTotalKes,
    })),
    subtotalKes: input.subtotalKes,
    vatKes: input.vatKes,
    deliveryFeeKes: input.deliveryFeeKes,
    totalKes: input.totalKes,
    status: "pending-payment",
  };

  const current = getClientOrders();
  localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...current]));
  return order;
}

export function getClientOrders(): ClientOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClientOrder[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function generateOrderId() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const randPart = Math.floor(Math.random() * 9000 + 1000);
  return `SO-${datePart}-${randPart}`;
}
