import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";

export interface CartEntry {
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: Record<string, CartEntry>;
}

// Persist the cart so a page refresh (or accidental tab close) doesn't wipe the
// shop's selections. Expire after 12h so a cart left overnight doesn't resurrect
// stale the next day — daily bakery orders should start fresh each morning.
const STORAGE_KEY = "tamurfood-cart";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function loadInitialState(): CartState {
  if (typeof window === "undefined") return { items: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: {} };
    const parsed = JSON.parse(raw) as {
      items?: Record<string, CartEntry>;
      savedAt?: number;
    };
    if (!parsed.items || typeof parsed.savedAt !== "number")
      return { items: {} };
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return { items: {} };
    return { items: parsed.items };
  } catch {
    return { items: {} };
  }
}

type CartAction =
  | { type: "SET_QTY"; id: string; name: string; price: number; qty: number }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_QTY": {
      if (action.qty <= 0) {
        const { [action.id]: _, ...rest } = state.items;
        return { items: rest };
      }
      return {
        items: {
          ...state.items,
          [action.id]: {
            name: action.name,
            price: action.price,
            quantity: action.qty,
          },
        },
      };
    }
    case "CLEAR":
      return { items: {} };
    default:
      return state;
  }
}

interface CartContextValue {
  cart: Record<string, CartEntry>;
  setQty: (id: string, name: string, price: number, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    cartReducer,
    undefined,
    loadInitialState,
  );

  // Mirror the cart into localStorage on every change (and clear the key when
  // the cart empties) so it can be restored after a refresh.
  useEffect(() => {
    try {
      if (Object.keys(state.items).length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ items: state.items, savedAt: Date.now() }),
        );
      }
    } catch {
      // localStorage unavailable (private mode / quota) — cart just won't persist
    }
  }, [state.items]);

  const totalItems = Object.values(state.items).reduce(
    (sum, e) => sum + e.quantity,
    0,
  );
  const totalAmount = Object.values(state.items).reduce(
    (sum, e) => sum + e.price * e.quantity,
    0,
  );

  function setQty(id: string, name: string, price: number, qty: number) {
    dispatch({ type: "SET_QTY", id, name, price, qty });
  }

  function clearCart() {
    dispatch({ type: "CLEAR" });
  }

  return (
    <CartContext.Provider
      value={{ cart: state.items, setQty, clearCart, totalItems, totalAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
