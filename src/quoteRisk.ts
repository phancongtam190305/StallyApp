import { Quote } from "./types";

export const QUOTE_REVIEW_CONFIDENCE_THRESHOLD = 65;

export function getQuoteRiskFlags(quote: Quote): string[] {
  const flags: string[] = [];
  const paymentTerms = quote.paymentTerms?.trim().toLowerCase() || "";

  if (quote.aiConfidenceScore < QUOTE_REVIEW_CONFIDENCE_THRESHOLD) {
    flags.push(`Độ tin cậy ${quote.aiConfidenceScore}/100 dưới ngưỡng ${QUOTE_REVIEW_CONFIDENCE_THRESHOLD}`);
  }

  if (!Number.isFinite(quote.totalAmount) || quote.totalAmount <= 0) {
    flags.push("Tổng tiền không hợp lệ hoặc bằng 0");
  } else if (quote.totalAmount < 1000) {
    flags.push("Tổng tiền quá nhỏ, có thể AI nhầm điểm số hoặc phần trăm thành giá");
  }

  if (paymentTerms === "" || paymentTerms.includes("không đề cập")) {
    flags.push("Thiếu điều khoản thanh toán rõ ràng");
  }

  if (quote.items.some(item => item.unitPrice <= 0 || item.totalPrice <= 0)) {
    flags.push("Có dòng hàng thiếu đơn giá hoặc thành tiền");
  }

  return flags;
}

export function quoteNeedsHumanReview(quote: Quote): boolean {
  return getQuoteRiskFlags(quote).length > 0;
}

