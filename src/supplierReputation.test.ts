import { describe, expect, it } from "vitest";
import { applySupplierReputation, calculateSupplierReputation } from "./supplierReputation";

describe("supplier reputation scoring", () => {
  it("scores complete CRM suppliers higher with explainable criteria", () => {
    const result = calculateSupplierReputation({
      name: "Fresh Food Vietnam",
      contactPerson: "Ms Lan",
      email: "sales@freshfood.vn",
      phone: "0901234567",
      address: "Quan 7, TP.HCM",
      tags: ["rau cu", "thuc pham tuoi", "giao hang lanh", "nha hang"],
      historicalPricing: "Da co 3 bao gia RFQ va 2 PO, giao hang dung hen, co chiet khau theo hop dong.",
      source: "crm",
    });

    expect(result.level).toBe("high");
    expect(result.rating).toBeGreaterThanOrEqual(4.5);
    expect(result.criteria).toHaveLength(5);
    expect(result.riskFlags).toHaveLength(0);
  });

  it("flags incomplete crawled suppliers as risky", () => {
    const supplier = applySupplierReputation({
      name: "Unknown Crawled Supplier",
      email: "vendor@gmail.com",
      phone: "",
      address: "",
      tags: [],
      historicalPricing: "Nguon crawler AI, can procurement kiem tra truoc khi gui RFQ.",
      source: "crawled",
    });

    expect(supplier.reputationLevel).toBe("low");
    expect(supplier.rating).toBeLessThan(3.5);
    expect(supplier.reputationRiskFlags).toContain("Thiếu số điện thoại");
    expect(supplier.reputationRiskFlags).toContain("NCC mới từ discovery/crawl");
  });
});
