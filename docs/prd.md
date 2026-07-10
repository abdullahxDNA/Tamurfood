# TAMURFOOD — Product Requirements Document

**Private B2B Instant Ordering Platform for a Bakery**

| | |
|---|---|
| **Version** | 4.0 |
| **Date** | March 2026 |
| **Status** | Implemented — v1.0 |
| **Owner** | Product Owner (Bakery Malik) |
| **Team** | 1–2 Full-Stack Developers |
| **Timeline** | ~10 weeks to MVP launch |

---

## Table of Contents

**Product Specification (What & Why)**

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals and Success Metrics](#3-goals-and-success-metrics)
4. [User Personas](#4-user-personas)
5. [How It Works (Core Flow)](#5-how-it-works-core-flow)
6. [Assumptions and Constraints](#6-assumptions-and-constraints)
7. [Out of Scope / Non-Goals](#7-out-of-scope--non-goals)
8. [Functional Requirements](#8-functional-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Role-Based Access](#10-role-based-access)
11. [Key Screens](#11-key-screens)
12. [Real-Time Order Handling](#12-real-time-order-handling)
13. [Edge Cases and Error Handling](#13-edge-cases-and-error-handling)
14. [Analytics and Measurement](#14-analytics-and-measurement)
15. [Testing Strategy](#15-testing-strategy)
16. [Launch Plan](#16-launch-plan)
17. [Risks and Mitigations](#17-risks-and-mitigations)
18. [Open Questions](#18-open-questions)
19. [Future Enhancements](#19-future-enhancements)

**Technical Appendix (How)**

- [A. Tech Stack](#appendix-a-tech-stack)
- [B. Database Schema](#appendix-b-database-schema)
- [C. API Structure](#appendix-c-api-structure)
- [D. Epics, User Stories and Sprint Planning](#appendix-d-epics-user-stories-and-sprint-planning)

---

## 1. Executive Summary

Tamurfood is a simple, private ordering website for a bakery in Bangladesh. Instead of shopkeepers walking to the bakery or calling to place orders, they open the website, pick what they need, and submit. The bakery admin sees the order instantly and prepares it for delivery.

That's it. No public marketplace. No delivery tracking. No complex workflows. It replaces a phone call with a web form — faster, clearer, and with a record of everything.

- **Target Launch:** Phase 1 MVP within 8–10 weeks of engineering start.
- **Primary Goal:** Increase bakery sales by 20–30% within 3 months of launch.

---

## 2. Problem Statement

50–60 nearby shops order tea, biscuits, singara, samosa, rolls, cake and snacks from the bakery daily. Currently they either walk over or call. This causes:

- Wasted time for shopkeepers (walking/calling).
- Verbal orders get mixed up (wrong items, wrong quantities).
- The bakery has no written record of who ordered what.
- Monthly credit (khata) is tracked on paper — leads to disputes.
- During busy hours, orders get lost or delayed.

**Solution:** A simple website where shops place orders and the bakery sees them instantly.

---

## 3. Goals and Success Metrics

| Goal | How We Measure It | Tracking Method |
|------|-------------------|-----------------|
| Shops order via website instead of walking/calling | 40+ shops using the site weekly within 2 months | `order_placed` event count by unique shop per week |
| Fewer order mistakes | Admin-reported errors drop to near zero | Manual admin log (spreadsheet or in-app feedback) |
| Faster ordering | Shop places order in under 30 seconds | Timestamp diff: page load → order confirmation |
| Clear khata records | Zero billing disputes per month | Manual admin log |
| Increased sales | 20% revenue increase within 3 months | Compare monthly revenue (admin report) |

---

## 4. User Personas

### Shopkeeper (Dokandar)

A nearby tea stall or grocery shop owner. Age 25–55. Uses a basic Android phone. Comfortable with WhatsApp/Facebook. Orders 2–4 times a day. Wants to order quickly without walking to the bakery.

### Bakery Admin (Malik)

The bakery owner or manager. Uses a phone or computer at the counter. Wants to see all incoming orders clearly, know who ordered what, and keep track of monthly credit.

---

## 5. How It Works (Core Flow)

```
Shopkeeper                          Bakery Admin
    |                                    |
    |  1. Opens website, logs in         |
    |  2. Sees menu with prices          |
    |  3. Taps +/- to pick items        |
    |  4. Adds note (optional)           |
    |  5. Taps "Place Order"             |
    |  ──── order arrives instantly ────> |
    |                                    |  6. Sees new order on dashboard
    |                                    |  7. Prepares and delivers items
    |                                    |  8. Marks order as "Done"
    |                                    |
```

No status tracking for the shopkeeper. No delivery person role. The shopkeeper places the order and trusts the bakery will deliver — just like a phone call.

---

## 6. Assumptions and Constraints

### Assumptions (things we believe to be true)

1. All 50–60 shopkeepers own a smartphone with mobile internet (3G/4G).
2. Shopkeepers are comfortable using a simple website in Bangla-English (Banglish) — similar to how they use WhatsApp and Facebook.
3. The bakery operates from approximately 6 AM to 10 PM daily.
4. Orders are fulfilled the same day, usually within 15–30 minutes.
5. The bakery admin (or a trusted person) will be near a device to monitor incoming orders during operating hours.
6. Monthly credit (khata) settlement happens in cash or bKash — no in-app payment processing needed.
7. All shops are within walking/short bike delivery distance (200–800m) from the bakery.
8. Menu changes (prices, availability) happen infrequently — a few times per week at most.
9. Bangla language (full localization) is NOT required for V1 — Banglish labels for items are sufficient.

### Constraints

1. **Team size:** 1–2 full-stack developers. No dedicated QA, designer, or DevOps.
2. **Budget:** Minimal — hosted on Railway (Docker deployment with PostgreSQL plugin).
3. **Internet quality:** Bangladesh mobile internet can be slow and unreliable — app must be lightweight and resilient.
4. **Devices:** Target low to mid-range Android phones (Samsung Galaxy A series, Xiaomi Redmi) with 5–6 inch screens.
5. **Timeline:** MVP in ~10 weeks.

---

## 7. Out of Scope / Non-Goals

These are things we are **choosing not to build**, either for V1 or possibly ever. This is not a "later" list — it's a "no" list unless business needs change.

| Non-Goal | Reason |
|----------|--------|
| Public signup or self-registration | Admin creates all shop accounts manually. There is no signup page, no "Request Access" form, no public registration of any kind. This prevents unknown users from accessing the system |
| Public marketplace or storefront (like Foodpanda) | This is a private, closed system for known shops only |
| Delivery tracking / logistics (live map, ETAs) | Shops are 2–5 minutes walking distance. Tracking adds no value |
| Delivery staff role or accounts | The bakery handles delivery informally — no need for a third role |
| Payment gateway (bKash/Nagad/card integration) | Payments happen in cash/bKash outside the app. Khata tracks credit only |
| Mobile app (native Android/iOS) | Responsive website is sufficient. PWA is a future consideration |
| Multi-language / full Bangla UI | Banglish is the standard in local commerce. Full translation is unnecessary |
| Inventory management / stock tracking | The bakery knows what they have. Out-of-stock items are toggled manually |
| Customer reviews, ratings, or feedback | Not relevant for a private B2B relationship |
| Discounts, coupons, or promotional pricing | Not part of the business model |
| Multi-bakery / SaaS platform | This is built for one bakery. Multi-tenancy is not a V1 concern |
| Analytics dashboards with charts | Basic daily summary (order count + revenue) is enough. Charts are future |
| Notification system (SMS / WhatsApp / Push) | Admin monitors the dashboard directly. Notifications are a future enhancement |

---

## 8. Functional Requirements

> **Priority key:** P0 = must ship in V1 (blocker), P1 = should ship (can defer if blocked), P2 = nice-to-have for V1.

### 8.1 Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Two roles only: `admin` and `shop`. | P0 |
| FR-02 | Shop users log in with phone number + password. Admin creates their accounts. There is NO public signup — only admin can register new shops. | P0 |
| FR-03 | Admin logs in with phone/email + password. | P0 |
| FR-04 | After first login, shop users can change their password from their profile. They can also reset a forgotten password via their registered phone number (SMS OTP) or email (reset link). | P0 |
| FR-05 | Sessions persist for 7 days (stay logged in). | P0 |
| FR-06 | Admin can disable a shop account at any time (revokes active sessions). | P1 |

### 8.2 Menu (Admin Manages)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-07 | Admin can add menu items with: name, price (BDT), category, and optional image. | P0 |
| FR-08 | Categories are managed by the admin (create, rename, delete) via the admin panel and stored in the database (`menu_categories` table). Initial categories include Regular Items and Bekari Items. | P0 |
| FR-09 | Admin can edit price, name, or category of any item. | P0 |
| FR-10 | Admin can mark an item as "unavailable" (grayed out for shops) or delete it. | P0 |

### 8.3 Ordering (Shop Places)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-12 | Shop sees the full menu organized by category after logging in. | P0 |
| FR-13 | Each item has +/- buttons to set quantity. No typing needed. | P0 |
| FR-14 | A floating bar at the bottom shows total items and total price (BDT). | P0 |
| FR-15 | Shop can add a note to the order (e.g., "chini kom" / "less sugar"). | P1 |
| FR-16 | Shop taps "Place Order" → sees confirmation with items and total → taps "Confirm". | P0 |
| FR-17 | After confirming, shop sees a simple "Order placed successfully!" message with order number. | P0 |
| FR-18 | "Repeat Last Order" button on the home screen — loads previous order into cart, editable before placing. | P0 |
| FR-19 | Shop can view their own order history — date/time, items with quantities, total, done/pending status. Sorted newest first. Filterable by date (Today, This Week, This Month). | P1 |
| FR-19b | Shops can cancel a pending order before it is marked as done by the admin. Once the admin marks an order as done, cancellation is not permitted. | P1 |

### 8.4 Admin Dashboard (Admin Sees & Manages)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-20 | Admin sees all new orders in real-time on a dashboard. New orders appear instantly (no refresh). | P0 |
| FR-21 | Each order shows: shop name, items with quantities, notes, total amount, and time placed. | P0 |
| FR-22 | Admin can mark an order as "Done" (delivered/completed). | P0 |
| FR-23 | Admin can see today's orders, and filter by date. | P1 |
| FR-24 | Admin can view any specific shop's full order history — click a shop to see all their past orders. | P1 |
| FR-25 | A simple daily summary: total orders today, total revenue today. | P1 |
| FR-26 | Audio/visual alert when a new order comes in. | P0 |

### 8.5 Shop Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-27 | Admin can add a shop: shop name, owner name, phone number, email (optional), address (free text). Admin sets a temporary password. | P0 |
| FR-28 | Admin can edit shop details, reset password, or disable a shop. | P0 |
| FR-29 | Shop list is searchable by name or phone. | P1 |

### 8.6 Khata (Monthly Credit)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-30 | Every order total automatically adds to the shop's monthly balance (due amount). | P0 |
| FR-31 | Admin can record a payment: amount, date, optional note (e.g., "cash", "bKash"). | P0 |
| FR-32 | Both admin and shop can see the shop's khata: list of orders and payments with a running balance. | P0 |
| FR-33 | Admin can see a summary of all shops: total due from each shop this month. | P1 |

### Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | 22 | Must ship. If any P0 is missing, the product doesn't work. |
| **P1** | 9 | Should ship. Defer only if a sprint is behind schedule. |

---

## 9. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Page load time | Under 2 seconds on 3G |
| Concurrent users | 60 (all shops + admin) without issues |
| Real-time order delivery to admin | Under 3 seconds |
| Uptime | 99.5% during 6 AM – 10 PM |
| Mobile usability | Works well on 5–6 inch Android phones |
| Security | HTTPS, hashed passwords, session cookies, input validation (Zod). Row Level Security (RLS) is enabled on all database tables. Storage uploads are proxied through the server using a service role key; no direct client uploads are permitted. |
| Data safety | Daily database backups |
| JS bundle size | Under 200KB gzipped |

---

## 10. Role-Based Access

| Action | Admin | Shop |
|--------|-------|------|
| View menu | ✅ | ✅ |
| Manage menu (add/edit/delete) | ✅ | ❌ |
| Place orders | ❌ | ✅ |
| View own order history | ❌ | ✅ |
| View any shop's order history | ✅ | ❌ |
| View own khata | ❌ | ✅ |
| View all orders (dashboard) | ✅ | ❌ |
| Mark order as done | ✅ | ❌ |
| Manage shops | ✅ | ❌ |
| Record khata payments | ✅ | ❌ |
| View all shops khata summary | ✅ | ❌ |

---

## 11. Key Screens

Low-fidelity descriptions of every screen in the app. These serve as wireframe briefs for development. Actual visual design uses shadcn/ui components with Tailwind CSS.

### Screen 1: Login Page

- **Who sees it:** Everyone (unauthenticated)
- **Layout:** Centered card on a clean background.
- **Elements:**
  - Tamurfood logo/name at top.
  - Phone number input field (with Bangladesh country code hint).
  - Password input field (with show/hide toggle).
  - "Login" button (full width, primary color).
  - Error message area below the button (red text for invalid credentials).
  - **No "Sign Up" or "Register" link.** Only admin can create accounts.
- **Behavior:** On success → shop users go to Menu screen, admin goes to Dashboard.
- **Empty state:** N/A.
- **Error state:** "Wrong phone number or password. Try again." shown below the button.
- **Forgot password link:** "Forgot password?" link below the login button → goes to Password Reset screen.

### Screen 2: Password Reset

- **Who sees it:** Anyone (unauthenticated) who taps "Forgot password?" on the login page.
- **Layout:** Centered card.
- **Elements:**
  - "Reset your password" heading.
  - Phone number OR email input field (tab toggle or single field that detects format).
  - "Send Reset Link / OTP" button.
  - If phone: sends OTP via SMS → user enters OTP → sets new password.
  - If email: sends reset link → user clicks link → sets new password.
- **Success state:** "Password reset! You can now log in with your new password."
- **Error state:** "We couldn't find an account with that phone/email." (generic — no hints about which accounts exist).

### Screen 3: Shop — Change Password (in profile)

- **Who sees it:** Logged-in shop user via profile/settings.
- **Layout:** Simple form.
- **Elements:**
  - Current password field.
  - New password field.
  - Confirm new password field.
  - "Save" button.
- **Behavior:** On success → "Password changed!" toast message. Stay on same page.
- **Error states:** "Current password is incorrect." / "Passwords don't match." / "New password must be at least 6 characters."

### Screen 4: Shop — Menu & Ordering (Home Screen)

- **Who sees it:** Shop users (default landing page after login)
- **Layout:** Full-screen vertical scroll.
- **Top area:**
  - "Repeat Last Order" button — large, prominent, above everything else. Shows last order summary (e.g., "5 Chaa, 3 Singara — ৳150"). Tapping loads items into cart.
  - If no previous order exists, this button is hidden.
- **Menu area:**
  - Items grouped by category headers (Chaa, Biscuit, Singara, etc.).
  - Each item card: name (left), price in ৳ (right), and +/- quantity buttons (right side).
  - Quantity shows between + and - buttons. Starts at 0 (not in cart).
  - Unavailable items: grayed out with "Unavailable" text, +/- buttons disabled.
  - Optional: small item image thumbnail on the left.
- **Bottom floating bar (sticky):**
  - Only visible when at least 1 item has quantity > 0.
  - Shows: "X items — ৳Y total" on the left, "Place Order →" button on the right.
  - Tapping opens the Order Confirmation screen.
- **Empty state:** "No menu items available right now." (if admin hasn't added any items)
- **Error state:** "Couldn't load menu. Pull down to refresh." (if network fails)
- **Loading state:** Skeleton cards while menu loads.

### Screen 5: Shop — Order Confirmation

- **Who sees it:** Shop user after tapping "Place Order" from the floating bar.
- **Layout:** Full-screen with item list.
- **Elements:**
  - List of selected items: name, quantity, line total (price × qty) per row.
  - Order note text field (optional, placeholder: "Any special instructions? e.g., chini kom").
  - Grand total at the bottom (bold, large).
  - "Confirm Order" button (full width, primary color).
  - "← Back to Menu" link to go back and edit.
- **Behavior:** On confirm → API call → success screen. If API fails → error toast + retry option.
- **Error state:** "Couldn't place order. Check your internet and try again." with a "Retry" button.

### Screen 6: Shop — Order Success

- **Who sees it:** Shop user after successful order placement.
- **Layout:** Simple centered confirmation.
- **Elements:**
  - Checkmark icon (green).
  - "Order placed!" heading.
  - Order number (e.g., "#42").
  - Summary: item count, total amount.
  - "Back to Menu" button.
- **Behavior:** This is a dead end — no tracking, no status. Just confirmation.

### Screen 7: Shop — Order History

- **Who sees it:** Shop user via bottom navigation.
- **Layout:** Vertical scrollable list.
- **Elements:**
  - Date filter tabs at top: Today | This Week | This Month.
  - Each order card: order number, date/time, items with quantities (collapsed, expandable), total amount, status badge ("Done" in green or "Pending" in amber).
  - "Reorder" button on each card — loads that order's items into the current cart.
- **Empty state:** "No orders yet. Place your first order from the menu!"
- **Loading state:** Skeleton cards.

### Screen 8: Shop — My Khata

- **Who sees it:** Shop user via bottom navigation.
- **Layout:** Summary card at top + scrollable ledger below.
- **Top summary card:**
  - "This month" label.
  - Total ordered: ৳X.
  - Total paid: ৳Y.
  - Balance due: ৳Z (highlighted in red if > 0, green if 0).
- **Ledger below:**
  - Chronological list of entries.
  - Order entries (debits): "Order #42 — ৳150" with date. Red/minus indicator.
  - Payment entries (credits): "Payment — ৳500 (cash)" with date. Green/plus indicator.
  - Running balance shown after each entry.
- **Empty state:** "No transactions this month."

### Screen 9: Shop — Bottom Navigation

- **Persistent bottom nav with 4 tabs:**
  - 🏠 Menu (home/ordering)
  - 📋 Orders (order history)
  - 💰 Khata (credit ledger)
  - 👤 Profile (change password, view account info)
- **Active tab highlighted in primary color.**

### Screen 10: Admin — Live Orders Dashboard (Home Screen)

- **Who sees it:** Admin (default landing page after login).
- **Layout:** Vertical list of order cards, sorted oldest first (FIFO).
- **Top bar:**
  - Daily summary strip: "Today: X orders | ৳Y revenue"
  - Date filter: Today (default) | Yesterday | Pick date.
  - 🔇/🔊 Mute/unmute toggle for audio alerts.
- **Order cards (pending orders):**
  - Shop name (bold, clickable → opens that shop's order history).
  - Time since placed (e.g., "3 min ago").
  - Items list with quantities and per-item notes (if any).
  - Order note (if any, shown in italics).
  - Total amount.
  - "✅ Done" button (full width, green) — marks order as completed.
- **New order behavior:**
  - New card slides in at the top with a highlight animation (brief yellow flash).
  - Audio chime plays (if not muted).
  - Browser tab title changes to "(2) New Orders — Tamurfood".
- **Completed orders:** Move to a "Done" section below (collapsed by default, expandable).
- **Empty state:** "No pending orders. Waiting for shops to order..." with a subtle loading indicator.
- **Error state:** "Lost connection to server. Trying to reconnect..." banner at top.

### Screen 11: Admin — Shop Management

- **Who sees it:** Admin via sidebar/nav.
- **Layout:** Table/list of all shops.
- **Elements:**
  - "Add Shop" button at top.
  - Each shop row: shop name, owner name, phone, address, active/inactive badge.
  - Actions per row: Edit | Reset Password | Disable/Enable.
  - Search bar at top: filter by name or phone.
- **Add/Edit Shop form (modal or page):**
  - Shop name, owner name, phone number, email (optional — for password reset), address, temporary password (for new shops).
  - Save/Cancel buttons.
  - Validation errors shown inline.
- **Empty state:** "No shops registered yet. Add your first shop."

### Screen 12: Admin — Menu Management

- **Who sees it:** Admin via sidebar/nav.
- **Layout:** List of all menu items grouped by category.
- **Elements:**
  - "Add Item" button at top.
  - Each item row: name, price, category, availability toggle, Edit/Delete buttons.
  - Available/Unavailable toggle is a simple switch.
- **Add/Edit Item form:**
  - Name, price, category (dropdown — populated from DB-backed categories), image upload (optional).
  - Save/Cancel.
- **Empty state:** "No menu items yet. Add your first item."

### Screen 13: Admin — Shop Khata Detail

- **Who sees it:** Admin when clicking a shop (from dashboard, shop list, or khata overview).
- **Layout:** Same as Shop's Khata view (Screen 6) but with admin actions.
- **Additional elements:**
  - "Record Payment" button at top.
  - Payment form: amount, date (default today), note (optional). Save/Cancel.
- **Behavior:** Same ledger view — both admin and shop see identical data.

### Screen 14: Admin — Khata Overview

- **Who sees it:** Admin via sidebar/nav.
- **Layout:** Table of all shops with khata summary.
- **Columns:** Shop name | Total ordered this month | Total paid | Balance due.
- **Sorted by:** Highest balance due first.
- **Clickable rows:** Opens that shop's khata detail (Screen 11).
- **Empty state:** "No billing data for this month yet."

### Screen 15: Admin — Navigation

- **Sidebar (desktop) / hamburger menu (mobile) with links:**
  - 📋 Orders (dashboard — home)
  - 🍽️ Menu (menu management)
  - 🏪 Shops (shop management)
  - 💰 Khata (khata overview)
- **Active page highlighted.**

---

## 12. Real-Time Order Handling

- **Technology:** Server-Sent Events (SSE) — simple, one-direction push from server to admin.
- **How it works:** Admin's dashboard keeps an open SSE connection. When a shop places an order, the server pushes the new order to the admin instantly.
- **Fallback:** If SSE disconnects, the dashboard polls every 10 seconds via TanStack Query `refetchInterval`.
- **New order alert:** Audio chime + visual highlight when a new order appears on the admin dashboard.
- **No SSE for shops.** Shops don't need real-time updates. They place the order and are done.

---

## 13. Edge Cases and Error Handling

### 13.1 Authentication

| Scenario | Expected Behavior |
|----------|-------------------|
| Shop enters wrong phone/password | Show "Wrong phone number or password" error. Max 5 attempts per minute, then lock for 1 minute. |
| Shop account is disabled by admin while logged in | On next API call, return 403. Redirect to login with message "Your account has been disabled. Contact the bakery." |
| Session expires after 7 days | Redirect to login page. No data loss — cart is local state, not server state. |
| Admin tries to log in with shop credentials | Login succeeds but routes to shop interface (role-based redirect). Not an error. |
| Two devices logged into same shop account | Both work fine. No conflict — each is an independent session. |
| Someone without an account tries to use the system | There is no signup page. The login page only accepts existing credentials. If someone enters a phone number not in the system, they see "Wrong phone number or password." — no hint that the account doesn't exist. |
| Shop user tries to reset password with unregistered phone/email | Show generic message: "If an account exists with that phone/email, we'll send a reset link/OTP." Never confirm or deny whether the account exists. |
| Shop user changes password via profile | Old sessions remain active (no forced logout). New password takes effect on next login. |
| Reset link / OTP expires | Links expire after 15 minutes. OTP expires after 5 minutes. Show: "This link/code has expired. Request a new one." |
| Admin resets a shop password from the dashboard | Overrides any pending reset link/OTP. Shop must use the new admin-set password. |

### 13.2 Menu

| Scenario | Expected Behavior |
|----------|-------------------|
| Admin adds item with duplicate name | Allow it. Two items can have the same name (e.g., "Chaa" in regular and large size). |
| Admin changes price while a shop has items in cart | Cart uses locally stored prices. On order submission, server recalculates with current prices. If total differs from what the shop saw, show the updated total on the confirmation screen. |
| Admin marks item as unavailable while it's in a shop's cart | On order submission, reject that item. Show message: "Some items are no longer available" and return the shop to the menu with unavailable items removed from cart. |
| Admin deletes an item that's in past orders | Past orders keep the snapshot (item_name, item_price in order_items table). Deletion only removes from menu, not from history. |
| Menu has zero items | Shop sees "No menu items available right now." Cannot place an order. |
| Image upload fails | Item saves without image. Show fallback placeholder icon. No error to the user. |

### 13.3 Ordering

| Scenario | Expected Behavior |
|----------|-------------------|
| Shop submits order but network drops | Client retries up to 3 times (1s, 3s, 5s delay). If all fail, show "Couldn't place order. Check your internet and try again." with a Retry button. Cart is preserved. |
| Shop places order with zero items (empty cart) | "Place Order" button is disabled when cart is empty. Cannot submit. |
| Shop sets quantity to 100+ for an item | Allow it but show a confirmation prompt: "Are you sure you want 100 units of Chaa?" |
| "Repeat Last Order" but items have been deleted/unavailable | Load available items into cart normally. For deleted/unavailable items, show a warning: "2 items from your last order are no longer available." Those items are excluded. |
| Shop has no previous orders (new shop) | "Repeat Last Order" button is hidden. |
| Two orders placed by the same shop within seconds | Both are accepted. No duplicate detection — shops may legitimately order multiple times. |
| Order note exceeds character limit | Truncate on client side. Server validates max 500 chars. |

### 13.4 Admin Dashboard

| Scenario | Expected Behavior |
|----------|-------------------|
| SSE connection drops | Dashboard switches to polling every 10 seconds. Show subtle "Reconnecting..." banner at top. When SSE reconnects, banner disappears. |
| Admin accidentally marks an order as "Done" | "Done" button shows a confirmation: "Mark this order as done?" with Confirm/Cancel. Once marked, it cannot be undone (immutable for khata integrity). |
| 20+ orders come in within a minute (rush hour) | All are displayed. Oldest pending at top. No pagination — scroll. Audio plays once per new batch, not per order. |
| Admin is not near the device when orders come in | Orders queue up on the server. When admin opens/refreshes the dashboard, all pending orders are visible. Nothing is lost. |
| No orders for the day | Dashboard shows "No pending orders. Waiting for shops to order..." |

### 13.5 Khata

| Scenario | Expected Behavior |
|----------|-------------------|
| Admin records a payment larger than the balance | Allow it. Balance goes negative (overpayment / advance). Show negative balance clearly: "Balance: -৳200 (advance)". |
| Admin enters a negative payment amount | Reject. Validation error: "Amount must be positive." |
| Shop's khata has no transactions this month | Show "No transactions this month." with zero balance. |
| End of month — does the balance reset? | No. Balance is a running total across all time. Monthly summaries are filters, not resets. Outstanding balance carries over. |
| Disputed charge — shop says they didn't order X | Both sides see the same immutable ledger. Order records cannot be edited or deleted. Dispute resolved by reviewing the ledger together. |

### 13.6 Shop Management

| Scenario | Expected Behavior |
|----------|-------------------|
| Admin tries to add a shop with a phone number that already exists | Validation error: "A shop with this phone number already exists." |
| Admin disables a shop that has pending orders | Existing pending orders remain in the dashboard and can be marked done. Shop just can't place new orders or log in. |
| Admin resets a shop's password | New password is set. All active sessions for that shop are revoked (force re-login). |

---

## 14. Analytics and Measurement

For V1, analytics are kept simple — server-side event logging to a database table. No third-party analytics tools needed.

### Events to Track

| Event | When It Fires | Data Captured | Maps to Success Metric |
|-------|---------------|---------------|------------------------|
| `order_placed` | Shop confirms an order | shop_id, order_id, item_count, total_amount, timestamp | Weekly active shops, average order time, revenue |
| `order_done` | Admin marks order done | order_id, time_to_complete (done_at - placed_at), timestamp | Fulfillment speed |
| `repeat_order_used` | Shop taps "Repeat Last Order" | shop_id, original_order_id, timestamp | Repeat order usage rate |
| `shop_login` | Shop logs in | shop_id, timestamp | Daily/weekly active shops |
| `payment_recorded` | Admin records a khata payment | shop_id, amount, timestamp | Khata accuracy |

### Implementation

- **V1 approach:** Log events as rows in an `analytics_events` table (event_type, user_id, metadata JSON, timestamp). Query with SQL for reports.
- **Admin daily summary (FR-24)** pulls from this: total orders today = count of `order_placed` today; total revenue = sum of amounts.
- **No third-party tools** (Mixpanel, Amplitude) needed for V1. Add later if the business grows.

### 2-Week Post-Launch Review

Two weeks after launch, the team will review:

1. How many shops are actively ordering?
2. What's the average order placement time?
3. What % of orders use "Repeat Last Order"?
4. Are there any khata disputes?
5. What's the admin's experience — any pain points?

---

## 15. Testing Strategy

### Who Tests

- **Developers:** Test during development (unit + manual).
- **Product owner (bakery admin):** Acceptance testing before launch.
- **Beta shops (5 shops):** Real-world testing for 3–5 days before full rollout.

### What to Test

| Test Area | Method | When |
|-----------|--------|------|
| Auth (login/logout, session, role redirect) | Manual + automated | Every sprint |
| Order placement (happy path) | Manual end-to-end | Every sprint after Sprint 3 |
| Order placement (error cases: offline, empty cart, unavailable items) | Manual | Sprint 3 + before launch |
| Admin dashboard (new order appears, mark done) | Manual | Sprint 4 + before launch |
| Khata (order adds to balance, payment recorded, ledger correct) | Manual + SQL verification | Sprint 5 + before launch |
| Mobile responsiveness (360px viewport) | Chrome DevTools | Every sprint |
| Real device testing (low-end Android on 3G) | BrowserStack or real device | Before launch |
| SSE real-time updates | Manual (2 browser tabs: shop + admin) | Sprint 4 |

### Critical Regression Checks (Before Every Release)

1. Shop can log in and see the menu.
2. Shop can place an order and see the success screen.
3. Admin sees the order appear in real-time.
4. Admin can mark order as done.
5. Khata balance updates correctly after order and payment.

### Browser/Device Matrix

| Browser | Priority |
|---------|----------|
| Chrome Android (latest) | Must work |
| Samsung Internet | Must work |
| Chrome Desktop | Must work |
| Firefox Desktop | Should work |
| Safari Mobile (iPhone) | Should work |

---

## 16. Launch Plan

### Phase 1: Internal Testing (Week 9)

- Product owner (bakery admin) tests all admin flows on real data.
- Fix critical bugs.
- Add 5 beta shops to the system.

### Phase 2: Beta with 5 Shops (Week 10, first 3–5 days)

- 5 trusted, tech-comfortable shopkeepers use the system for real orders.
- Product owner monitors the dashboard and processes orders.
- Collect feedback daily: what's confusing? what's slow? what's missing?
- Fix any issues found.

### Phase 3: Full Rollout (Week 10–11)

- Register all remaining shops (admin creates accounts).
- In-person onboarding: 10-minute demo at each shop showing login → order → repeat order.
- Print a simple one-page instruction card with QR code to the website, login steps, and "Repeat Last Order" instruction.
- First week: bakery continues accepting phone/walk-in orders alongside app orders.
- After first week: encourage app-only ordering (prioritize app orders).

### Rollback Criteria

If any of these happen, pause rollout and fix:

- Order placement fails for more than 3 shops in a day.
- Admin dashboard stops receiving real-time orders.
- Khata balances are incorrect (wrong amounts recorded).
- More than 5 shops report they "can't figure out how to use it."

### Rollback Plan

- The bakery immediately reverts to phone/walk-in orders (no business disruption — this is an addition, not a replacement).
- Dev team investigates and fixes within 24–48 hours.
- Re-launch when fixed, starting from Phase 2 again.

### Communication Channel

- Create a WhatsApp group with all shop owners for announcements, support, and feedback.
- Admin can post: "We're updating the system, back in 30 minutes" etc.

---

## 17. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Older shopkeepers struggle with the website | High | Ultra-simple UI; "Repeat Last Order" as the main flow; in-person 10-minute demo per shop; printed instruction card |
| Unreliable mobile internet | High | Small bundle size (<200KB); menu cached locally; retry failed orders automatically (3 attempts); lightweight SSE with polling fallback |
| Shops revert to walking/calling | Medium | Make ordering faster than a phone call; bakery prioritizes app orders; encourage via WhatsApp group |
| Server goes down | Medium | Hosted on Railway (Docker + PostgreSQL plugin); daily DB backups; phone/walk-in ordering is the fallback |
| Khata disputes despite digital records | Low | Immutable ledger — orders and payments can't be edited or deleted; both sides see the same data |
| Scope creep during development | Medium | Strict P0/P1/P2 priorities in this PRD; feature freeze after sprint 1; defer all P2 items if behind |
| Admin not monitoring dashboard | Medium | Audio alert + browser tab notification; consider SMS alert in Phase 2 |

---

## 18. Open Questions

These are unresolved decisions. The team should decide on each before the relevant sprint begins.

| # | Question | Relevant Sprint | Suggested Default |
|---|----------|-----------------|-------------------|
| 1 | Should the "Done" action on an order be reversible (undo within 30 seconds)? | Sprint 4 | No. Keep it immutable for khata integrity. |
| 2 | Should there be a minimum order amount? | Sprint 3 | No minimum for V1. Revisit after launch if shops abuse with tiny orders. |
| 3 | When admin changes a price, what happens to orders already placed at the old price? | Sprint 3 | Orders keep the old price (snapshot at order time). New orders use the new price. |
| 4 | Should shops be able to cancel an order after placing it? | Sprint 3 | **Resolved:** Yes. Shops can cancel their own pending orders. Once the admin marks an order as done, it cannot be cancelled. |
| 5 | How to handle the bakery being closed (e.g., shop places order at midnight)? | Sprint 3 | Allow it. Order queues up. Admin sees it when they open the dashboard in the morning. |
| 6 | Should the khata ledger be filterable by month? | Sprint 5 | Yes. Show current month by default with option to view previous months. |
| 7 | What's the admin's initial password? Who creates the first admin account? | Sprint 1 | Developer seeds the first admin account during deployment. Admin changes password on first login. |
| 8 | Should we support landscape mode on mobile? | All sprints | No. Portrait only. Not worth the effort. |
| 9 | Which SMS provider to use for phone OTP? (e.g., Twilio, local BD provider like SSL Wireless / BulkSMS BD) | Sprint 2 | Start with email reset only. Add SMS OTP later if shops don't have email. |

---

## 19. Future Enhancements

These are **not** in scope for launch. Only consider after the core system is running and shops are using it:

1. **SMS/WhatsApp notification** when order is placed (for admin) or ready (for shop).
2. **Order status tracking** (Pending → Preparing → Done) if shops actually want it.
3. **Delivery staff role** with assigned orders — only if the bakery hires dedicated delivery people.
4. **Daily/weekly/monthly reports** with charts and CSV export.
5. **bKash/Nagad integration** for digital payments against khata.
6. **Bangla language toggle** for full Bangla UI.
7. **PWA** for home screen install and offline support.

---
---

# Technical Appendix

> The sections below are implementation guidance for the dev team. They are **not product requirements** — they describe *how* to build, not *what* to build. Developers may deviate from these if they find better approaches, as long as the product requirements (Sections 1–19) are met.

---

## Appendix A: Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Frontend | React 19 + Vite |
| Routing | TanStack Router |
| Data Fetching | TanStack Query |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Hono |
| Auth | Better Auth (admin + shop roles) |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod |
| Images | Supabase Storage (optional) |

---

## Appendix B: Database Schema

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | varchar(100) | |
| phone | varchar(15) | Unique, used for login |
| email | varchar(255) | Nullable, used for password reset |
| password_hash | text | Bcrypt via Better Auth |
| role | enum(`admin`, `shop`) | |
| is_active | boolean | Default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `shops`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, unique |
| shop_name | varchar(150) | |
| owner_name | varchar(100) | |
| address | text | Free-text location |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `menu_items`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | varchar(100) | |
| price | integer | BDT |
| category | varchar(50) | |
| image_url | text | Nullable |
| is_available | boolean | Default true |
| sort_order | integer | Display order |
| created_at | timestamptz | |

### `menu_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | varchar(100) | Unique |
| sort_order | integer | Display order |
| created_at | timestamptz | |

### `orders`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| order_number | serial | Human-readable |
| shop_id | uuid | FK → shops |
| total_amount | integer | BDT |
| note | varchar(500) | Optional order note |
| is_done | boolean | Default false |
| placed_at | timestamptz | |
| done_at | timestamptz | Nullable |

### `order_items`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| order_id | uuid | FK → orders |
| menu_item_id | uuid | FK → menu_items |
| item_name | varchar(100) | Snapshot at order time |
| item_price | integer | Snapshot at order time |
| quantity | integer | |
| line_total | integer | price × quantity |
| item_note | varchar(200) | Optional per-item note |

### `payments`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| shop_id | uuid | FK → shops |
| amount | integer | BDT |
| payment_date | date | |
| note | varchar(300) | e.g., "cash", "bKash" |
| recorded_by | uuid | FK → users (admin) |
| created_at | timestamptz | |

### `analytics_events`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| event_type | varchar(50) | e.g., order_placed, shop_login |
| user_id | uuid | FK → users, nullable |
| metadata | jsonb | Flexible event-specific data |
| created_at | timestamptz | |

### Key Indexes

- `orders` → (`shop_id`, `placed_at DESC`) — shop order history
- `orders` → (`is_done`, `placed_at ASC`) — admin dashboard (pending first)
- `payments` → (`shop_id`, `payment_date DESC`) — khata ledger
- `users` → (`phone`) — login lookup
- `analytics_events` → (`event_type`, `created_at`) — event queries

---

## Appendix C: API Structure

### Auth

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | Public | Login |
| POST | `/api/v1/auth/logout` | All | Logout |
| GET | `/api/v1/auth/me` | All | Get current user |
| PUT | `/api/v1/auth/change-password` | All | Change own password (requires current password) |
| POST | `/api/v1/auth/forgot-password` | Public | Request password reset via phone (OTP) or email (link) |
| POST | `/api/v1/auth/reset-password` | Public | Set new password using OTP or reset token |

### Menu

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/menu` | Admin, Shop | Get menu items |
| POST | `/api/v1/menu` | Admin | Add item |
| PUT | `/api/v1/menu/:id` | Admin | Edit item |
| DELETE | `/api/v1/menu/:id` | Admin | Delete item |
| PATCH | `/api/v1/menu/:id/availability` | Admin | Toggle available/unavailable |

### Orders

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/orders` | Shop | Place order |
| GET | `/api/v1/orders/my` | Shop | My order history |
| GET | `/api/v1/orders/last` | Shop | Last order (for repeat) |
| GET | `/api/v1/orders` | Admin | All orders (filterable) |
| GET | `/api/v1/orders/shop/:shopId` | Admin | Order history for a specific shop |
| PATCH | `/api/v1/orders/:id/done` | Admin | Mark as done |
| GET | `/api/v1/orders/stream` | Admin | SSE for real-time new orders |

### Shops

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/shops` | Admin | List shops |
| POST | `/api/v1/shops` | Admin | Add shop |
| PUT | `/api/v1/shops/:id` | Admin | Edit shop |
| PATCH | `/api/v1/shops/:id/status` | Admin | Enable/disable |
| POST | `/api/v1/shops/:id/reset-password` | Admin | Reset password |

### Khata

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/khata/:shopId` | Admin, Shop | Shop ledger |
| POST | `/api/v1/khata/:shopId/payments` | Admin | Record payment |
| GET | `/api/v1/khata/overview` | Admin | All shops summary |

---

## Appendix D: Epics, User Stories and Sprint Planning

### Planning Assumptions

- **Team size:** 1–2 full-stack developers.
- **Sprint length:** 2 weeks.
- **Sprint velocity (estimated):** 20–25 story points per sprint.
- **Total estimated effort:** ~105 story points → 5 sprints → ~10 weeks.
- **Story point scale:** Fibonacci (1, 2, 3, 5, 8, 13) where 1 = a few hours, 13 = nearly a full sprint for one dev.

---

### Epic 1: Project Setup & Infrastructure

**Description:** Set up the monorepo, configure the full tech stack, database connection, deployment pipeline.

**Business Value:** Foundation for everything else.

**Maps to:** Infrastructure

---

**Story ID: SETUP-01**

> As a **developer**,
> I want to **set up the project with Bun, React 19, Vite, Hono, and PostgreSQL**,
> So that **we have a working monorepo ready for feature development**.

- **Story Points:** 5
- **Priority:** High
- **Acceptance Criteria:**
  - Bun project initialized with frontend (React 19 + Vite) and backend (Hono) workspaces.
  - TanStack Router configured with basic route structure.
  - TanStack Query provider set up.
  - Tailwind CSS + shadcn/ui installed and working.
  - PostgreSQL connected via Drizzle ORM with a test migration.
  - Zod installed for validation.
  - Dev server runs with `bun dev` — both frontend and backend.

---

**Story ID: SETUP-02**

> As a **developer**,
> I want to **set up the database schema and run initial migrations**,
> So that **all tables exist and are ready**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - All 8 tables created via Drizzle migrations matching Appendix B.
  - Indexes created as specified.
  - Seed script creates one admin user for testing.
  - Migration runs cleanly on a fresh database.

---

**Story ID: SETUP-03**

> As a **developer**,
> I want to **deploy the app to a cloud host**,
> So that **the bakery admin and shops can access it from any device**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - App deployed to Railway using Docker (Dockerfile builds frontend via `bun vite build`, then runs the Hono server).
  - PostgreSQL provided by the Railway PostgreSQL plugin.
  - Static frontend files served by the Hono server in production (`serveStatic` enabled when `NODE_ENV=production`).
  - HTTPS enabled (handled by Railway).
  - Environment variables configured for production (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, CORS_ORIGIN, etc.).
  - Health check endpoint (`/api/health`) returns 200.

---

### Epic 2: Authentication

**Description:** Login/logout for admin and shop roles. Session management. Route protection.

**Business Value:** Gates access to everything.

**Maps to:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06

---

**Story ID: AUTH-01**

> As a **shop user**,
> I want to **log in with my phone number and password**,
> So that **I can access the menu and place orders**.

- **Story Points:** 5
- **Priority:** High
- **Acceptance Criteria:**
  - Login page with phone number and password fields.
  - Successful login sets a secure HTTP-only session cookie via Better Auth.
  - Session persists for 7 days.
  - Invalid credentials show: "Wrong phone number or password."
  - After login, shop user redirected to menu page.
  - Rate limit: max 5 login attempts per minute per IP.

---

**Story ID: AUTH-02**

> As an **admin**,
> I want to **log in with my phone/email and password**,
> So that **I can access the admin dashboard**.

- **Story Points:** 2
- **Priority:** High
- **Acceptance Criteria:**
  - Same login page — system detects role from the user record.
  - Admin redirected to admin dashboard after login.

---

**Story ID: AUTH-03**

> As a **shop user**,
> I want to **change my password from my profile**,
> So that **I can replace the temporary password the admin gave me with my own**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - Profile page accessible via bottom nav (👤 tab).
  - Change password form: current password, new password, confirm new password.
  - Validation: current password must match; new passwords must match; minimum 6 characters.
  - On success: toast "Password changed!" — stay on profile page.
  - Error: "Current password is incorrect." / "Passwords don't match."

---

**Story ID: AUTH-04**

> As a **shop user**,
> I want to **reset my forgotten password using my phone number or email**,
> So that **I can regain access without calling the admin**.

- **Story Points:** 5
- **Priority:** High
- **Acceptance Criteria:**
  - "Forgot password?" link on login page.
  - Enter phone number or email.
  - If phone: receive SMS OTP → enter OTP → set new password.
  - If email: receive reset link → click link → set new password.
  - Generic response: "If an account exists, we'll send a reset." (no account enumeration).
  - OTP expires after 5 minutes. Email link expires after 15 minutes.
  - After reset: redirect to login with "Password reset! Log in with your new password."

---

**Story ID: AUTH-05**

> As an **admin or shop user**,
> I want to **log out**,
> So that **my session is ended**.

- **Story Points:** 1
- **Priority:** High
- **Acceptance Criteria:**
  - Logout button visible in the UI.
  - Clears session cookie and redirects to login page.
  - Accessing protected routes after logout redirects to login.

---

**Story ID: AUTH-06**

> As a **developer**,
> I want to **enforce role-based route protection**,
> So that **shop users can't access admin pages and vice versa**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - TanStack Router `beforeLoad` guards check user role.
  - Shop users accessing `/admin/*` redirected to menu.
  - Admin accessing `/shop/*` redirected to dashboard.
  - Unauthenticated users redirected to `/login`.
  - API endpoints return 401/403 for unauthorized requests.

---

### Epic 3: Menu Management

**Description:** Admin creates/edits/toggles menu items. Shops see the menu.

**Business Value:** Can't order without a menu.

**Maps to:** FR-07, FR-08, FR-09, FR-10, FR-12

---

**Story ID: MENU-01**

> As an **admin**,
> I want to **add a menu item with name, price, category, and optional image**,
> So that **shops can see and order it**.

- **Story Points:** 5
- **Priority:** High
- **Acceptance Criteria:**
  - Admin menu management page with "Add Item" form.
  - Fields: name (required), price in BDT (required, positive integer), category (dropdown), image upload (optional).
  - Validation via Zod on client and server.
  - New item appears immediately after saving.

---

**Story ID: MENU-02**

> As an **admin**,
> I want to **edit a menu item's name, price, or category**,
> So that **I can update prices or fix mistakes**.

- **Story Points:** 2
- **Priority:** High
- **Acceptance Criteria:**
  - Each item has an "Edit" button opening a pre-filled form.
  - Changes saved and reflected immediately.
  - Shops see updated info on next menu load.

---

**Story ID: MENU-03**

> As an **admin**,
> I want to **mark an item as unavailable or delete it**,
> So that **shops don't order items I can't make**.

- **Story Points:** 2
- **Priority:** High
- **Acceptance Criteria:**
  - Toggle switch for availability.
  - Unavailable items grayed out with badge on shop menu.
  - Shops cannot add unavailable items to cart.
  - Delete removes from menu. Past orders keep the snapshot.

---

**Story ID: MENU-05**

> As a **shop user**,
> I want to **see the full menu organized by category**,
> So that **I can quickly find what to order**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - Menu page is the default landing page after login.
  - Items grouped by category with headers.
  - Each item shows: name, price, image (if any), availability.
  - Loads in under 2 seconds on 3G.
  - Cached via TanStack Query (staleTime: 5 minutes).
  - Empty state: "No menu items available right now."
  - Error state: "Couldn't load menu. Pull down to refresh."

---

### Epic 4: Ordering System

**Description:** Shops select items, set quantities, add notes, place orders, repeat last order, view history.

**Business Value:** The core product.

**Maps to:** FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19

---

**Story ID: ORDER-01**

> As a **shop user**,
> I want to **use +/- buttons to set item quantities**,
> So that **I can build my order quickly without typing**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - + and - buttons on each item. Large tap targets (min 44×44px).
  - Quantity starts at 0. First + sets to 1.
  - \- button at 0 does nothing (no negative).
  - Quantities update locally (no API call per tap).
  - Long-press + for rapid increment.
  - Confirmation prompt if quantity exceeds 50.

---

**Story ID: ORDER-02**

> As a **shop user**,
> I want to **see a floating cart bar at the bottom**,
> So that **I always know my total**.

- **Story Points:** 2
- **Priority:** High
- **Acceptance Criteria:**
  - Sticky bar at bottom. Only visible when cart has items.
  - Shows: "X items — ৳Y total" and "Place Order →" button.
  - Tapping opens order confirmation screen.

---

**Story ID: ORDER-03**

> As a **shop user**,
> I want to **add a note to my order**,
> So that **the bakery prepares items the way I want**.

- **Story Points:** 2
- **Priority:** Medium (P1)
- **Acceptance Criteria:**
  - Order-level note field on confirmation screen (optional, max 500 chars).
  - Note saved with order and visible to admin.

---

**Story ID: ORDER-04**

> As a **shop user**,
> I want to **confirm and place my order**,
> So that **the bakery receives it instantly**.

- **Story Points:** 5
- **Priority:** High
- **Acceptance Criteria:**
  - Confirmation screen shows items, quantities, line totals, notes, grand total.
  - "Confirm Order" submits. Server recalculates total with current prices.
  - If prices changed since cart was built, show updated total before final confirm.
  - On success: "Order placed!" screen with order number.
  - If any items are now unavailable: reject those items, show warning, return to menu.
  - On network failure: retry 3 times, then show error with Retry button. Cart preserved.
  - Order total added to shop's khata balance.
  - Admin dashboard receives the order via SSE.
  - `order_placed` analytics event logged.

---

**Story ID: ORDER-05**

> As a **shop user**,
> I want to **repeat my last order with one tap**,
> So that **I can reorder in seconds**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - "Repeat Last Order" button above the menu. Shows summary (e.g., "5 Chaa, 3 Singara — ৳150").
  - Loads previous items into cart. Editable before confirming.
  - Hidden if no previous orders.
  - Unavailable/deleted items excluded with warning message.
  - `repeat_order_used` analytics event logged.

---

**Story ID: ORDER-06**

> As a **shop user**,
> I want to **view my order history**,
> So that **I can see past orders and spending**.

- **Story Points:** 3
- **Priority:** Medium (P1)
- **Acceptance Criteria:**
  - Order History page via bottom nav.
  - Sorted newest first. Each entry: order number, date/time, items, total, done/pending badge.
  - Date filter: Today | This Week | This Month.
  - "Reorder" button on each entry — loads items into cart.
  - Empty state: "No orders yet. Place your first order from the menu!"
  - Paginated (20 per page) or infinite scroll.

---

### Epic 5: Admin Dashboard & Order Management

**Description:** Admin sees live orders, marks done, filters, views shop history, daily summary.

**Business Value:** How the bakery knows what to prepare.

**Maps to:** FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-26

---

**Story ID: ADMIN-01**

> As an **admin**,
> I want to **see all new orders in real-time**,
> So that **I can start preparing immediately**.

- **Story Points:** 8
- **Priority:** High
- **Acceptance Criteria:**
  - Dashboard is admin landing page. Shows pending orders sorted oldest first.
  - Each card: order number, shop name, items, notes, total, time since placed.
  - New orders appear instantly via SSE. Fallback: poll every 10 seconds.
  - "Reconnecting..." banner if SSE drops.
  - Empty state: "No pending orders. Waiting for shops to order..."

---

**Story ID: ADMIN-02**

> As an **admin**,
> I want to **mark an order as "Done"**,
> So that **it moves off the active queue**.

- **Story Points:** 2
- **Priority:** High
- **Acceptance Criteria:**
  - "Done" button on each order card.
  - Confirmation prompt: "Mark this order as done?"
  - Sets `is_done = true` and `done_at` timestamp.
  - Order moves to completed section.
  - `order_done` analytics event logged with fulfillment time.

---

**Story ID: ADMIN-03**

> As an **admin**,
> I want to **receive audio and visual alerts for new orders**,
> So that **I don't miss orders when not looking at the screen**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - Audio chime on new order (Web Audio API).
  - New order card has a highlight animation.
  - Browser tab title: "(2) New Orders — Tamurfood".
  - Mute/unmute toggle.
  - Audio plays once per new batch, not per order.

---

**Story ID: ADMIN-04**

> As an **admin**,
> I want to **filter orders by date**,
> So that **I can look back at previous days**.

- **Story Points:** 2
- **Priority:** Medium (P1)
- **Acceptance Criteria:**
  - Date filter: Today (default), Yesterday, custom date picker.
  - Filtered view shows all orders (done + pending) for selected date.

---

**Story ID: ADMIN-05**

> As an **admin**,
> I want to **view a specific shop's order history**,
> So that **I can check their patterns or resolve disputes**.

- **Story Points:** 3
- **Priority:** Medium (P1)
- **Acceptance Criteria:**
  - Clickable shop name on order cards and shop list.
  - Opens shop's full order history (newest first).
  - Each entry: date/time, items, total, status.

---

**Story ID: ADMIN-06**

> As an **admin**,
> I want to **see a daily summary**,
> So that **I have a quick business snapshot**.

- **Story Points:** 2
- **Priority:** Medium (P1)
- **Acceptance Criteria:**
  - Summary strip on dashboard: "Today: X orders | ৳Y revenue".
  - Updates as orders come in and are marked done.

---

### Epic 6: Shop Management

**Description:** Admin registers, edits, disables shops.

**Business Value:** Controls system access.

**Maps to:** FR-27, FR-28, FR-29

---

**Story ID: SHOP-01**

> As an **admin**,
> I want to **register a new shop**,
> So that **the shopkeeper can start ordering**.

- **Story Points:** 5
- **Priority:** High
- **Acceptance Criteria:**
  - Form: shop name, owner name, phone (unique), email (optional — for password reset), address, initial temporary password.
  - Creates user (role: shop) + shop record.
  - Validation: phone must be unique; email unique if provided.
  - Error: "A shop with this phone number already exists."
  - Admin tells the shopkeeper: "Log in with your phone and this temporary password, then change your password."

---

**Story ID: SHOP-02**

> As an **admin**,
> I want to **edit, reset password, or disable a shop**,
> So that **I can maintain the shop list**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - Shop list: name, owner, phone, address, status badge.
  - Edit: pre-filled form.
  - Reset Password: sets new password, revokes all sessions.
  - Disable: `is_active = false`, shop can't log in. Pending orders still visible.
  - Search by name or phone.

---

### Epic 7: Khata (Monthly Credit System)

**Description:** Auto-track credit from orders. Record payments. Both sides see the ledger.

**Business Value:** Replaces the handwritten khata notebook.

**Maps to:** FR-30, FR-31, FR-32, FR-33

---

**Story ID: KHATA-01**

> As the **system**,
> I want to **automatically add every order total to the shop's khata balance**,
> So that **credit is tracked without manual entry**.

- **Story Points:** 2
- **Priority:** High
- **Acceptance Criteria:**
  - Order total recorded as debit in khata on order placement.
  - Ledger shows order as line item with date, amount, order number.

---

**Story ID: KHATA-02**

> As an **admin**,
> I want to **record a payment from a shop**,
> So that **the balance updates when a shop pays me**.

- **Story Points:** 3
- **Priority:** High
- **Acceptance Criteria:**
  - "Record Payment" button on shop's khata page.
  - Form: amount (required, positive), date (default today), note (optional).
  - Payment saved and appears as credit in ledger.
  - Balance updates immediately.
  - Validation: amount must be positive. Overpayment allowed (balance goes negative).
  - `payment_recorded` analytics event logged.

---

**Story ID: KHATA-03**

> As a **shop user or admin**,
> I want to **view a shop's khata ledger**,
> So that **both sides see the same record**.

- **Story Points:** 5
- **Priority:** High
- **Acceptance Criteria:**
  - Chronological list: orders (debits) and payments (credits).
  - Running balance after each entry.
  - Monthly summary: total ordered, total paid, outstanding balance.
  - Shop sees only their own. Admin can view any shop.
  - Balance carries across months (no reset).
  - Empty state: "No transactions this month."

---

**Story ID: KHATA-04**

> As an **admin**,
> I want to **see all shops' khata balances at a glance**,
> So that **I know who owes me money**.

- **Story Points:** 3
- **Priority:** Medium (P1)
- **Acceptance Criteria:**
  - Table: shop name, total ordered, total paid, balance due.
  - Sorted by highest balance first.
  - Clickable → opens shop's full ledger.

---

### Sprint Plan

| Sprint | Weeks | Epics | Stories | Points | Goal |
|--------|-------|-------|---------|--------|------|
| **1** | 1–2 | Setup + Auth (core) | SETUP-01, SETUP-02, AUTH-01, AUTH-02, AUTH-03, AUTH-05, AUTH-06 | 22 | Project running. Login works. Password change works. Routes protected. |
| **2** | 3–4 | Menu + Shop Mgmt + Password Reset | MENU-01, MENU-02, MENU-03, MENU-05, SHOP-01, SHOP-02, AUTH-04 | 25 | Admin manages menu and shops. Shops see menu. Forgot password works. |
| **3** | 5–6 | Ordering | ORDER-01, ORDER-02, ORDER-03, ORDER-04, ORDER-05, ORDER-06 | 18 | Shops can place orders, repeat orders, view history. |
| **4** | 7–8 | Admin Dashboard | ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06 | 20 | Live orders, mark done, daily summary. |
| **5** | 9–10 | Khata + Deploy | KHATA-01, KHATA-02, KHATA-03, KHATA-04, SETUP-03 | 16 | Khata live. Deployed to production. |

**Total: ~101 story points across 5 sprints (~10 weeks)**

### Sprint Dependencies

```
Sprint 1: Setup + Auth (everything depends on this)
    │
    ├── Sprint 2: Menu + Shop Mgmt (needs auth + DB)
    │       │
    │       └── Sprint 3: Ordering (needs menu + shops)
    │               │
    │               └── Sprint 4: Admin Dashboard (needs orders flowing)
    │                       │
    │                       └── Sprint 5: Khata + Deploy
```

### Definition of Done (every story)

- Code reviewed (if 2 devs) or self-reviewed against acceptance criteria.
- Zod validation on both client and server for all inputs.
- Works on mobile (tested on 360px viewport in Chrome DevTools).
- API returns proper error codes (400, 401, 403, 404, 500).
- Error states handled per Section 13.
- No console errors in browser.
- Data persists correctly in PostgreSQL.

---

*End of Document*