# Stally Dashboard Redesign AI Task Cards

Use these cards one at a time with another AI. Each card is intentionally small. Do not give an AI multiple cards unless the previous one is verified.

## Global Handoff Prompt

Paste this before any card:

```text
You are working in the StallyApp repo. Do not change backend APIs, database schema, or server routes. Do not revert existing UI refresh changes. Implement only the task card below. Keep changes scoped. Run the listed verification commands and report exact results. If a selector/test needs to change, explain why before changing it.
```

## Card 0.1 - Add Dashboard Redesign E2E Skeleton

**Goal:** Add an acceptance test that describes the new shared workspace flow.

**Files:**
- Create `e2e/dashboard-redesign.spec.ts`

**Do:**
- Add tests for entering workspace without role picker/tutorial.
- Add tests for header workbar IDs.
- Add tests for five-module navigation.
- Add tests for Operator and Executive dashboard visibility.

**Do not:**
- Modify app code.
- Make the test pass in this card.

**Verify:**

```powershell
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected result: fails because implementation is not done yet.

## Card 0.2 - Add Minimal i18n Helper

**Goal:** Create a small dictionary for new login/header/dashboard/sidebar labels.

**Files:**
- Create `src/i18n.ts`

**Do:**
- Export `Locale = "vi" | "en"`.
- Export `defaultLocale = "vi"`.
- Export `labels.vi` and `labels.en`.
- Export `createTranslator(locale)`.

**Do not:**
- Translate all legacy components.
- Add external i18n dependency.

**Verify:**

```powershell
npm run lint
```

Expected result: pass.

## Card 1.1 - Redesign Login As Workspace Entry

**Goal:** Remove the visible PoC role picker from login.

**Files:**
- Modify `src/components/LoginScreen.tsx`

**Do:**
- Keep email auth config and Google auth config logic.
- Keep `#btn-login`.
- Make primary CTA enter workspace as procurement when role auth is disabled.
- Do not open onboarding/tutorial modal.

**Do not:**
- Delete auth-related fetches.
- Delete role types.
- Modify backend auth routes.

**Verify:**

```powershell
npm run lint
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected result: login-related assertions pass; later header/dashboard assertions may still fail.

## Card 1.2 - Stop Rendering Tutorial And Role-Specific Overview

**Goal:** Main app no longer branches Overview by demo role.

**Files:**
- Modify `src/App.tsx`

**Do:**
- Ensure `handleLogin` always disables tutorial.
- Remove visible `OnboardingTutorial` render path.
- Stop rendering `RequesterDashboard`, `WarehouseDashboard`, and `ManagerDashboard` in Overview.
- Keep legacy files in repo.

**Do not:**
- Delete legacy components.
- Change business actions like create PR/RFQ/approve quote.

**Verify:**

```powershell
npm run lint
```

Expected result: pass with no unused imports.

## Card 2.1 - Build Header Workbar

**Goal:** Turn header into a useful product workbar.

**Files:**
- Modify `src/App.tsx`

**Do:**
- Add `dashboardView` state.
- Add `locale` state using `src/i18n.ts`.
- Add global search input with `id="global-search"`.
- Add quick action buttons:
  - `#btn-quick-create-pr`
  - `#btn-quick-create-rfq`
  - `#btn-quick-add-supplier`
- Add dashboard switch:
  - `#btn-dashboard-view-operator`
  - `#btn-dashboard-view-executive`
- Add language buttons:
  - `#btn-lang-vi`
  - `#btn-lang-en`
- Add notification/settings static stub buttons:
  - `#btn-notifications`
  - `#btn-settings`

**Do not:**
- Implement real notification backend.
- Implement real settings page.

**Verify:**

```powershell
npm run lint
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected result: header assertions pass.

## Card 2.2 - Reduce Sidebar Navigation

**Goal:** Sidebar shows only the core procurement modules.

**Files:**
- Modify `src/components/Sidebar.tsx`

**Do:**
- Keep only Dashboard, Cases, PR, RFQ, Suppliers.
- Preserve IDs:
  - `#btn-tab-overview`
  - `#btn-tab-cases`
  - `#btn-tab-pr`
  - `#btn-tab-rfq`
  - `#btn-tab-suppliers`
- Remove Inventory from visible navigation.
- Remove role/permission demo labels from visible sidebar.

**Do not:**
- Delete `InventoryManager.tsx`.
- Delete inventory logic from backend or state.

**Verify:**

```powershell
npm run lint
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected result: navigation assertions pass.

## Card 3.1 - Add Dashboard Metrics Tests

**Goal:** Define real metric behavior before implementation.

**Files:**
- Create `src/dashboardMetrics.test.ts`

**Do:**
- Test approved spend counts only selected positive quotes.
- Test risky quote appears in queue.
- Test queue ordering prioritizes risk before overdue/value.

**Do not:**
- Implement `dashboardMetrics.ts` in this card.

**Verify:**

```powershell
npx vitest run src/dashboardMetrics.test.ts
```

Expected result: fails because helper is missing.

## Card 3.2 - Implement Dashboard Metrics Helper

**Goal:** Create frontend-derived metrics from existing `/api/state` data shapes.

**Files:**
- Create `src/dashboardMetrics.ts`

**Do:**
- Export `buildDashboardMetrics(input)`.
- Use `getQuoteRiskFlags` from `src/quoteRisk.ts`.
- Return `operator` metrics and `executive` metrics.
- Sort priority queue by severity and value.

**Do not:**
- Fetch inside this helper.
- Add backend endpoint.
- Change `quoteRisk.ts` threshold unless explicitly requested.

**Verify:**

```powershell
npx vitest run src/dashboardMetrics.test.ts
npm run lint
```

Expected result: both pass.

## Card 4.1 - Create Priority Queue Component

**Goal:** Build the central operator action list.

**Files:**
- Create `src/components/dashboard/PriorityQueue.tsx`

**Do:**
- Accept `tasks` from `DashboardTask[]`.
- Accept `onNavigate(tab)`.
- Show empty state when no tasks.
- Show top 8 tasks with reason, due label, severity, and `Xử lý` CTA.

**Do not:**
- Fetch data in the component.
- Open modals from the queue.

**Verify:**

```powershell
npm run lint
```

Expected result: pass.

## Card 4.2 - Create Operator Dashboard Component

**Goal:** Build the default dashboard view for procurement operators.

**Files:**
- Create `src/components/dashboard/OperatorDashboard.tsx`

**Do:**
- Render `data-testid="operator-dashboard"`.
- Show KPI cards:
  - Việc cần xử lý
  - RFQ đang chờ
  - Báo giá cần review
  - Case quá hạn
- Render `PriorityQueue`.

**Do not:**
- Add charts.
- Add long explanatory copy.

**Verify:**

```powershell
npm run lint
```

Expected result: pass.

## Card 4.3 - Wire Operator Dashboard Into Overview

**Goal:** Overview uses real metrics and renders OperatorDashboard.

**Files:**
- Modify `src/App.tsx`

**Do:**
- Import `buildDashboardMetrics`.
- Import `OperatorDashboard`.
- Store `cases` from `/api/state` if not already stored.
- Pass current state arrays into `buildDashboardMetrics`.
- Render `OperatorDashboard` when dashboard view is operator.

**Do not:**
- Remove existing PR/RFQ/Suppliers flows.
- Change API calls.

**Verify:**

```powershell
npm run lint
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected result: Operator dashboard assertion passes.

## Card 5.1 - Create Executive Dashboard Component

**Goal:** Build a compact management view using real metrics only.

**Files:**
- Create `src/components/dashboard/ExecutiveDashboard.tsx`

**Do:**
- Render `data-testid="executive-dashboard"`.
- Show approved spend, SLA health, risk exposure, and pipeline summary.
- Use simple bars/lists from real pipeline counts.
- Show honest empty states if values are zero.

**Do not:**
- Recreate hard-coded SVG trend chart.
- Recreate hard-coded budget category bars.

**Verify:**

```powershell
npm run lint
```

Expected result: pass.

## Card 5.2 - Wire Executive View Into Overview

**Goal:** Header switch shows ExecutiveDashboard.

**Files:**
- Modify `src/App.tsx`

**Do:**
- Import `ExecutiveDashboard`.
- Render it when `dashboardView === "executive"`.
- Ensure `#btn-dashboard-view-executive` activates it.

**Do not:**
- Add a new route.
- Add a new API.

**Verify:**

```powershell
npm run lint
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected result: Executive dashboard assertion passes.

## Card 6.1 - Update Legacy Role E2E

**Goal:** Tests no longer expect the old PoC role selector.

**Files:**
- Modify `e2e/roles.spec.ts`

**Do:**
- Replace 4 role journey tests with one shared workspace smoke test.
- Assert login button, header, Dashboard tab, Cases tab.

**Do not:**
- Delete the file.
- Test legacy role dashboards.

**Verify:**

```powershell
npx playwright test e2e/roles.spec.ts --project=chromium
```

Expected result: pass.

## Card 6.2 - Remove StatsDashboard From Main Flow

**Goal:** The old noisy dashboard is no longer imported/rendered from App.

**Files:**
- Modify `src/App.tsx`

**Do:**
- Remove `StatsDashboard` import.
- Ensure Overview only renders OperatorDashboard or ExecutiveDashboard.

**Do not:**
- Delete `src/components/StatsDashboard.tsx`.

**Verify:**

```powershell
npm run lint
```

Expected result: pass.

## Card 6.3 - Copy Cleanup Pass For Main Procurement Flow

**Goal:** Remove leftover PoC slogans, mixed English/Vietnamese labels, and long explanatory text from the visible main flow.

**Files:**
- Modify `src/App.tsx`
- Modify `src/components/Sidebar.tsx`
- Modify `src/components/PurchaseRequestsList.tsx`
- Modify `src/components/RfqComparison.tsx`
- Modify `src/components/SupplierManagement.tsx`
- Modify `src/components/ProcurementDashboard.tsx` only if it is still visible in the main flow

**Do:**
- Search visible components for noisy words:

```powershell
rg -n "CFO|COO|Audit workspace|Procurement Control Room|Supplier moat|Control Room|AI Agent|Dùng Trợ lý AI|Chức năng cấp phép|Đặc Quyền Vai Trò|Bếp|Thủ Kho|Giám Đốc|Horeca|workflow|audit trail|human review|red-flag" src\App.tsx src\components
```

- Replace visible copy with concise Vietnamese:
  - `Procurement Control Room` -> `Dashboard`
  - `Audit workspace: org-1` -> `Workspace: org-1`
  - `CFO/COO nhìn spend, risk và audit trail trong 30 giây` -> `Tổng quan mua hàng`
  - `Supplier moat` -> `Nhà cung cấp`
  - `Catalog Horeca & Nhà cung cấp đã kiểm chứng` -> `Danh sách nhà cung cấp`
  - `RFQ Compare & Human Review` -> `So sánh báo giá`
  - `AI confidence phải qua human review` -> `Cần kiểm tra thủ công khi AI thiếu chắc chắn`
- Keep useful business abbreviations: `PR`, `RFQ`, `PO`, `NCC`, `SLA`.
- Keep dashboard title maximum 5 words.
- Keep dashboard subtitles to one sentence.
- Keep card helper text maximum 12 words.

**Do not:**
- Edit non-rendered legacy role components unless they still appear in the main flow.
- Remove business terms users need to learn, such as PR/RFQ/PO/NCC.
- Replace concise labels with marketing slogans.

**Verify:**

```powershell
rg -n "CFO|COO|Supplier moat|Control Room|Đặc Quyền Vai Trò|Chức năng cấp phép|Dùng Trợ lý AI" src\App.tsx src\components
npm run lint
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected result: no matches in visible main-flow files; lint and e2e pass. If matches remain only inside non-rendered legacy files, list them in the report.

## Card 7.1 - Final Verification

**Goal:** Confirm the redesigned dashboard is safe to hand back.

**Files:**
- No planned edits.

**Do:**
- Run all verification commands.
- Browser smoke desktop and mobile.
- Report any remaining warnings separately from failures.

**Verify:**

```powershell
npm run lint
npm run build
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
npx playwright test e2e/ui-refresh.spec.ts --project=chromium
```

Expected result: all pass. Existing Vite chunk-size warning is acceptable if build exits 0.
