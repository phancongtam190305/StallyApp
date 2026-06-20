# Stally Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Stally dashboard and shell into a focused procurement workspace with operator and executive views, consistent Vietnamese/English UI copy, and real frontend-derived metrics.

**Architecture:** Keep backend and database unchanged. Add small frontend-only helpers for i18n and dashboard metrics, then replace the Overview surface with new dashboard components while leaving legacy role components in the repo but outside the main render path.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS utility classes, Playwright, Vitest/TypeScript checks.

---

## Ground Rules For Every Worker

- Do not change backend API, database schema, or server routes.
- Do not revert existing UI refresh changes.
- Do not delete legacy role components in this redesign pass.
- Do not introduce a chart library unless a task explicitly says so.
- Prefer small focused files over adding more logic to `src/App.tsx`.
- After each task, run the exact verification listed for that task.

## Target File Map

- Create `src/i18n.ts`: small dictionary and language helpers for new shell/dashboard copy.
- Create `src/dashboardMetrics.ts`: pure functions for KPI, queue, risk, spend, and pipeline metrics.
- Create `src/dashboardMetrics.test.ts`: unit tests for metric logic.
- Create `src/components/dashboard/OperatorDashboard.tsx`: operator action center.
- Create `src/components/dashboard/ExecutiveDashboard.tsx`: executive overview.
- Create `src/components/dashboard/PriorityQueue.tsx`: focused action list used by Operator view.
- Modify `src/components/LoginScreen.tsx`: workspace login instead of role picker.
- Modify `src/components/Sidebar.tsx`: five-module navigation with consistent copy.
- Modify `src/App.tsx`: dashboard view switch, header workbar, language state, new dashboard render path.
- Create or replace `e2e/dashboard-redesign.spec.ts`: browser acceptance coverage for the new flow.

---

## Phase 0: Baseline Tests And Glossary

### Task 0.1: Add Dashboard Redesign E2E Skeleton

**Files:**
- Create: `e2e/dashboard-redesign.spec.ts`

- [ ] **Step 1: Create the failing e2e test**

Add this test file:

```ts
import { expect, test } from "@playwright/test";

async function enterWorkspace(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000");
  await page.click("#btn-login");
  await expect(page.locator("header")).toBeVisible();
}

test.describe("Stally dashboard redesign", () => {
  test("enters a shared procurement workspace without role picker or tutorial", async ({ page }) => {
    await page.goto("http://localhost:3000");

    await expect(page.getByText(/Bếp Trưởng|Thủ Kho|Giám Đốc Phê Duyệt/i)).toHaveCount(0);
    await page.click("#btn-login");

    await expect(page.locator("#onboarding-modal")).toHaveCount(0);
    await expect(page.locator("header")).toContainText(/Stally|Dashboard|Bảng điều khiển/i);
  });

  test("renders the new workbar, five-module navigation, and dashboard views", async ({ page }) => {
    await enterWorkspace(page);

    await expect(page.locator("#global-search")).toBeVisible();
    await expect(page.locator("#btn-quick-create-pr")).toBeVisible();
    await expect(page.locator("#btn-quick-create-rfq")).toBeVisible();
    await expect(page.locator("#btn-quick-add-supplier")).toBeVisible();
    await expect(page.locator("#btn-lang-vi")).toBeVisible();
    await expect(page.locator("#btn-lang-en")).toBeVisible();

    await expect(page.locator("#btn-tab-overview")).toBeVisible();
    await expect(page.locator("#btn-tab-cases")).toBeVisible();
    await expect(page.locator("#btn-tab-pr")).toBeVisible();
    await expect(page.locator("#btn-tab-rfq")).toBeVisible();
    await expect(page.locator("#btn-tab-suppliers")).toBeVisible();
    await expect(page.locator("#btn-tab-inventory")).toHaveCount(0);

    await expect(page.getByTestId("operator-dashboard")).toBeVisible();
    await page.click("#btn-dashboard-view-executive");
    await expect(page.getByTestId("executive-dashboard")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```powershell
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected: FAIL because the current login still renders role selector/tutorial and the new header/dashboard IDs do not exist.

- [ ] **Step 3: Keep the failing test committed only with user approval**

If the user wants commits, use:

```powershell
git add e2e/dashboard-redesign.spec.ts
git commit -m "test: define dashboard redesign acceptance flow"
```

### Task 0.2: Add Minimal i18n Dictionary For New Surfaces

**Files:**
- Create: `src/i18n.ts`

- [ ] **Step 1: Add the dictionary helper**

Create:

```ts
export type Locale = "vi" | "en";

export const defaultLocale: Locale = "vi";

export const labels = {
  vi: {
    dashboard: "Dashboard",
    cases: "Hồ sơ mua hàng",
    purchaseRequests: "Yêu cầu mua",
    rfq: "Chào giá",
    suppliers: "Nhà cung cấp",
    operator: "Vận hành",
    executive: "Quản trị",
    createPr: "Tạo PR",
    createRfq: "Tạo RFQ",
    addSupplier: "Thêm NCC",
    searchPlaceholder: "Tìm hồ sơ, PR, RFQ, nhà cung cấp...",
    notifications: "Thông báo",
    settings: "Cài đặt",
    priorityQueue: "Việc cần xử lý",
    pendingRfq: "RFQ đang chờ",
    quoteReview: "Báo giá cần review",
    overdueCases: "Case quá hạn",
    approvedSpend: "Chi tiêu đã duyệt",
    slaHealth: "Sức khỏe SLA",
    riskExposure: "Rủi ro cần chú ý",
    pipelineSummary: "Tổng quan pipeline",
  },
  en: {
    dashboard: "Dashboard",
    cases: "Cases",
    purchaseRequests: "Purchase Requests",
    rfq: "RFQ",
    suppliers: "Suppliers",
    operator: "Operator",
    executive: "Executive",
    createPr: "Create PR",
    createRfq: "Create RFQ",
    addSupplier: "Add Supplier",
    searchPlaceholder: "Search cases, PRs, RFQs, suppliers...",
    notifications: "Notifications",
    settings: "Settings",
    priorityQueue: "Priority Queue",
    pendingRfq: "Pending RFQs",
    quoteReview: "Quotes to Review",
    overdueCases: "Overdue Cases",
    approvedSpend: "Approved Spend",
    slaHealth: "SLA Health",
    riskExposure: "Risk Exposure",
    pipelineSummary: "Pipeline Summary",
  },
} as const;

export type LabelKey = keyof typeof labels.vi;

export function createTranslator(locale: Locale) {
  return (key: LabelKey) => labels[locale][key] || labels.vi[key];
}
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run lint
```

Expected: PASS.

---

## Phase 1: Login And Legacy Flow Removal

### Task 1.1: Redesign Login As Workspace Entry

**Files:**
- Modify: `src/components/LoginScreen.tsx`
- Update test: `e2e/dashboard-redesign.spec.ts`

- [ ] **Step 1: Replace the role-card UI with workspace login UI**

Implementation requirements:

- Keep the existing auth config fetches.
- Keep email role auth if `emailRoleAuthEnabled` is true.
- Keep Google login if `googleOAuthEnabled` is true.
- Remove role card rendering from the visible UI.
- Keep a primary button with `id="btn-login"`.
- Button text in Vietnamese mode: `Vào workspace`.
- Do not show the onboarding question modal.

- [ ] **Step 2: Adjust login submit behavior**

Implementation requirements:

- If email role auth is enabled, resolve the email as currently implemented.
- If email role auth is disabled, call `onLogin("procurement", false, resolvedUser || undefined)`.
- Remove calls that open tutorial selection.

- [ ] **Step 3: Run targeted e2e**

Run:

```powershell
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected: The first test passes or moves to the next missing shell/dashboard selector.

### Task 1.2: Stop Rendering Tutorial And Role-Specific Overview

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove tutorial render path from main flow**

Implementation requirements:

- Keep imports only if TypeScript still needs them. Remove unused imports after edit.
- `showTutorial` should no longer control any rendered modal.
- `handleLogin` should set `setShowTutorial(false)` regardless of input.

- [ ] **Step 2: Stop branching Overview by role**

Implementation requirements:

- Overview should no longer render `RequesterDashboard`, `WarehouseDashboard`, or `ManagerDashboard`.
- Until the new dashboard exists, Overview may continue rendering `StatsDashboard`.
- Do not delete legacy component files.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run lint
```

Expected: PASS with no unused imports.

---

## Phase 2: Header Workbar And Navigation

### Task 2.1: Add Header Workbar State And Controls

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add view and language state**

Add state near other UI state:

```ts
const [dashboardView, setDashboardView] = useState<"operator" | "executive">("operator");
const [locale, setLocale] = useState<Locale>(defaultLocale);
const t = createTranslator(locale);
```

Import from `src/i18n.ts`:

```ts
import { createTranslator, defaultLocale, Locale } from "./i18n";
```

- [ ] **Step 2: Add header control IDs**

Header must include:

- `id="global-search"`
- `id="btn-quick-create-pr"`
- `id="btn-quick-create-rfq"`
- `id="btn-quick-add-supplier"`
- `id="btn-dashboard-view-operator"`
- `id="btn-dashboard-view-executive"`
- `id="btn-lang-vi"`
- `id="btn-lang-en"`
- `id="btn-notifications"`
- `id="btn-settings"`

Actions:

- PR button sets `activeTab` to `pr`.
- RFQ button sets `activeTab` to `rfq`.
- Supplier button sets `activeTab` to `suppliers`.
- Operator/Executive buttons update `dashboardView`.
- VI/EN buttons update `locale`.
- Notification/settings buttons open a small local popover or show a disabled stub label.

- [ ] **Step 3: Run targeted e2e**

Run:

```powershell
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected: Header selector assertions pass.

### Task 2.2: Reduce Sidebar To Five Modules

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Replace menu configuration**

Use these items only:

```ts
const menuItems = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "cases", label: "Hồ sơ mua hàng", icon: GitMerge },
  { id: "pr", label: "Yêu cầu mua", icon: FileSpreadsheet },
  { id: "rfq", label: "Chào giá", icon: SendToBack },
  { id: "suppliers", label: "Nhà cung cấp", icon: Building2 },
];
```

Remove role-based filtering for the main flow.

- [ ] **Step 2: Remove role demo copy from visible sidebar**

Remove visible labels like:

- `Vận hành`
- `Chức năng cấp phép`
- `Ban Mua Sắm`
- `Multi-branch Procurement`

Keep logout.

- [ ] **Step 3: Run e2e navigation assertions**

Run:

```powershell
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected: `#btn-tab-inventory` count is 0 and the five main tab IDs exist.

---

## Phase 3: Real Dashboard Metrics

### Task 3.1: Add Dashboard Metric Tests

**Files:**
- Create: `src/dashboardMetrics.test.ts`
- Create after failing test: `src/dashboardMetrics.ts`

- [ ] **Step 1: Write tests first**

Create:

```ts
import { describe, expect, it } from "vitest";
import { buildDashboardMetrics } from "./dashboardMetrics";
import { ProcurementCase, Quote, RfqCase, PurchaseRequest, InventoryItem, Supplier } from "./types";

const emptyState = {
  purchaseRequests: [] as PurchaseRequest[],
  rfqs: [] as RfqCase[],
  quotes: [] as Quote[],
  inventory: [] as InventoryItem[],
  suppliers: [] as Supplier[],
  cases: [] as ProcurementCase[],
};

describe("buildDashboardMetrics", () => {
  it("counts only selected positive quotes as approved spend", () => {
    const metrics = buildDashboardMetrics({
      ...emptyState,
      quotes: [
        quote({ id: "q1", status: "selected", totalAmount: 1200000 }),
        quote({ id: "q2", status: "selected", totalAmount: 0 }),
        quote({ id: "q3", status: "extracted", totalAmount: 999000 }),
      ],
    });

    expect(metrics.executive.approvedSpend).toBe(1200000);
  });

  it("flags risky quotes in the priority queue", () => {
    const metrics = buildDashboardMetrics({
      ...emptyState,
      quotes: [
        quote({ id: "risk-low-confidence", aiConfidenceScore: 40, totalAmount: 500000 }),
      ],
    });

    expect(metrics.operator.quoteReviewCount).toBe(1);
    expect(metrics.operator.priorityQueue[0].kind).toBe("quote_risk");
  });

  it("orders queue by risk before deadline before value", () => {
    const metrics = buildDashboardMetrics({
      ...emptyState,
      cases: [
        procurementCase({ id: "case-overdue", status: "collecting_quotes", requiredDate: "2020-01-01", priority: "medium" }),
        procurementCase({ id: "case-high-value", status: "pending_approval", requiredDate: "2099-01-01", priority: "urgent" }),
      ],
      quotes: [
        quote({ id: "q-risk", aiConfidenceScore: 20, totalAmount: 1000 }),
      ],
    });

    expect(metrics.operator.priorityQueue[0].kind).toBe("quote_risk");
    expect(metrics.operator.priorityQueue[1].kind).toBe("case_overdue");
  });
});

function quote(overrides: Partial<Quote>): Quote {
  return {
    id: "q",
    organizationId: "org-1",
    rfqCaseId: "rfq-1",
    supplierId: "sup-1",
    supplierName: "Supplier",
    items: [{ name: "Item", quantity: 1, unit: "unit", unitPrice: 1, totalPrice: 1 }],
    subtotal: 1,
    taxAmount: 0,
    shippingFee: 0,
    totalAmount: 1,
    deliveryDays: 3,
    paymentTerms: "Net 30",
    validUntil: "2099-01-01",
    aiConfidenceScore: 100,
    status: "extracted",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function procurementCase(overrides: Partial<ProcurementCase>): ProcurementCase {
  return {
    id: "case-1",
    organizationId: "org-1",
    title: "Case",
    status: "supplier_matching",
    priority: "medium",
    createdFrom: "web",
    requesterName: "Requester",
    departmentName: "Department",
    requiredDate: "2099-01-01",
    items: [{ name: "Item", quantity: 1, unit: "unit" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npx vitest run src/dashboardMetrics.test.ts
```

Expected: FAIL because `src/dashboardMetrics.ts` does not exist.

### Task 3.2: Implement Dashboard Metrics Helper

**Files:**
- Create: `src/dashboardMetrics.ts`

- [ ] **Step 1: Implement exported types and builder**

Create:

```ts
import { getQuoteRiskFlags } from "./quoteRisk";
import { InventoryItem, ProcurementCase, PurchaseRequest, Quote, RfqCase, Supplier } from "./types";

export type DashboardTaskKind =
  | "quote_risk"
  | "case_overdue"
  | "rfq_waiting"
  | "pr_intake"
  | "supplier_missing_info";

export interface DashboardTask {
  id: string;
  kind: DashboardTaskKind;
  title: string;
  reason: string;
  targetTab: "cases" | "pr" | "rfq" | "suppliers";
  severity: "high" | "medium" | "low";
  dueLabel: string;
  value: number;
}

export interface DashboardMetricsInput {
  purchaseRequests: PurchaseRequest[];
  rfqs: RfqCase[];
  quotes: Quote[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  cases: ProcurementCase[];
}

export interface DashboardMetrics {
  operator: {
    actionCount: number;
    pendingRfqCount: number;
    quoteReviewCount: number;
    overdueCaseCount: number;
    priorityQueue: DashboardTask[];
  };
  executive: {
    approvedSpend: number;
    riskCount: number;
    overdueCaseCount: number;
    pipeline: Array<{ id: string; label: string; count: number }>;
  };
}

export function buildDashboardMetrics(input: DashboardMetricsInput): DashboardMetrics {
  const quoteRiskTasks = input.quotes
    .filter((quote) => getQuoteRiskFlags(quote).length > 0)
    .map((quote): DashboardTask => ({
      id: `quote-${quote.id}`,
      kind: "quote_risk",
      title: quote.supplierName || "Báo giá cần kiểm tra",
      reason: getQuoteRiskFlags(quote)[0] || "Báo giá cần kiểm tra thủ công",
      targetTab: "rfq",
      severity: "high",
      dueLabel: "Cần review",
      value: quote.totalAmount || 0,
    }));

  const overdueCaseTasks = input.cases
    .filter((caseItem) => isCaseOverdue(caseItem))
    .map((caseItem): DashboardTask => ({
      id: `case-overdue-${caseItem.id}`,
      kind: "case_overdue",
      title: caseItem.title,
      reason: "Hồ sơ đã quá hạn xử lý nội bộ",
      targetTab: "cases",
      severity: "high",
      dueLabel: caseItem.requiredDate || "Quá hạn",
      value: priorityValue(caseItem.priority),
    }));

  const rfqWaitingTasks = input.rfqs
    .filter((rfq) => ["sent", "quotes_received"].includes(rfq.status))
    .map((rfq): DashboardTask => ({
      id: `rfq-${rfq.id}`,
      kind: "rfq_waiting",
      title: rfq.id.toUpperCase(),
      reason: "RFQ đang chờ phản hồi hoặc cần so sánh báo giá",
      targetTab: "rfq",
      severity: rfq.status === "quotes_received" ? "medium" : "low",
      dueLabel: rfq.dueDate,
      value: 0,
    }));

  const prIntakeTasks = input.purchaseRequests
    .filter((pr) => ["draft", "submitted"].includes(pr.status))
    .map((pr): DashboardTask => ({
      id: `pr-${pr.id}`,
      kind: "pr_intake",
      title: pr.title,
      reason: "Yêu cầu mua cần chuẩn hóa trước khi chào giá",
      targetTab: "pr",
      severity: pr.priority === "high" ? "medium" : "low",
      dueLabel: pr.requiredDate,
      value: priorityValue(pr.priority),
    }));

  const supplierTasks = input.suppliers
    .filter((supplier) => !supplier.email || !supplier.phone || supplier.tags.length === 0)
    .map((supplier): DashboardTask => ({
      id: `supplier-${supplier.id}`,
      kind: "supplier_missing_info",
      title: supplier.name,
      reason: "Hồ sơ nhà cung cấp thiếu email, số điện thoại hoặc tag ngành hàng",
      targetTab: "suppliers",
      severity: "low",
      dueLabel: "Bổ sung hồ sơ",
      value: supplier.rating || 0,
    }));

  const priorityQueue = [
    ...quoteRiskTasks,
    ...overdueCaseTasks,
    ...rfqWaitingTasks,
    ...prIntakeTasks,
    ...supplierTasks,
  ].sort(compareTasks);

  const approvedSpend = input.quotes
    .filter((quote) => quote.status === "selected" && quote.totalAmount > 0)
    .reduce((sum, quote) => sum + quote.totalAmount, 0);

  const pipeline = [
    { id: "intake", label: "Intake", statuses: ["draft_request", "request_submitted", "request_validating"] },
    { id: "sourcing", label: "Sourcing", statuses: ["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"] },
    { id: "review", label: "Review", statuses: ["quote_review", "comparison_ready", "negotiating"] },
    { id: "approval", label: "Approval", statuses: ["pending_approval", "approved", "po_draft"] },
    { id: "fulfillment", label: "Fulfillment", statuses: ["po_sent", "receiving", "closed", "cancelled", "exception"] },
  ].map((group) => ({
    id: group.id,
    label: group.label,
    count: input.cases.filter((caseItem) => group.statuses.includes(caseItem.status)).length,
  }));

  return {
    operator: {
      actionCount: priorityQueue.length,
      pendingRfqCount: rfqWaitingTasks.length,
      quoteReviewCount: quoteRiskTasks.length,
      overdueCaseCount: overdueCaseTasks.length,
      priorityQueue,
    },
    executive: {
      approvedSpend,
      riskCount: quoteRiskTasks.length + supplierTasks.length,
      overdueCaseCount: overdueCaseTasks.length,
      pipeline,
    },
  };
}

function compareTasks(a: DashboardTask, b: DashboardTask) {
  const severityScore = { high: 3, medium: 2, low: 1 };
  const severityDelta = severityScore[b.severity] - severityScore[a.severity];
  if (severityDelta !== 0) return severityDelta;
  return b.value - a.value;
}

function isCaseOverdue(caseItem: ProcurementCase) {
  if (!caseItem.requiredDate || ["closed", "cancelled"].includes(caseItem.status)) return false;
  const dueDate = new Date(`${caseItem.requiredDate}T23:59:59`);
  return Number.isFinite(dueDate.getTime()) && dueDate.getTime() < Date.now();
}

function priorityValue(priority: string | undefined) {
  if (priority === "urgent") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}
```

- [ ] **Step 2: Run metric tests**

Run:

```powershell
npx vitest run src/dashboardMetrics.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run lint
```

Expected: PASS.

---

## Phase 4: Operator Dashboard

### Task 4.1: Create Priority Queue Component

**Files:**
- Create: `src/components/dashboard/PriorityQueue.tsx`

- [ ] **Step 1: Implement component**

```tsx
import React from "react";
import { AlertTriangle, ArrowRight, Clock, FileText } from "lucide-react";
import { DashboardTask } from "../../dashboardMetrics";

interface PriorityQueueProps {
  tasks: DashboardTask[];
  onNavigate: (tab: DashboardTask["targetTab"]) => void;
}

export default function PriorityQueue({ tasks, onNavigate }: PriorityQueueProps) {
  if (tasks.length === 0) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-6 executive-shadow" data-testid="priority-queue">
        <p className="text-sm font-bold text-slate-900">Không có việc khẩn cần xử lý</p>
        <p className="text-xs text-slate-500 mt-1">Các hồ sơ mua hàng hiện chưa có cảnh báo ưu tiên.</p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl executive-shadow overflow-hidden" data-testid="priority-queue">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-extrabold text-slate-900">Việc cần xử lý</h2>
        <p className="text-xs text-slate-500 mt-1">Xếp theo rủi ro, hạn xử lý và giá trị hồ sơ.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {tasks.slice(0, 8).map((task) => (
          <article key={task.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={task.severity === "high" ? "text-rose-600" : task.severity === "medium" ? "text-amber-600" : "text-slate-500"}>
                {task.kind.includes("risk") || task.kind.includes("overdue") ? <AlertTriangle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{task.title}</p>
                <p className="text-xs text-slate-500 mt-1">{task.reason}</p>
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {task.dueLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(task.targetTab)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-black"
            >
              Xử lý
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run lint
```

Expected: PASS.

### Task 4.2: Create Operator Dashboard

**Files:**
- Create: `src/components/dashboard/OperatorDashboard.tsx`

- [ ] **Step 1: Implement component**

```tsx
import React from "react";
import { AlertTriangle, FileCheck, Send, ShieldAlert } from "lucide-react";
import { DashboardMetrics } from "../../dashboardMetrics";
import PriorityQueue from "./PriorityQueue";

interface OperatorDashboardProps {
  metrics: DashboardMetrics;
  onNavigate: (tab: "cases" | "pr" | "rfq" | "suppliers") => void;
}

export default function OperatorDashboard({ metrics, onNavigate }: OperatorDashboardProps) {
  const cards = [
    { label: "Việc cần xử lý", value: metrics.operator.actionCount, icon: FileCheck },
    { label: "RFQ đang chờ", value: metrics.operator.pendingRfqCount, icon: Send },
    { label: "Báo giá cần review", value: metrics.operator.quoteReviewCount, icon: ShieldAlert },
    { label: "Case quá hạn", value: metrics.operator.overdueCaseCount, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5 animate-fade-slide-up" data-testid="operator-dashboard">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-4 executive-shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{card.label}</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-2">{card.value}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-700">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <PriorityQueue tasks={metrics.operator.priorityQueue} onNavigate={onNavigate} />
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run lint
```

Expected: PASS.

### Task 4.3: Render Operator Dashboard In Overview

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import metrics and dashboard**

Add:

```ts
import { buildDashboardMetrics } from "./dashboardMetrics";
import OperatorDashboard from "./components/dashboard/OperatorDashboard";
```

- [ ] **Step 2: Build metrics inside `AppContent`**

Add after state is available:

```ts
const dashboardMetrics = buildDashboardMetrics({
  purchaseRequests,
  rfqs,
  quotes,
  inventory,
  suppliers,
  cases: [],
});
```

If `/api/state` cases are already stored in component state, pass that real `cases` state. If no cases state exists in `AppContent`, add:

```ts
const [cases, setCases] = useState<ProcurementCase[]>([]);
```

Then set it in `syncStateFromServer`:

```ts
setCases(state.cases || []);
```

- [ ] **Step 3: Replace Overview render**

When `activeTab === "overview"` and `dashboardView === "operator"`, render:

```tsx
<OperatorDashboard
  metrics={dashboardMetrics}
  onNavigate={(tab) => setActiveTab(tab)}
/>
```

- [ ] **Step 4: Run e2e**

Run:

```powershell
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected: Operator dashboard assertion passes.

---

## Phase 5: Executive Dashboard

### Task 5.1: Create Executive Dashboard

**Files:**
- Create: `src/components/dashboard/ExecutiveDashboard.tsx`

- [ ] **Step 1: Implement component**

```tsx
import React from "react";
import { AlertTriangle, BarChart3, CircleDollarSign, Clock } from "lucide-react";
import { DashboardMetrics } from "../../dashboardMetrics";

interface ExecutiveDashboardProps {
  metrics: DashboardMetrics;
}

export default function ExecutiveDashboard({ metrics }: ExecutiveDashboardProps) {
  const formatVnd = (value: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-5 animate-fade-slide-up" data-testid="executive-dashboard">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Chi tiêu đã duyệt" value={formatVnd(metrics.executive.approvedSpend)} icon={CircleDollarSign} />
        <MetricCard label="Sức khỏe SLA" value={`${metrics.executive.overdueCaseCount} quá hạn`} icon={Clock} />
        <MetricCard label="Rủi ro cần chú ý" value={String(metrics.executive.riskCount)} icon={AlertTriangle} />
        <MetricCard label="Pipeline" value={`${metrics.executive.pipeline.reduce((sum, item) => sum + item.count, 0)} hồ sơ`} icon={BarChart3} />
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 executive-shadow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Tổng quan pipeline</h2>
            <p className="text-xs text-slate-500 mt-1">Số hồ sơ mua hàng theo từng giai đoạn.</p>
          </div>
        </div>
        <div className="space-y-3 mt-5">
          {metrics.executive.pipeline.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">{item.label}</span>
                <span className="font-mono text-slate-500">{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, item.count * 16)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 executive-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{value}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-700">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run lint
```

Expected: PASS.

### Task 5.2: Wire Executive View

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import Executive Dashboard**

Add:

```ts
import ExecutiveDashboard from "./components/dashboard/ExecutiveDashboard";
```

- [ ] **Step 2: Render based on `dashboardView`**

In Overview:

```tsx
{dashboardView === "executive" ? (
  <ExecutiveDashboard metrics={dashboardMetrics} />
) : (
  <OperatorDashboard metrics={dashboardMetrics} onNavigate={(tab) => setActiveTab(tab)} />
)}
```

- [ ] **Step 3: Run e2e**

Run:

```powershell
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected: Operator and Executive dashboard assertions pass.

---

## Phase 6: Copy, Consistency, And Legacy Test Updates

### Task 6.1: Update Or Retire Old Role E2E

**Files:**
- Modify: `e2e/roles.spec.ts`

- [ ] **Step 1: Replace role journey assertions**

The current file asserts four demo roles. Replace it with a smaller smoke test:

```ts
import { expect, test } from "@playwright/test";

test.describe("Stally shared procurement workspace", () => {
  test("loads login and enters the shared workspace", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#btn-login")).toBeVisible();
    await page.click("#btn-login");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("#btn-tab-overview")).toBeVisible();
    await expect(page.locator("#btn-tab-cases")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run e2e smoke**

Run:

```powershell
npx playwright test e2e/roles.spec.ts --project=chromium
```

Expected: PASS.

### Task 6.2: Remove Dashboard Noise From `StatsDashboard` Path

**Files:**
- Modify: `src/App.tsx`
- Optional cleanup: `src/components/StatsDashboard.tsx`

- [ ] **Step 1: Ensure `StatsDashboard` is no longer imported by `App.tsx`**

Remove:

```ts
import StatsDashboard from "./components/StatsDashboard";
```

- [ ] **Step 2: Do not delete `StatsDashboard.tsx` yet**

Leave the file in place unless the user explicitly asks for cleanup.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run lint
```

Expected: PASS.

### Task 6.3: Copy Cleanup Pass For Main Procurement Flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/PurchaseRequestsList.tsx`
- Modify: `src/components/RfqComparison.tsx`
- Modify: `src/components/SupplierManagement.tsx`
- Modify only if still rendered: `src/components/ProcurementDashboard.tsx`

- [ ] **Step 1: Search for noisy or mixed-language copy**

Run:

```powershell
rg -n "CFO|COO|Audit workspace|Procurement Control Room|Supplier moat|Control Room|lux|retro|AI Agent|Dùng Trợ lý AI|Chức năng cấp phép|Đặc Quyền Vai Trò|Bếp|Thủ Kho|Giám Đốc|Horeca|workflow|audit trail|human review|red-flag" src\App.tsx src\components
```

Expected: The command may return matches. Review only text in visible main-flow components. Do not edit hidden legacy components unless they are still rendered in the new flow.

- [ ] **Step 2: Replace visible noisy copy with concise Vietnamese labels**

Use these replacements where visible:

```text
Procurement Control Room -> Dashboard
Audit workspace: org-1 -> Workspace: org-1
CFO/COO nhìn spend, risk và audit trail trong 30 giây -> Tổng quan mua hàng
Supplier moat -> Nhà cung cấp
Catalog Horeca & Nhà cung cấp đã kiểm chứng -> Danh sách nhà cung cấp
RFQ Compare & Human Review -> So sánh báo giá
AI confidence phải qua human review -> Cần kiểm tra thủ công khi AI thiếu chắc chắn
Chức năng cấp phép -> remove from visible sidebar
Đặc Quyền Vai Trò -> remove from visible login
Dùng Trợ lý AI -> remove as dashboard primary CTA
```

Keep these terms because they are useful business abbreviations:

```text
PR
RFQ
PO
NCC
SLA
```

- [ ] **Step 3: Keep explanations short**

Main dashboard and header rules:

```text
Title: maximum 5 words.
Subtitle: maximum 1 sentence.
Card helper text: maximum 12 words.
CTA text: verb + object, for example "Tạo PR", "Xem RFQ", "Thêm NCC".
```

- [ ] **Step 4: Run copy scan again**

Run:

```powershell
rg -n "CFO|COO|Supplier moat|Control Room|Đặc Quyền Vai Trò|Chức năng cấp phép|Dùng Trợ lý AI" src\App.tsx src\components
```

Expected: No matches in files rendered by the main flow. Matches inside non-rendered legacy components are acceptable only if the final report lists them.

- [ ] **Step 5: Run verification**

Run:

```powershell
npm run lint
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected: PASS.

---

## Phase 7: Final Verification

### Task 7.1: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Typecheck**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Production build**

Run:

```powershell
npm run build
```

Expected: PASS. Existing Vite chunk-size warning is acceptable.

- [ ] **Step 3: Dashboard e2e**

Run:

```powershell
npx playwright test e2e/dashboard-redesign.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 4: Existing UI refresh e2e**

Run:

```powershell
npx playwright test e2e/ui-refresh.spec.ts --project=chromium
```

Expected: PASS or update the test if selectors intentionally changed.

- [ ] **Step 5: Browser smoke**

Use Playwright or Chrome at:

- Desktop: `1440x1000`
- Mobile: `390x844`

Acceptance:

- No Vite overlay.
- Header controls do not overlap.
- Sidebar/bottom nav shows only the intended modules.
- Operator queue is readable.
- Executive view is readable.
- Login is not a role picker.
