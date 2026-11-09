# QuickBite — architecture

How the monorepo fits together. Product rules stay in [`REQUIREMENTS.md`](./REQUIREMENTS.md). How we write code, where files go, and how vendors plug in: [`STANDARDS.md`](./STANDARDS.md). One account has one `profiles.role`. Order status changes only through security-definer RPCs.

**Preview:** open this file, then `Ctrl+K` then `V`. Diagrams keep their real size (scroll, do not shrink). Use the **+ / −** buttons on each diagram, or scroll the mouse wheel over it to zoom.

Blue is a client, green is Auth or Edge, amber is Postgres, purple is an AI vendor, gray is any other vendor.

---

## 1. High-level system architecture

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": { "fontSize": "22px", "fontFamily": "Arial" },
  "flowchart": { "useMaxWidth": false, "nodeSpacing": 40, "rankSpacing": 70, "padding": 16 }
}}%%
C4Container
title QuickBite — what talks to what

Person(customer, "Customer", "Cart, checkout, RIO")
Person(rider, "Rider", "Claim jobs, GPS")
Person(kitchen, "Kitchen", "Menu and status")
Person(admin, "Admin", "Tickets and CRM")

System_Boundary(qb, "QuickBite") {
  Container(landing, "Landing", "Vite", "Marketing")
  Container(client, "Mobile app", "Expo", "Customer + rider")
  Container(dash, "Dashboard", "Vercel", "Kitchen + /admin")
  Container(auth, "Auth", "Supabase", "Email + Google")
  ContainerDb(db, "Postgres", "RLS + RPCs", "Orders, RAG, CRM")
  Container(edge, "Edge", "Deno", "RIO, pay, SMS, maps")
}

System_Ext(ai, "AI", "Groq / Ollama chat + embeddings")
System_Ext(pay, "Stripe + Twilio", "Test card pay and SMS")
System_Ext(maps, "Maps + Push", "ORS/OSRM and Expo Push")

Rel(customer, client, "Uses")
Rel(rider, client, "Uses")
Rel(kitchen, dash, "Uses")
Rel(admin, dash, "Uses")
Rel(landing, dash, "Login")
Rel(client, auth, "JWT")
Rel(dash, auth, "JWT")
Rel(client, db, "RPCs")
Rel(dash, db, "RPCs")
Rel(client, edge, "RIO / pay")
Rel(edge, db, "JWT or service role")
Rel(edge, ai, "Chat + RAG")
Rel(edge, pay, "Checkout + SMS")
Rel(edge, maps, "ETA + push")

UpdateElementStyle(customer, $bgColor="#61DAFB", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(rider, $bgColor="#61DAFB", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(kitchen, $bgColor="#61DAFB", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(admin, $bgColor="#61DAFB", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(landing, $bgColor="#61DAFB", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(client, $bgColor="#61DAFB", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(dash, $bgColor="#61DAFB", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(auth, $bgColor="#68A063", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(edge, $bgColor="#68A063", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(db, $bgColor="#FFCA28", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(ai, $bgColor="#C4B5FD", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(pay, $bgColor="#E5E7EB", $fontColor="#000000", $borderColor="#000000")
UpdateElementStyle(maps, $bgColor="#E5E7EB", $fontColor="#000000", $borderColor="#000000")
```

Customers and riders share the Expo app. Owners, managers, and admins share the Vercel dashboard. Both send the anon key plus the user JWT, so Postgres RLS still applies when Edge runs RIO, Stripe, SMS, or push.

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": { "fontSize": "22px", "fontFamily": "Arial" },
  "flowchart": { "useMaxWidth": false, "nodeSpacing": 50, "rankSpacing": 80, "padding": 20 }
}}%%
graph TD
  classDef frontend fill:#61DAFB,stroke:#000,color:#000
  classDef backend fill:#68A063,stroke:#000,color:#000
  classDef db fill:#FFCA28,stroke:#000,color:#000
  classDef ai fill:#C4B5FD,stroke:#000,color:#000
  classDef vendor fill:#E5E7EB,stroke:#000,color:#000

  subgraph people ["People"]
    customer["Customer"]:::frontend
    rider["Rider"]:::frontend
    kitchen["Owner / manager"]:::frontend
    admin["Admin"]:::frontend
  end

  subgraph clients ["Clients"]
    landing["Landing<br/>apps/landing"]:::frontend
    mobile["Expo app<br/>apps/client"]:::frontend
    dash["Dashboard<br/>apps/manager"]:::frontend
  end

  subgraph supa ["Supabase"]
    auth["Auth<br/>email + Google"]:::backend
    db[("Postgres<br/>RLS · RPCs · Realtime")]:::db
    edge["Edge Functions<br/>rio · pay · sms · maps"]:::backend
  end

  subgraph vendors ["Vendors"]
    llm["Groq / Ollama"]:::ai
    stripe["Stripe test"]:::vendor
    twilio["Twilio"]:::vendor
    maps["ORS / OSRM"]:::vendor
  end

  customer --> mobile
  rider --> mobile
  kitchen --> dash
  admin --> dash
  landing -->|login| dash

  mobile --> auth
  dash --> auth
  mobile --> db
  dash --> db
  mobile --> edge
  edge --> db
  edge --> llm
  edge --> stripe
  edge --> twilio
  edge --> maps

  style people fill:#E0F7FF,stroke:#61DAFB,color:#000
  style clients fill:#E0F7FF,stroke:#61DAFB,color:#000
  style supa fill:#EAF6EA,stroke:#68A063,color:#000
  style vendors fill:#F4F4F5,stroke:#52525B,color:#000
```

Solid arrows are calls. The service-role key stays on Edge and scripts, never in `EXPO_PUBLIC_*` or `VITE_*`. Hover a diagram and click **+** if you still need a closer look.

**Hardening note (2026-11-04):** payment state dual-writes to `order_payments`; SMS/push also enqueue `notification_jobs`; rider duty / RIO prefs dual-write `rider_profiles` / `customer_preferences`. Customer browse uses `restaurant_browse` (no synthetic kitchens). Checkout discounts resolve only via kitchen `%` + CRM (`private.resolve_checkout_offer`).

---

## 2. Data flow / request lifecycle

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": { "fontSize": "20px", "fontFamily": "Arial" },
  "sequence": {
    "useMaxWidth": false,
    "actorFontSize": 20,
    "messageFontSize": 18,
    "noteFontSize": 16,
    "actorMargin": 40,
    "boxMargin": 12,
    "width": 200,
    "height": 54
  }
}}%%
sequenceDiagram
  autonumber
  actor Cust as Customer
  participant App as Expo app
  participant Rio as rio Edge
  participant DB as Postgres
  participant Dash as Dashboard
  participant Rider as Rider app

  alt Checkout in the app
    Cust->>App: Confirm cart
    App->>DB: RPC place_order
  else Confirm in RIO
    Cust->>Rio: Confirm dish
    Rio->>DB: RPC place_order (customer JWT)
  end
  Note over DB: 8 km guard, fees, cart cleared. Status = placed.

  DB-->>Dash: Realtime insert
  Dash->>DB: kitchen status → preparing → ready
  DB->>DB: auto_assign_rider on ready

  alt Unclaimed
    Rider->>DB: RPC claim_delivery
  else Auto assigned
    DB-->>Rider: Assigned order
  end
  Rider->>DB: out_for_delivery → delivered
  DB-->>App: Live status + rider pin
```

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": { "fontSize": "20px", "fontFamily": "Arial" },
  "sequence": {
    "useMaxWidth": false,
    "actorFontSize": 20,
    "messageFontSize": 18,
    "noteFontSize": 16,
    "actorMargin": 40,
    "width": 200,
    "height": 54
  }
}}%%
sequenceDiagram
  autonumber
  actor Cust as Customer
  participant App as Expo app
  participant DB as Postgres
  participant Edge as Edge webhooks
  participant Stripe as Stripe
  participant Twilio as Twilio
  participant Push as Expo Push

  DB->>Edge: order webhook
  Edge->>Twilio: SMS on placed / ready / out / delivered
  Edge->>Push: push on preparing / delivered

  opt Card pay (test)
    App->>Edge: create-payment-intent
    Edge->>Stripe: Checkout Session
    Cust->>Stripe: Pay in browser
    Stripe->>Edge: signed webhook
    Edge->>DB: payment_status
  end
```

Cash is the default. Card pay is optional and happens after the order row exists. RIO uses the customer JWT, so it can call `place_order` and it cannot claim a rider or mark a refund.

---

## 3. Folder structure / module dependencies

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": { "fontSize": "22px", "fontFamily": "Arial" },
  "flowchart": { "useMaxWidth": false, "nodeSpacing": 50, "rankSpacing": 70, "padding": 20 }
}}%%
graph TD
  classDef frontend fill:#61DAFB,stroke:#000,color:#000
  classDef backend fill:#68A063,stroke:#000,color:#000
  classDef db fill:#FFCA28,stroke:#000,color:#000
  classDef shared fill:#FDE68A,stroke:#000,color:#000
  classDef tooling fill:#E5E7EB,stroke:#000,color:#000

  subgraph clientG ["apps/client"]
    croutes["app/ routes"]:::frontend
    feats["src/features/*"]:::frontend
    capi["thin api re-exports"]:::frontend
  end

  subgraph dashG ["apps/manager"]
    droutes["thin src/routes"]:::frontend
    mfeats["features/auth kitchen admin"]:::frontend
  end

  landing["apps/landing"]:::frontend
  domain["packages/domain"]:::shared
  dbpkg["packages/db"]:::db
  apipkg["packages/api"]:::shared

  subgraph sb ["supabase/"]
    mig[("migrations/")]:::db
    riofn["functions/rio"]:::backend
    edges["other Edge fns"]:::backend
    eshared["_shared rules"]:::backend
  end

  scripts["scripts/ + CI"]:::tooling

  croutes --> feats --> capi
  droutes --> mfeats
  landing -.->|embedded on /| droutes
  capi --> apipkg
  mfeats --> apipkg
  apipkg --> domain
  apipkg --> dbpkg
  domain --> eshared
  riofn --> eshared
  edges --> eshared
  apipkg -.-> mig
  riofn -.-> mig
  scripts -.-> mig

  style clientG fill:#E0F7FF,stroke:#61DAFB,color:#000
  style dashG fill:#E0F7FF,stroke:#61DAFB,color:#000
  style sb fill:#EAF6EA,stroke:#68A063,color:#000
```

Solid arrows are imports. Dashed arrows are a URL or a runtime call into Postgres. Apps call `bindSupabase(client)` then use `@quickbite/api`. Marketing lives only in `apps/landing`.
