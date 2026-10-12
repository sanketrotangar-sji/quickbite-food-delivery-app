import type { RioCard } from '@/api/rio';
import type { RioChatMessage } from '@/api/rioChat';

export const RIO_STARTERS = [
  'Find me dinner',
  'Something under ₹200',
  "I'm craving biryani",
  'Help & support',
] as const;

export function greetingMessage(name: string): RioChatMessage {
  return {
    id: 'hello',
    from: 'rio',
    at: Date.now(),
    text: `Hi ${name}! I'm RIO, your food assistant. I can help you order food, suggest dishes based on your mood, and handle support. What would you like to do today?`,
  };
}

export function threadCacheKey(userId: string) {
  return `qb.rio.chat.${userId}`;
}

function isChatMessage(value: unknown): value is RioChatMessage {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<RioChatMessage>;
  return typeof row.id === 'string' && (row.from === 'rio' || row.from === 'you') && typeof row.text === 'string';
}

/** Parse AsyncStorage paint-fast cache. Greeting is never trusted — strip `hello`. */
export function parseCachedThread(raw: string | null): RioChatMessage[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const messages = data
      .filter(isChatMessage)
      .filter((row) => row.id !== 'hello')
      .map((row) => ({
        ...row,
        at: typeof row.at === 'number' ? row.at : Date.now(),
      }));
    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
}

/** Cloud / cache turns + a derived greeting (not persisted as truth). */
export function withDerivedGreeting(messages: RioChatMessage[], name: string): RioChatMessage[] {
  const turns = messages.filter((row) => row.id !== 'hello');
  return [greetingMessage(name), ...turns];
}

export function slimCards(cards: RioCard[]) {
  return cards.map((card) => {
    if (card.kind === 'restaurants') {
      return {
        kind: card.kind,
        places: card.places.map((place, index) => ({
          rank: index + 1,
          id: place.id,
          name: place.name,
          dishName: place.dishName,
          featuredDishId: place.featuredDishId ?? null,
          distanceKm: place.distanceKm ?? null,
        })),
      };
    }
    if (card.kind === 'menu') {
      return {
        kind: card.kind,
        restaurantId: card.restaurantId,
        restaurantName: card.restaurantName,
        items: card.items.map((item, index) => ({
          rank: index + 1,
          id: item.id,
          name: item.name,
          price: item.price,
        })),
      };
    }
    if (card.kind === 'cart') {
      return {
        kind: card.kind,
        restaurantName: card.restaurantName,
        subtotal: card.subtotal,
        offerPercent: card.offerPercent,
        discountAmount: card.discountAmount,
        deliveryFee: card.deliveryFee,
        total: card.total,
        lines: card.lines,
      };
    }
    if (card.kind === 'ticket') {
      return { kind: card.kind, id: card.id, orderId: card.orderId, status: card.status };
    }
    return {
      kind: card.kind,
      id: card.id,
      status: card.status,
      restaurantName: card.restaurantName,
      total: card.total,
    };
  });
}
