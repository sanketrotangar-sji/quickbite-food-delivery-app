# 05 — Flows

Sequence diagrams for the main journeys. Boxes named after real files/RPCs where useful.

---

## Order status state machine

```mermaid
stateDiagram-v2
  [*] --> placed: place_order
  placed --> preparing: kitchen
  preparing --> ready: kitchen
  placed --> cancelled: kitchen
  preparing --> cancelled: kitchen
  ready --> out_for_delivery: rider
  out_for_delivery --> delivered: rider
  delivered --> [*]
  cancelled --> [*]
```

| Transition | Who | Mechanism |
|------------|-----|-----------|
| → `placed` | Customer | RPC `place_order` |
| `placed` → `preparing` | Manager/owner of that kitchen | `restaurant_set_order_status` |
| `preparing` → `ready` | Kitchen | same |
| `placed`/`preparing` → `cancelled` | Kitchen | same |
| Assign `rider_id` while `preparing`/`ready` | Rider claim **or** auto-assign trigger on `ready` | `claim_delivery` / `auto_assign_rider` |
| `ready` → `out_for_delivery` | Assigned rider | `rider_set_order_status` |
| `out_for_delivery` → `delivered` | Assigned rider | same |

**Product TODO (CONFIRMED BY YOU):** **order acceptance timeout** — if kitchen leaves an order in `placed` too long, auto-cancel (or similar). Not implemented yet; design in Phase 3.

Self-deal guards: you cannot kitchen-handle or rate in ways that game your own restaurant / own delivery (RPC + rating RLS).

---

## Sign-up (email)

```mermaid
sequenceDiagram
  actor U as User
  participant UI as SignupScreen
  participant Auth as Supabase Auth
  participant Trig as handle_new_user
  participant P as profiles

  U->>UI: email + password + name
  UI->>Auth: signUp (metadata full_name, phone)
  Auth->>Trig: after insert auth.users
  Trig->>P: insert role=customer
  Auth-->>UI: session (if confirmations allow)
  UI->>P: getProfile (useAuth retries)
```

**Google:** same trigger; metadata uses Google `name`. Client: `signInWithGoogle` in `apps/client/src/api/auth.ts`. Manager: parallel in `apps/manager/src/api/auth.ts`.

---

## Login → home

```mermaid
sequenceDiagram
  actor U as User
  participant Login as LoginScreen
  participant Auth as Supabase Auth
  participant Hook as useAuth
  participant Idx as app/index.tsx

  U->>Login: email/password or Google
  Login->>Auth: signIn
  Auth-->>Hook: onAuthStateChange session
  Hook->>Hook: load profiles row
  Idx->>Idx: if rider role + lastRole rider → rider tabs else customer tabs
```

Dashboard: `auth-gate.tsx` sends admin / owner / manager to their routes; others blocked.

---

## Browse restaurants

```mermaid
sequenceDiagram
  participant Home as Home/Explore
  participant API as api/home.ts
  participant View as restaurant_browse
  participant Menu as menu_items
  participant Ratings as restaurant_rating_public

  Home->>API: load catalog
  API->>View: select open/closed kitchens
  API->>Menu: available dishes (limited)
  API->>Ratings: food scores for averages
  API-->>Home: cards / lists
```

---

## Cart → place order

```mermaid
sequenceDiagram
  actor C as Customer
  participant UI as Cart/Checkout
  participant Cart as cart_items
  participant Trig as enforce_cart_rules
  participant RPC as place_order
  participant Ord as orders
  participant Items as order_items
  participant Hist as order_status_history

  C->>UI: add dish
  UI->>Cart: insert/update
  Cart->>Trig: same restaurant?
  C->>UI: checkout + address
  UI->>RPC: place_order(...)
  RPC->>Cart: lock + validate open + prices
  RPC->>Ord: insert status=placed
  RPC->>Items: snapshot lines
  RPC->>Cart: delete cart
  Ord->>Hist: trigger log placed
  RPC-->>UI: order id
```

---

## Kitchen accepts → ready

```mermaid
sequenceDiagram
  actor M as Manager
  participant Dash as manager api/orders
  participant RPC as restaurant_set_order_status
  participant Ord as orders
  participant Auto as auto_assign_rider

  M->>Dash: Accept / Preparing / Ready
  Dash->>RPC: p_status
  RPC->>RPC: manages_restaurant? not self-order?
  RPC->>Ord: update if legal transition
  alt status becomes ready and no rider
    Ord->>Auto: BEFORE UPDATE trigger
    Auto->>Ord: set nearest online rider_id
  end
```

Optional: DB webhook → `notify-new-order` → Expo push.

---

## Rider claim → deliver

```mermaid
sequenceDiagram
  actor R as Rider
  participant App as Rider UI
  participant Pool as list_rider_delivery_pool
  participant Claim as claim_delivery
  participant Stat as rider_set_order_status
  participant Loc as rider_locations

  R->>App: go online (rider_set_duty)
  App->>Pool: fetch redacted jobs
  Pool-->>App: preparing/ready unclaimed
  R->>Claim: claim order
  Claim->>Claim: rider_id null race guard
  Note over R,App: Wait until status ready if still preparing
  R->>Stat: out_for_delivery
  loop while delivering
    App->>Loc: update lat/lng + order_id
  end
  R->>Stat: delivered
```

---

## Customer tracking

```mermaid
sequenceDiagram
  actor C as Customer
  participant Track as OrderTracking / map
  participant Ord as orders
  participant Hist as order_status_history
  participant Loc as rider_locations
  participant RT as Realtime

  Track->>Ord: select own order
  Track->>Hist: timeline
  alt status = out_for_delivery
    Track->>Loc: rider pin (RLS)
  end
  RT-->>Track: live updates
```

---

## Rating

```mermaid
sequenceDiagram
  actor C as Customer
  participant UI as Order UI
  participant Rat as ratings

  Note over C,Rat: order.status must be delivered
  C->>UI: stars + optional comment
  UI->>Rat: insert (RLS checks ownership + unique order_id)
```

---

## RIO (high level)

```mermaid
sequenceDiagram
  actor C as Customer
  participant Screen as RioScreen
  participant Edge as functions/rio
  participant LLM as Groq or Ollama
  participant Tools as tools.ts
  participant DB as Postgres RLS

  C->>Screen: message
  Screen->>Edge: POST + Bearer JWT
  Edge->>LLM: system + tools
  loop tool calls
    LLM->>Edge: tool name + args
    Edge->>Tools: run
    Tools->>DB: queries as user (RLS)
    Tools-->>LLM: data + cards
  end
  LLM-->>Screen: reply + cards
  opt confirm checkout
    Screen->>Edge: place action
    Edge->>DB: place_order RPC
  end
```

Tool details: [`06-rio-assistant.md`](./06-rio-assistant.md).

---

## Partner application (rider / owner)

```mermaid
sequenceDiagram
  actor U as Customer
  participant App as submit_application
  actor A as Admin
  participant Rev as admin_review_application
  participant Grant as private.grant_role

  U->>App: kind rider or restaurant_owner
  A->>Rev: approve / reject
  Rev->>Grant: set profiles.role (precedence rules)
```

Manager hire: owner → `owner_invite_manager` → invitee `accept_manager_invite`.
