import type { Supplier } from "./types";

export type SupplierReputationCriterionKey =
  | "verifiedContact"
  | "profileDepth"
  | "categoryFit"
  | "commercialHistory"
  | "sourceReliability";

export interface SupplierReputationCriterion {
  key: SupplierReputationCriterionKey;
  label: string;
  score: number;
  maxScore: number;
  note: string;
}

export interface SupplierReputationResult {
  reputationScore: number;
  rating: number;
  level: "high" | "medium" | "low";
  criteria: SupplierReputationCriterion[];
  riskFlags: string[];
}

const sourceBaseScore: Record<string, number> = {
  crm: 15,
  manual: 13,
  discovered: 9,
  crawled: 8,
};

function hasBusinessEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  return !/(gmail|yahoo|hotmail|outlook)\./.test(normalized.split("@")[1] || "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateSupplierReputation(supplier: Partial<Supplier>): SupplierReputationResult {
  const tags = Array.isArray(supplier.tags) ? supplier.tags.filter(Boolean) : [];
  const historicalPricing = String(supplier.historicalPricing || "").trim();
  const source = String(supplier.source || "crm");
  const riskFlags: string[] = [];

  let verifiedContact = 0;
  if (supplier.email) verifiedContact += hasBusinessEmail(supplier.email) ? 10 : 7;
  if (supplier.phone) verifiedContact += 8;
  if (supplier.contactPerson) verifiedContact += 4;
  if (supplier.address) verifiedContact += 3;
  if (!supplier.email) riskFlags.push("Thiếu email liên hệ");
  if (!supplier.phone) riskFlags.push("Thiếu số điện thoại");
  if (supplier.email && !hasBusinessEmail(supplier.email)) riskFlags.push("Email chưa phải domain doanh nghiệp");

  let profileDepth = 0;
  if (supplier.name) profileDepth += 5;
  if (supplier.address) profileDepth += 4;
  if (supplier.contactPerson) profileDepth += 3;
  if (tags.length > 0) profileDepth += 3;
  if (!supplier.address) riskFlags.push("Thiếu địa chỉ/hồ sơ pháp lý");

  const categoryFit = clamp(tags.length * 4, 0, 15);
  if (tags.length === 0) riskFlags.push("Chưa phân loại ngành hàng cung cấp");

  let commercialHistory = 0;
  if (historicalPricing.length >= 140) commercialHistory = 20;
  else if (historicalPricing.length >= 60) commercialHistory = 15;
  else if (historicalPricing.length > 0) commercialHistory = 9;
  if (/po|đơn hàng|báo giá|quote|rfq|hợp đồng|contract|chiết khấu|delivery|giao hàng/i.test(historicalPricing)) {
    commercialHistory = Math.min(20, commercialHistory + 3);
  }
  if (!historicalPricing) riskFlags.push("Chưa có lịch sử báo giá/giao dịch");

  let sourceReliability = sourceBaseScore[source] ?? 10;
  if (/chưa xác minh|cần.*kiểm tra|crawler|crawl/i.test(historicalPricing)) {
    sourceReliability = Math.max(4, sourceReliability - 4);
    riskFlags.push("Nguồn NCC cần xác minh thủ công");
  }
  if (source === "crawled" || source === "discovered") {
    riskFlags.push("NCC mới từ discovery/crawl");
  }

  const criteria: SupplierReputationCriterion[] = [
    {
      key: "verifiedContact",
      label: "Xác thực liên hệ",
      score: verifiedContact,
      maxScore: 25,
      note: "Email, số điện thoại, người liên hệ và địa chỉ",
    },
    {
      key: "profileDepth",
      label: "Độ đầy đủ hồ sơ",
      score: profileDepth,
      maxScore: 15,
      note: "Tên, địa chỉ, đại diện và thông tin phân loại",
    },
    {
      key: "categoryFit",
      label: "Năng lực/ngành hàng",
      score: categoryFit,
      maxScore: 15,
      note: "Số lượng tag ngành hàng có thể dùng để matching",
    },
    {
      key: "commercialHistory",
      label: "Lịch sử giá/giao dịch",
      score: commercialHistory,
      maxScore: 20,
      note: "Ghi chú báo giá, hợp đồng, PO hoặc lịch sử mua",
    },
    {
      key: "sourceReliability",
      label: "Độ tin cậy nguồn",
      score: sourceReliability,
      maxScore: 15,
      note: "CRM/manual cao hơn nguồn mới crawl/discovery",
    },
  ];

  const rawScore = criteria.reduce((sum, criterion) => sum + criterion.score, 0);
  const reputationScore = clamp(Math.round(rawScore), 0, 90);
  const rating = roundOne(clamp(1 + (reputationScore / 90) * 4, 1, 5));
  const level = reputationScore >= 72 ? "high" : reputationScore >= 50 ? "medium" : "low";

  return {
    reputationScore,
    rating,
    level,
    criteria,
    riskFlags: Array.from(new Set(riskFlags)).slice(0, 6),
  };
}

export function applySupplierReputation<T extends Partial<Supplier>>(supplier: T): T & {
  rating: number;
  reputationScore: number;
  reputationLevel: SupplierReputationResult["level"];
  reputationCriteria: SupplierReputationCriterion[];
  reputationRiskFlags: string[];
} {
  const reputation = calculateSupplierReputation(supplier);
  return {
    ...supplier,
    rating: reputation.rating,
    reputationScore: reputation.reputationScore,
    reputationLevel: reputation.level,
    reputationCriteria: reputation.criteria,
    reputationRiskFlags: reputation.riskFlags,
  };
}
