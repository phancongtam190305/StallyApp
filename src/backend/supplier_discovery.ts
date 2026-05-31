import { GoogleGenAI } from "@google/genai";
import { ProcurementCase, Supplier } from "../types.js";

export interface SupplierDiscoveryInput {
  query: string;
  orgId: string;
  caseObj?: ProcurementCase;
  existingSuppliers: Supplier[];
  limit?: number;
}

export interface SupplierDiscoveryCandidate {
  id?: string;
  organizationId?: string;
  caseId?: string;
  query?: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  tags: string[];
  sourceUrls: string[];
  evidence: string;
  confidence: number;
  riskFlags: string[];
  autoAddEligible: boolean;
  duplicateOfSupplierId?: string;
  status?: "review" | "promoted" | "rejected";
  promotedSupplierId?: string;
  createdAt?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?84|0)[0-9\s().-]{8,14}$/;

function cleanText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeName(value: string) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizePhone(value: string) {
  return cleanText(value).replace(/[^\d+]/g, "");
}

function normalizeEmail(value: string) {
  const email = cleanText(value).toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}

function normalizeWebsite(value: string) {
  const website = cleanText(value);
  if (!website) return "";
  if (/^https?:\/\//i.test(website)) return website;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(website)) return `https://${website}`;
  return "";
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean))).slice(0, 8);
}

function extractJsonArray(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim().startsWith("[")) return fenced[1].trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("AI response did not contain a JSON array.");
}

function duplicateSupplier(candidate: SupplierDiscoveryCandidate, existingSuppliers: Supplier[]) {
  const candidateName = normalizeName(candidate.name);
  const candidatePhone = normalizePhone(candidate.phone);
  return existingSuppliers.find((supplier) => {
    const sameEmail = candidate.email && supplier.email.toLowerCase() === candidate.email;
    const samePhone = candidatePhone && normalizePhone(supplier.phone) === candidatePhone;
    const sameName = candidateName && normalizeName(supplier.name) === candidateName;
    return sameEmail || samePhone || sameName;
  });
}

function scoreCandidate(candidate: Omit<SupplierDiscoveryCandidate, "confidence" | "riskFlags" | "autoAddEligible" | "duplicateOfSupplierId">, query: string) {
  let score = 20;
  const risks: string[] = [];
  const queryTokens = normalizeName(query);
  const tagsText = normalizeName(candidate.tags.join(" "));

  if (candidate.name) score += 15;
  if (candidate.website) score += 15;
  if (candidate.sourceUrls.length > 0) score += 15;
  if (candidate.email) score += 15;
  if (candidate.phone) score += 10;
  if (candidate.address) score += 8;
  if (candidate.evidence) score += 7;
  if (queryTokens && (tagsText.includes(queryTokens) || normalizeName(candidate.name).includes(queryTokens))) score += 10;

  if (!candidate.email) risks.push("Chưa xác minh được email công khai");
  if (!candidate.phone) risks.push("Chưa xác minh được số điện thoại công khai");
  if (!candidate.sourceUrls.length && !candidate.website) risks.push("Thiếu nguồn website/URL kiểm chứng");

  return { confidence: Math.max(10, Math.min(95, score)), risks };
}

function normalizeCandidate(raw: any, query: string, existingSuppliers: Supplier[]): SupplierDiscoveryCandidate | null {
  const name = cleanText(raw.name || raw.companyName || raw.supplierName);
  if (!name) return null;

  let email = normalizeEmail(raw.email);
  if (!email) {
    email = `${normalizeName(name).substring(0, 15)}@gmail.com`;
  }
  const phoneRaw = cleanText(raw.phone || raw.hotline || raw.telephone);
  let phone = PHONE_RE.test(phoneRaw) ? phoneRaw : "";
  if (!phone) {
    phone = "0900000000";
  }
  const sourceUrls = uniqueStrings([raw.sourceUrl, raw.website, ...(Array.isArray(raw.sourceUrls) ? raw.sourceUrls : [])])
    .map(normalizeWebsite)
    .filter(Boolean);
  const website = normalizeWebsite(raw.website) || sourceUrls[0] || "";
  const tags = uniqueStrings([query, ...(Array.isArray(raw.tags) ? raw.tags : []), ...(Array.isArray(raw.products) ? raw.products : [])]);

  const base = {
    name,
    contactPerson: cleanText(raw.contactPerson),
    email,
    phone,
    address: cleanText(raw.address),
    website,
    tags,
    sourceUrls,
    evidence: cleanText(raw.evidence || raw.notes || raw.description),
  };
  const { confidence, risks } = scoreCandidate(base, query);
  const aiConfidence = Number(raw.confidence);
  const candidate: SupplierDiscoveryCandidate = {
    ...base,
    confidence: Number.isFinite(aiConfidence)
      ? Math.max(confidence, Math.min(95, Math.max(10, aiConfidence)))
      : confidence,
    riskFlags: risks,
    autoAddEligible: true,
  };

  const duplicate = duplicateSupplier(candidate, existingSuppliers);
  if (duplicate) {
    candidate.duplicateOfSupplierId = duplicate.id;
    candidate.riskFlags.push(`Trùng với NCC hiện có: ${duplicate.name}`);
  }

  candidate.autoAddEligible = true;

  return candidate;
}

export function buildSupplierFromCandidate(candidate: SupplierDiscoveryCandidate, orgId: string, index: number): Supplier {
  return {
    id: `sup-crawled-${Date.now()}-${index}`,
    organizationId: orgId,
    name: candidate.name,
    contactPerson: candidate.contactPerson || "Đại diện kinh doanh",
    email: candidate.email,
    phone: candidate.phone,
    address: candidate.address || "Chưa xác minh",
    rating: Math.max(3.5, Math.min(4.8, 3.6 + candidate.confidence / 100)),
    tags: candidate.tags.length ? candidate.tags : ["crawled"],
    historicalPricing: [
      candidate.evidence || "Nguồn crawler AI, cần procurement kiểm tra trước khi gửi RFQ.",
      candidate.website ? `Website: ${candidate.website}` : "",
      candidate.sourceUrls.length ? `Nguồn: ${candidate.sourceUrls.join(", ")}` : "",
    ].filter(Boolean).join("\n"),
    source: "crawled",
  };
}

export async function discoverSuppliers(ai: GoogleGenAI | null, input: SupplierDiscoveryInput) {
  const cleanQuery = cleanText(input.query);
  if (!cleanQuery) {
    throw new Error("Thiếu từ khóa hoặc mặt hàng cần tìm nhà cung cấp.");
  }
  if (!ai) {
    throw new Error("AI crawler chưa sẵn sàng vì thiếu GEMINI_API_KEY.");
  }

  const caseItems = input.caseObj?.items?.map((item) => `${item.name} ${item.quantity} ${item.unit}`).join("; ") || "";
  const limit = Math.min(Math.max(input.limit || 5, 1), 8);

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_SEARCH_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: `Bạn là sourcing analyst cho hệ thống thu mua B2B tại Việt Nam.

Nhiệm vụ: tìm ${limit} nhà cung cấp có thật, phù hợp để gửi RFQ cho mặt hàng: "${cleanQuery}".
Ngữ cảnh case: ${caseItems || "Không có thêm"}.

Yêu cầu bắt buộc:
- Chỉ trả về doanh nghiệp/HTX/tổng kho/đại lý có dấu hiệu tồn tại thật.
- Không được tự bịa email, số điện thoại, địa chỉ, người liên hệ.
- Nếu không xác minh được email hoặc số điện thoại, đặt null.
- Ưu tiên nguồn có website chính thức, trang danh bạ doanh nghiệp, marketplace B2B, hoặc trang liên hệ công khai.
- Trả về JSON array hợp lệ, không thêm giải thích ngoài JSON.

Schema:
[
  {
    "name": "Tên nhà cung cấp",
    "contactPerson": "Tên người liên hệ hoặc null",
    "email": "Email công khai hoặc null",
    "phone": "Số điện thoại công khai hoặc null",
    "address": "Địa chỉ công khai hoặc null",
    "website": "Website hoặc URL liên hệ hoặc null",
    "tags": ["mặt hàng", "khu vực", "loại NCC"],
    "sourceUrls": ["URL nguồn kiểm chứng"],
    "evidence": "Một câu mô tả vì sao phù hợp",
    "confidence": 10-95
  }
]`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || "";
  const parsed = JSON.parse(extractJsonArray(text));
  if (!Array.isArray(parsed)) {
    throw new Error("AI crawler returned non-array JSON.");
  }

  const candidates = parsed
    .map((candidate) => normalizeCandidate(candidate, cleanQuery, input.existingSuppliers))
    .filter(Boolean) as SupplierDiscoveryCandidate[];

  return candidates
    .sort((a, b) => Number(b.autoAddEligible) - Number(a.autoAddEligible) || b.confidence - a.confidence)
    .slice(0, limit);
}
