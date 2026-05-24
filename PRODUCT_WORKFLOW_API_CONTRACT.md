# Stally Procurement SaaS - Workflow, User Flow, And API Contract

## 1. Product Direction

Stally is a SaaS platform for AI-assisted procurement and inventory operations.

The core use case is:

1. A department such as Kitchen sends a purchase need by Gmail, web form, chatbot, or inventory alert.
2. Procurement reviews and standardizes the request.
3. The system suggests suitable suppliers.
4. AI drafts RFQ emails.
5. A user reviews and approves the draft.
6. The system sends RFQ emails to suppliers through Gmail.
7. Supplier replies are collected from Gmail.
8. Attachments such as PDF, Word, Excel, images, or email text are parsed.
9. AI extracts quote data.
10. Procurement compares quotes, negotiates if needed, and submits for approval.
11. Manager approves one supplier or requests changes.
12. The system drafts and sends the official PO email.
13. Warehouse receives goods and updates inventory.
14. The procurement case is closed.

The product should be organized around a central `ProcurementCase`, not around isolated tabs such as PR, RFQ, Quote, or Inventory.

## 2. Core Object

### ProcurementCase

`ProcurementCase` is the lifecycle container for one purchase workflow.

```ts
interface ProcurementCase {
  id: string;
  organizationId: string;
  title: string;
  status: CaseStatus;
  priority: "low" | "medium" | "high" | "urgent";
  createdFrom: "web" | "gmail" | "chatbot" | "inventory_alert";
  requesterId?: string;
  requesterDepartmentId?: string;
  assignedBuyerId?: string;
  requiredDate?: string;
  requestId?: string;
  currentRfqId?: string;
  selectedQuoteId?: string;
  purchaseOrderId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}
```

## 3. Case State Machine

Use a strict state machine. Avoid free-form statuses.

```ts
type CaseStatus =
  | "draft_request"
  | "request_submitted"
  | "request_validating"
  | "supplier_matching"
  | "rfq_draft"
  | "rfq_sent"
  | "collecting_quotes"
  | "quote_review"
  | "comparison_ready"
  | "negotiating"
  | "pending_approval"
  | "approved"
  | "po_draft"
  | "po_sent"
  | "receiving"
  | "closed"
  | "cancelled"
  | "exception";
```

Every transition should write an audit event:

```ts
interface CaseTransition {
  id: string;
  caseId: string;
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  actorId: string;
  actorRole: string;
  reason?: string;
  createdAt: string;
}
```

## 4. Main Workflow

### Workflow A - Request Intake

1. Request comes from Gmail, web form, chatbot, or inventory alert.
2. AI extracts or drafts structured request data.
3. System creates a `ProcurementCase` and `PurchaseRequest`.
4. Procurement reviews the request.
5. Procurement confirms the case and moves it to supplier matching.

### Workflow B - Supplier Matching

1. System suggests suppliers based on product category, tags, price history, response speed, rating, location, and risk.
2. Procurement selects suppliers.
3. Procurement may add suppliers manually.
4. Optional later feature: AI discovers new suppliers through crawling/search.

### Workflow C - RFQ Email

1. AI drafts RFQ email.
2. User reviews and edits the draft.
3. User approves sending.
4. System sends email through Gmail.
5. Case moves to `rfq_sent` or `collecting_quotes`.

### Workflow D - Supplier Response Tracking

1. Gmail receives supplier replies.
2. Backend links emails to the correct case using RFQ code, Gmail thread ID, and headers.
3. Supplier status updates: sent, replied, declined, overdue, negotiating, awarded, rejected.
4. Attachments are stored and sent to the document extraction pipeline.

### Workflow E - Quote Extraction

1. Email text and attachments are parsed asynchronously.
2. AI/OCR extracts quote line items, prices, tax, shipping, delivery days, and payment terms.
3. Low-confidence extraction goes to human review.
4. Procurement confirms or edits quote data.
5. Confirmed quotes become available in comparison.

### Workflow F - Comparison And Negotiation

1. Procurement opens comparison matrix.
2. System highlights cheapest, fastest, safest, and recommended quote.
3. Procurement can negotiate with one or multiple suppliers.
4. AI drafts negotiation email.
5. User approves and sends through Gmail.
6. New supplier replies create new quote versions.

### Workflow G - Approval

1. Procurement submits recommended quote for approval.
2. Manager reviews comparison, files, quote versions, and negotiation history.
3. Manager approves, rejects, or requests changes.
4. Approval decision is audit-logged.

### Workflow H - Purchase Order

1. After approval, system creates PO draft.
2. AI drafts official purchase email.
3. User reviews and sends through Gmail.
4. Inventory `quantityOnOrder` is updated.
5. Case moves to `po_sent`.

### Workflow I - Receiving And Inventory

1. Warehouse sees incoming PO.
2. Warehouse records received quantity, quality status, missing items, damage, or partial delivery.
3. Inventory balance is updated.
4. If all items are received, case closes.
5. If there is mismatch, case moves to `exception`.

## 5. User Flows

### User Flow 1 - Kitchen Sends Request By Gmail

1. Kitchen sends an email to Procurement.
2. Gmail integration receives the email.
3. AI classifies it as a purchase request.
4. AI extracts item names, quantities, units, required date, and notes.
5. System creates a draft case.
6. Procurement reviews and confirms.
7. Case moves to supplier matching.

### User Flow 2 - Requester Creates Request On Web

1. Requester logs in.
2. Requester opens Create Request.
3. Requester enters item list and required date.
4. System creates case.
5. Procurement receives it in Case Inbox.

### User Flow 3 - Requester Uses AI Chatbot

1. User asks AI to create a PR.
2. AI creates a draft only.
3. User confirms.
4. System creates the case.

### User Flow 4 - Procurement Sends RFQ

1. Procurement opens case detail.
2. Procurement reviews request.
3. Procurement runs supplier matching.
4. Procurement selects suppliers.
5. AI drafts RFQ email.
6. Procurement reviews and sends.
7. Supplier statuses appear on dashboard.

### User Flow 5 - Supplier Replies With Quote

1. Supplier replies to the Gmail thread.
2. Backend links reply to case and supplier.
3. Attachments are stored.
4. Quote extraction job starts.
5. Procurement reviews extracted quote.
6. Quote is confirmed and appears in comparison matrix.

### User Flow 6 - Procurement Negotiates

1. Procurement opens comparison.
2. Procurement chooses a supplier to negotiate.
3. AI drafts negotiation email.
4. Procurement approves and sends.
5. Supplier replies with updated quote.
6. System creates a new quote version.

### User Flow 7 - Manager Approves

1. Manager opens Approval Queue.
2. Manager reviews recommended supplier, quote, files, and comparison.
3. Manager approves, rejects, or requests changes.
4. Case moves forward or back to negotiation.

### User Flow 8 - Warehouse Receives Goods

1. Warehouse opens incoming PO.
2. Warehouse records actual received quantities.
3. System updates inventory.
4. If complete, case closes.
5. If mismatch, case moves to exception.

## 6. Roles And Permissions

Backend must enforce permissions by action, not only by frontend screen.

### Roles

```ts
type UserRole =
  | "requester"
  | "procurement"
  | "manager"
  | "warehouse"
  | "admin";
```

### Permissions

```txt
case:create
case:view
case:update
case:submit
supplier:view
supplier:manage
supplier:match
rfq:draft
rfq:send
email:view
email:send
quote:view
quote:review
quote:negotiate
approval:request
approval:decide
po:draft
po:send
inventory:view
inventory:receive
inventory:adjust
admin:manage_users
```

## 7. API Conventions

Base path:

```txt
/api/v1
```

Headers:

```txt
Authorization: Bearer <token>
X-Organization-Id: org_123
```

Error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required field",
    "details": {}
  }
}
```

Paginated response:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125
  }
}
```

## 8. Core API Contract

### Auth And User Context

```txt
GET /api/v1/me
GET /api/v1/permissions
```

### Cases

```txt
GET    /api/v1/cases
POST   /api/v1/cases
GET    /api/v1/cases/:caseId
PATCH  /api/v1/cases/:caseId
POST   /api/v1/cases/:caseId/submit
POST   /api/v1/cases/:caseId/cancel
GET    /api/v1/cases/:caseId/timeline
GET    /api/v1/cases/:caseId/audit-logs
```

Create case payload:

```json
{
  "title": "Mua nguyên liệu bếp cuối tuần",
  "createdFrom": "web",
  "priority": "high",
  "requiredDate": "2026-05-30",
  "departmentId": "dept_kitchen",
  "items": [
    {
      "name": "Gạo ST25",
      "quantity": 100,
      "unit": "kg",
      "notes": ""
    }
  ]
}
```

### Purchase Request Items

```txt
PATCH  /api/v1/cases/:caseId/request
POST   /api/v1/cases/:caseId/items
PATCH  /api/v1/cases/:caseId/items/:itemId
DELETE /api/v1/cases/:caseId/items/:itemId
```

### Supplier Matching

```txt
POST /api/v1/cases/:caseId/supplier-matches
POST /api/v1/cases/:caseId/suppliers/select
POST /api/v1/cases/:caseId/suppliers/discover
```

Supplier match response:

```json
{
  "data": [
    {
      "supplierId": "sup_1",
      "name": "NCC Gạo Vàng",
      "score": 92,
      "reasons": [
        "Khớp ngành hàng Gạo",
        "Giá lịch sử tốt",
        "Phản hồi nhanh"
      ],
      "riskFlags": []
    }
  ]
}
```

Select suppliers payload:

```json
{
  "supplierIds": ["sup_1", "sup_2"]
}
```

### RFQ Draft And Send

```txt
POST  /api/v1/cases/:caseId/rfq-draft
PATCH /api/v1/rfq-drafts/:draftId
POST  /api/v1/rfq-drafts/:draftId/approve
POST  /api/v1/cases/:caseId/rfq/send
```

RFQ draft payload:

```json
{
  "supplierIds": ["sup_1", "sup_2"],
  "language": "vi",
  "tone": "professional",
  "dueDate": "2026-05-27"
}
```

RFQ send payload:

```json
{
  "draftId": "draft_123",
  "supplierIds": ["sup_1", "sup_2"]
}
```

### Supplier RFQ Tracking

```txt
GET   /api/v1/cases/:caseId/supplier-status
PATCH /api/v1/cases/:caseId/suppliers/:supplierId/status
POST  /api/v1/cases/:caseId/suppliers/:supplierId/follow-up-draft
POST  /api/v1/cases/:caseId/suppliers/:supplierId/follow-up-send
```

Supplier RFQ status:

```ts
type SupplierRfqStatus =
  | "not_selected"
  | "selected"
  | "email_draft"
  | "sent"
  | "replied"
  | "declined"
  | "overdue"
  | "negotiating"
  | "awarded"
  | "rejected";
```

### Documents And Extraction

```txt
POST /api/v1/documents/:documentId/extract
GET  /api/v1/documents/:documentId
GET  /api/v1/documents/:documentId/extraction
POST /api/v1/documents/:documentId/retry-extraction
```

Document status:

```ts
type DocumentStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "extracted"
  | "review_required"
  | "failed";
```

### Quotes And Quote Versions

```txt
GET   /api/v1/cases/:caseId/quotes
GET   /api/v1/quotes/:quoteId
POST  /api/v1/cases/:caseId/quotes
PATCH /api/v1/quotes/:quoteId
POST  /api/v1/quotes/:quoteId/review
POST  /api/v1/quotes/:quoteId/select-version
GET   /api/v1/quotes/:quoteId/versions
POST  /api/v1/quotes/:quoteId/versions
```

Quote versions are required because negotiation can create multiple quote revisions from the same supplier.

### Comparison

```txt
GET /api/v1/cases/:caseId/comparison
```

Comparison response should be frontend-ready:

```json
{
  "caseId": "case_1",
  "items": [],
  "suppliers": [],
  "matrix": [],
  "summary": {
    "lowestTotalQuoteId": "quote_1",
    "fastestDeliveryQuoteId": "quote_2",
    "recommendedQuoteId": "quote_1",
    "recommendationReason": "Giá tốt nhất và NCC có lịch sử ổn định"
  }
}
```

### Negotiation

```txt
POST /api/v1/cases/:caseId/negotiations/:supplierId/draft
PATCH /api/v1/negotiation-drafts/:draftId
POST /api/v1/negotiation-drafts/:draftId/send
GET  /api/v1/cases/:caseId/negotiations
```

### Approval

```txt
POST /api/v1/cases/:caseId/approval/request
GET  /api/v1/approval-requests
GET  /api/v1/approval-requests/:approvalId
POST /api/v1/approval-requests/:approvalId/approve
POST /api/v1/approval-requests/:approvalId/reject
POST /api/v1/approval-requests/:approvalId/request-changes
```

Approve payload:

```json
{
  "selectedQuoteId": "quote_1",
  "selectedQuoteVersionId": "qv_3",
  "comment": "Chọn NCC này do tổng chi phí tốt nhất"
}
```

### Purchase Orders

```txt
POST /api/v1/cases/:caseId/po-draft
PATCH /api/v1/purchase-orders/:poId
POST /api/v1/purchase-orders/:poId/send
GET  /api/v1/purchase-orders
GET  /api/v1/purchase-orders/:poId
```

### Inventory And Receiving

```txt
GET   /api/v1/inventory/items
GET   /api/v1/inventory/items/:itemId
POST  /api/v1/inventory/items
PATCH /api/v1/inventory/items/:itemId
GET   /api/v1/inventory/low-stock
GET   /api/v1/inventory/movements
POST  /api/v1/purchase-orders/:poId/receive
POST  /api/v1/inventory/adjustments
```

Receive payload:

```json
{
  "receivedAt": "2026-05-30T10:00:00Z",
  "items": [
    {
      "poItemId": "po_item_1",
      "quantityReceived": 95,
      "qualityStatus": "accepted",
      "notes": "Thiếu 5kg"
    }
  ]
}
```

### Supplier CRM

```txt
GET    /api/v1/suppliers
POST   /api/v1/suppliers
GET    /api/v1/suppliers/:supplierId
PATCH  /api/v1/suppliers/:supplierId
DELETE /api/v1/suppliers/:supplierId
GET    /api/v1/suppliers/:supplierId/performance
GET    /api/v1/suppliers/:supplierId/price-history
GET    /api/v1/suppliers/:supplierId/cases
```

### AI Agent

```txt
POST /api/v1/ai/chat
POST /api/v1/ai/draft-pr
POST /api/v1/ai/draft-rfq-email
POST /api/v1/ai/draft-negotiation-email
POST /api/v1/ai/draft-po-email
POST /api/v1/ai/summarize-case
```

AI must only create drafts. It must not directly send RFQ, negotiation emails, or PO emails without user approval.

## 9. Gmail Integration Contract

Gmail should be part of the MVP because the procurement workflow depends on two-way email.

Gmail is a communication layer attached to `ProcurementCase`. It should not be the source of business state by itself.

### Gmail Account

```txt
GET  /api/v1/gmail/accounts
POST /api/v1/gmail/accounts/connect
POST /api/v1/gmail/accounts/:accountId/disconnect
POST /api/v1/gmail/accounts/:accountId/sync
GET  /api/v1/gmail/accounts/:accountId/status
```

### Gmail Watch And Sync

```txt
POST /api/v1/gmail/watch
POST /api/v1/gmail/pubsub/webhook
POST /api/v1/gmail/history/sync
```

Internal normalized Gmail event:

```json
{
  "gmailAccountId": "gmail_acc_1",
  "emailAddress": "procurement@stally.com",
  "historyId": "9876543210",
  "messageId": "18f...",
  "threadId": "18f...",
  "eventType": "message_added"
}
```

### Email Message APIs

```txt
GET  /api/v1/cases/:caseId/emails
GET  /api/v1/emails/:emailId
GET  /api/v1/emails/unlinked
POST /api/v1/emails/:emailId/link-case
POST /api/v1/emails/:emailId/unlink-case
POST /api/v1/emails/:emailId/extract-request
POST /api/v1/emails/:emailId/extract-quote
```

### Email Entity

```ts
interface EmailMessage {
  id: string;
  organizationId: string;
  gmailAccountId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  internetMessageId?: string;
  inReplyTo?: string;
  references?: string[];
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet?: string;
  receivedAt?: string;
  sentAt?: string;
  linkedCaseId?: string;
  linkedSupplierId?: string;
  classification?:
    | "purchase_request"
    | "rfq"
    | "quote"
    | "negotiation"
    | "po"
    | "other";
  attachments: EmailAttachment[];
}
```

### Email Attachment

```ts
interface EmailAttachment {
  id: string;
  emailMessageId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  documentId?: string;
}
```

### Email Draft And Send

```txt
POST  /api/v1/cases/:caseId/email-drafts
PATCH /api/v1/email-drafts/:draftId
POST  /api/v1/email-drafts/:draftId/send
POST  /api/v1/email-drafts/:draftId/send-reply
```

Email draft payload:

```json
{
  "type": "rfq",
  "supplierIds": ["sup_1", "sup_2"],
  "subject": "[STALLY RFQ-2026-000123] Yêu cầu báo giá",
  "bodyHtml": "<p>...</p>",
  "attachments": []
}
```

Send response:

```json
{
  "sent": [
    {
      "supplierId": "sup_1",
      "emailMessageId": "email_123",
      "gmailMessageId": "18f...",
      "gmailThreadId": "18f..."
    }
  ]
}
```

### Gmail Thread Linking Rules

Backend should link inbound email to case by priority:

1. Exact RFQ or case code in subject/body, for example `[STALLY RFQ-2026-000123]`.
2. Existing `gmailThreadId` saved when RFQ was sent.
3. `In-Reply-To` and `References` headers pointing to an outbound email.
4. Sender email matches a supplier in an open case.
5. AI classification as fallback only.

Do not rely only on AI to determine which case an email belongs to.

### Recommended Gmail Labels

```txt
STALLY/Inbox
STALLY/RFQ-Sent
STALLY/Quote-Received
STALLY/Negotiation
STALLY/PO-Sent
STALLY/Processed
STALLY/Needs-Review
```

Label APIs:

```txt
POST /api/v1/gmail/labels/bootstrap
POST /api/v1/emails/:emailId/mark-processed
POST /api/v1/emails/:emailId/mark-needs-review
```

### Gmail MVP Scope

MVP should include:

1. Connect one procurement Gmail mailbox.
2. Send RFQ emails from a case.
3. Receive supplier replies through Gmail.
4. Link replies to case by RFQ code, thread ID, and headers.
5. Store attachments.
6. Trigger quote extraction jobs.
7. Show full email thread inside case detail.
8. Draft and send negotiation emails.
9. Draft and send PO emails.

Avoid these in the first MVP unless required:

1. Multi-mailbox routing.
2. Email open tracking.
3. Complex campaign analytics.
4. Automatic supplier crawler.
5. Fully autonomous AI sending.

## 10. Realtime Events

Frontend should subscribe to backend events for Gmail replies, quote extraction, approvals, and inventory receiving.

```txt
GET /api/v1/events/stream
```

Event shape:

```json
{
  "type": "quote.extracted",
  "caseId": "case_1",
  "payload": {
    "quoteId": "quote_1",
    "supplierId": "sup_1"
  },
  "createdAt": "2026-05-24T10:00:00Z"
}
```

Recommended event types:

```txt
case.updated
gmail.connected
email.received
email.linked_to_case
email.needs_review
rfq.email_sent
supplier.replied
quote.attachment_received
quote.extraction_started
quote.review_required
quote.extracted
quote.confirmed
negotiation.email_sent
approval.requested
approval.approved
approval.rejected
po.email_sent
inventory.received
```

## 11. Data Model Checklist

Backend should plan for these tables or collections:

```txt
organizations
users
departments
procurement_cases
case_transitions
purchase_requests
purchase_request_items
suppliers
supplier_contacts
supplier_categories
supplier_price_history
case_suppliers
rfqs
rfq_email_drafts
email_accounts
email_messages
email_attachments
documents
document_extractions
quotes
quote_versions
quote_items
negotiations
approval_requests
approval_decisions
purchase_orders
purchase_order_items
inventory_items
inventory_movements
receiving_records
audit_logs
notifications
```

## 12. Important Backend Considerations

### Async Pipeline

Parsing emails, OCR, document extraction, and AI quote extraction should run in background jobs.

Recommended statuses:

```txt
email_received
attachment_saved
document_parse_queued
ocr_or_parser_running
ai_extraction_running
review_required
extracted
quote_confirmed
failed
```

### Quote Versioning

Negotiation creates new quote versions. Do not overwrite the old quote.

```txt
Quote
QuoteVersion
QuoteItem
NegotiationMessage
```

### Approval Audit

Approval must record:

1. Who approved.
2. When they approved.
3. Which quote and quote version were approved.
4. Total amount at approval time.
5. Attached evidence.
6. Comment or rejection reason.

### Inventory

For F&B inventory, consider these fields early:

```txt
quantityAvailable
quantityReserved
quantityOnOrder
quantityIncoming
quantityDamaged
quantityReturned
batchNumber
expiryDate
storageLocation
unitConversion
qualityStatus
```

## 13. Frontend Screens Recommended

1. Case Inbox
2. Case Detail with lifecycle timeline
3. Create Request
4. Supplier Matching
5. RFQ Composer
6. Supplier Response Dashboard
7. Email Thread View
8. Quote Review
9. Comparison Matrix
10. Negotiation Workspace
11. Approval Queue
12. PO Draft And Send
13. Receiving
14. Inventory
15. Supplier CRM
16. AI Agent Chatbot

## 14. MVP Backend Priority

Build these first:

1. `ProcurementCase` and state machine.
2. Case APIs.
3. Supplier APIs.
4. RFQ draft/send APIs.
5. Gmail connect/send/receive/thread linking.
6. Email message storage.
7. Quote extraction job interface.
8. Quote review and comparison APIs.
9. Approval APIs.
10. PO send and inventory receiving APIs.
11. Realtime events.

## 15. Open Questions To Confirm

1. MVP uses one shared procurement Gmail mailbox or one Gmail account per buyer?
2. Approval has one level or multiple levels?
3. Can one case select multiple winning suppliers by item, or only one supplier for the whole case?
4. Should requesters see supplier quotes, or only procurement and manager?
5. Should rejected suppliers receive automatic rejection emails?
6. Is inventory required to support batch and expiry date in MVP?
7. Should AI supplier discovery be included in MVP or later?
8. Which document types must be supported first: PDF, Excel, Word, image, or email text?
9. Should supplier price history be manually entered first or derived from past quotes?
10. Should SaaS billing be included in this phase or deferred?
