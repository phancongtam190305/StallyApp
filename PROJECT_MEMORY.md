# StallyApp Project Memory & Architecture Guide

This document serves as a persistent context memory for any AI developer working on the **StallyApp** project. It outlines the core business logic, technology stack, design system, viewport layouts, and the recent massive UI redesign.

---

## 1. Project Overview & Business Domain
* **Name**: StallyApp (Stally Procurement & Sourcing Platform)
* **Domain**: A multi-tenant B2B Procurement, Sourcing, and Inventory ERP platform designed for restaurants/hotels.
* **Core Goal**: Connects kitchens (Requesters), warehouses (Inventory Managers), sourcing teams (Procurement Staff), and executives (Approving Managers) into a single, seamless, interactive workflow.
* **Role-Based Workflows**:
  1. **Bếp Trưởng (Requester)**: Creates purchase requests for ingredients/supplies using smart autocomplete search forms.
  2. **Thủ Kho Trưởng (Warehouse Manager)**: Inspects, receives, and logs shipments/deliveries.
  3. **Nhân Viên Thu Mua (Procurement Staff)**: Manages requests in a Kanban pipeline, matches them with suppliers, and routes POs for approval.
  4. **Giám Đốc Phê Duyệt (Manager/Approver)**: Reviews spending analytics and approves/rejects Purchase Orders.
  5. **Stally AI Assistant (Chatbot)**: Floating interactive virtual assistant offering FAQ search and contextual guidance.

---

## 2. Technology Stack & Directory Structure
* **Backend**: Node.js/Express app connected to an SQLite database (`server.ts`). Strictly decoupled. **No schema changes or database modifications are allowed** to preserve backward compatibility.
* **Frontend**: React, TypeScript, Vite, Tailwind CSS (configured under Tailwind v4 `@theme` directives).
* **Key Configuration Files**:
  * `src/index.css`: Defines the global Tailwind design tokens, typography, and premium utilities (bubbles, custom glow filters, retro ribbons).
  * `src/App.tsx`: Main React component managing the authenticated layouts, routing, navigation, and sidebar hooks.
  * `package.json`: Contains bundling and compilation scripts (`npm run build`, `npm run dev`).
  * `.gitignore`: Reconfigured to successfully ignore heavy debugging assets like `chrome-profile/` and `chrome_*.log`.

---

## 3. Visual Identity: The "Flip7 Design System"
StallyApp was completely redesigned from a flat corporate look into the custom **Flip7 Design System**—a retro-playful, teal-coral-gold mobile-first theme inspired by classic board game packaging.

### Core Color Palette (Tailwind `@theme` Tokens)
* **Primary Teal** (`#2BA8A2`): Main UI accents, backgrounds, progress bars, and active badges.
* **Primary Light** (`#3CC4BD`): Lighter teal tones, hover states.
* **Primary Dark** (`#1E8C86`): Deep backgrounds, readable dark text on light surfaces.
* **Primary BG** (`#E8F6F5`): Soft mint-cream tint for light backgrounds.
* **Accent Gold** (`#FFD23F`): High-priority CTAs, manager celebration indicators, savings highlights.
* **Accent Light** (`#FFE47A`): Active metrics backgrounds.
* **Accent Dark** (`#E6B800`): Gold hover depth.
* **Coral** (`#EF5B5B`): Deletion/danger actions, critical alerts.

### Aesthetic Patterns & Typography
* **Harmonious Cream & Slate**: Neutral base tones are soft cream/warm gray rather than sterile hospital blue/gray.
* **Tactile Ribbons & Parallelograms**: Elements use bold game-piece borders, `.retro-ribbon` skewed containers, and dynamic fanned cards for branding.
* **BounceBox Roundedness**: All card containers use bubble-like rounded corners (`rounded-2xl` / `rounded-3xl`) and active mint-neon or gold-glow drop shadows.
* **Premium Typography**: Leverages Outfit/Inter Google Web Fonts with clean hierarchies.

---

## 4. Layout Architecture: Single-Screen Viewport Layout
To eliminate the confusing double vertical scrollbars and layout squeezing on various browser sizes, the application enforces a strict **Single-Screen Viewport Layout**:
* **Root Container (`App.tsx`)**: Reconfigured to `h-screen w-screen overflow-hidden flex flex-col md:flex-row`.
* **Pinned Sidebar & Header**: The navigation sidebar (`Sidebar.tsx`) and layout header are permanently locked on-screen.
* **Isolated Content Scrolling**: Each active tab/view uses separate height-bound scroll wrappers (`overflow-y-auto h-full min-h-0 flex-1`). The browser viewport itself never overflows vertically.

---

## 5. Main Components & Redesign Status

### 🗂️ Sidebar (`Sidebar.tsx`) & Login Screen (`LoginScreen.tsx`)
* **Redesign**: Replaced static logos with a dynamic, CSS-driven fanned playing cards graphic representing "Stally".
* **Interaction**: Navigation items glow with teal dropshadows on hover, with gold badges marking active counts.

### 🍳 Requester Dashboard (`RequesterDashboard.tsx`)
* **Features**: Dynamic multi-item purchase requisition wizard.
* **Styling**: Bubbly input fields, tactile autocomplete select dropdowns, and clean, high-contrast action buttons.

### 📦 Warehouse Dashboard (`WarehouseDashboard.tsx`)
* **Features**: Color-coded shipment cards representing pending, received, and delayed states.
* **Aesthetics**: Playful icons, smooth check-in drawer transitions.

### 📑 Procurement Pipeline (`ProcurementDashboard.tsx` & `CaseDetailTimeline.tsx`)
* **Responsive Kanban**: Re-engineered column grids. Kanban lanes now stretch horizontally in a single-row flex container (`flex-row overflow-x-auto h-full`), with cards scrolling *vertically* inside lanes (`overflow-y-auto`). Avoids breaking the viewport.
* **Timeline Stepper**: `CaseDetailTimeline.tsx` uses a horizontal bubble stepper wizard. Selecting a step dynamically filters and reveals localized procurement actions (supplier bids, manager approval status).

### 📈 Manager Dashboard (`ManagerDashboard.tsx`)
* **Analytics**: Custom interactive SVG charts (Spending Trend smooth area chart, Category Doughnut segment breakdown) matching the teal-gold palette.
* **PO Approvals**: Gold-accented approval wizard cards (`border-l-[6px] border-l-accent-gold shadow-accent-glow`).
* **Savings Podium**: A custom 3D vector-like **Victory Podium** celebrating procurement staff ranking by total cost savings.

### 💬 AI Floating Assistant (`FloatingChatbot.tsx`)
* **Bubble**: A glowing mint orb anchored at the bottom-right corner with a pulsing breath animation.
* **Interface**: Expanding modal dialog in glassmorphic cream, showcasing smart FAQ chips and simulated LLM replies.

---

## 6. Development & Verification Guide
* **Build Check**: Before commits, run `npx tsc --noEmit` and `npm run build` to verify that there are zero TypeScript compiler warnings or bundle errors.
* **Local Run**: `npm run dev` starts the application on port `3000` (`http://localhost:3000`).
* **Git Status**: Currently clean on branch `main` and fully pushed to the remote repository.
