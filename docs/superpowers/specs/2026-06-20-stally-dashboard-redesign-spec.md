# Stally Dashboard Redesign Spec

## Product Intent

Stally should feel like a procurement workspace for SME teams, not a proof-of-concept role demo. The current app already has useful procurement flows, but the dashboard mixes executive slogans, hard-coded charts, role-specific demo views, long explanatory copy, and operational actions. The redesign should make the first screen focused, practical, and consistent.

The primary user for the main dashboard is a procurement lead or buyer operator who opens the app to see what needs attention today. Executive visibility remains important, but it should be a separate view inside the same workspace, not mixed into the operator dashboard.

## Decisions Locked

- Use one shared procurement workspace instead of the current login role selector.
- Keep legacy role components in the codebase for now, but do not render them in the main flow.
- Keep backend, database schema, and API unchanged in v1.
- Derive dashboard metrics from the existing `/api/state` payload.
- Default language is Vietnamese, with an English toggle in the header.
- Main navigation contains five modules: Dashboard, Cases, PR, RFQ, Suppliers.
- Dashboard has two views:
  - Operator: action center, priority queue, no decorative charts.
  - Executive: compact spend, SLA, risk, and pipeline visibility using real data only.
- AI should be visible inside workflow steps, not as the primary dashboard CTA.

## Business Terminology

Use Vietnamese-first labels with abbreviations only where helpful:

- Hồ sơ mua hàng (Case): one end-to-end procurement case.
- Yêu cầu mua (PR): internal request for items/services.
- Chào giá (RFQ): request sent to suppliers for quotations.
- Đơn mua (PO): purchase order after quote approval.
- Nhà cung cấp (NCC): supplier/vendor.
- SLA: internal handling deadline, not a legal contract.
- Risk: anything needing human review, such as low AI confidence, invalid quote amount, overdue case, or missing supplier information.

## Dashboard Behavior

### Operator View

Operator view is the default dashboard. It should answer: "What should I handle next?"

Required sections:

- KPI strip with four concise cards:
  - Việc cần xử lý
  - RFQ đang chờ
  - Báo giá cần review
  - Case quá hạn
- Priority Queue:
  - Sorted by Risk, then Deadline, then Value.
  - Each item shows type, title, reason, due indicator, and one clear CTA.
- Supporting cards:
  - RFQ chờ phản hồi
  - Báo giá rủi ro
  - Supplier cần bổ sung/thẩm định

Remove from the operator dashboard:

- Hard-coded SVG trend chart.
- Hard-coded budget category bars.
- Long "CFO/COO" slogan copy.
- Large process flow explanation.
- Long security/isolation statement.
- Floating AI as primary action.

### Executive View

Executive view is selected with a segmented control in the header. It should answer: "Is procurement healthy?"

Required sections:

- Approved spend: sum selected quotes with `totalAmount > 0`.
- SLA health: overdue and near-due cases based on default SLA rules.
- Risk exposure: low confidence quotes, invalid quote totals, missing payment terms, supplier records missing important fields.
- Pipeline summary: case count grouped by procurement stage.

Charts are allowed only when based on real data. If data is too sparse, show a concise empty state instead of a fake chart.

## SLA Defaults

Use these frontend-derived defaults:

- PR intake: 24 hours.
- Send RFQ after sourcing starts: 24 hours.
- Wait for supplier quotes: 3 days.
- Quote review: 24 hours.
- PO approval: 24 hours.

## Header Requirements

Header should become the main workbar:

- Global search input.
- Quick actions:
  - Tạo PR
  - Tạo RFQ
  - Thêm NCC
- Dashboard view switch:
  - Vận hành
  - Quản trị
- Language toggle:
  - VI
  - EN
- Notification icon with a static local popover.
- Settings icon with a static local popover.

Notification and settings do not need backend logic in v1.

## Login Requirements

The login screen should be a workspace login, not a role picker.

Required behavior:

- Show Stally brand and a concise value statement.
- Keep email-based login if enabled by current auth config.
- Keep Google login button if enabled by current auth config.
- Provide a simple "Vào workspace" demo path when role auth is not enabled.
- Do not ask whether the user wants tutorial mode.
- Do not show role selector cards.

## Out Of Scope

- Backend metrics endpoint.
- Database migrations.
- Full permission system redesign.
- Full app-wide i18n for every legacy component.
- Deleting legacy role components.
- Real notification/settings backend.
- Inventory as a main navigation module.

## Acceptance Criteria

- User can enter workspace without selecting a demo role.
- Header has useful actions and is not visually empty.
- Sidebar has only Dashboard, Cases, PR, RFQ, Suppliers.
- Dashboard defaults to Operator view with a real priority queue.
- Executive view uses only real derived data or honest empty states.
- Vietnamese UI copy is consistent; English appears only when language toggle is set to EN.
- No hard-coded decorative charts remain on the dashboard.
- Existing procurement flows still work: PR list, Cases, RFQ compare, Supplier catalog.
