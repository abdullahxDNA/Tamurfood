import { createContext, useContext, useReducer, type ReactNode } from "react";

export interface CartEntry {
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: Record<string, CartEntry>;
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
  const [state, dispatch] = useReducer(cartReducer, { items: {} });

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
