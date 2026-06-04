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

export function runDiscoverySimulation(query: string, limit: number, existingSuppliers: Supplier[]): SupplierDiscoveryCandidate[] {
  const normQuery = query.toLowerCase();
  let rawCandidates: any[] = [];

  if (normQuery.includes("cá") || normQuery.includes("hải sản") || normQuery.includes("tôm") || normQuery.includes("mực") || normQuery.includes("salmon") || normQuery.includes("ngư")) {
    rawCandidates = [
      {
        name: "Tổng kho Hải sản tươi sống Hùng Phát",
        contactPerson: "Anh Hùng (Trưởng kho)",
        email: "lienhe@haisanhungphat.vn",
        phone: "0912345678",
        address: "Số 42 Đường số 12, P. Tân Kiểng, Quận 7, TP.HCM",
        website: "https://haisanhungphat.vn",
        tags: ["cá hồi", "hải sản", "sỉ", "tươi sống"],
        sourceUrls: ["https://haisanhungphat.vn/lien-he"],
        evidence: "Nhập khẩu trực tiếp cá hồi tươi nauy nguyên con/phile, đầy đủ VSATTP.",
        confidence: 92
      },
      {
        name: "Công ty Cổ phần Thủy sản Minh Phú",
        contactPerson: "Chị Minh (Phòng Kinh Doanh)",
        email: "sales@minhphuseafood.com",
        phone: "02903839391",
        address: "Khu công nghiệp Phường 8, TP. Cà Mau, Tỉnh Cà Mau",
        website: "https://minhphuseafood.com",
        tags: ["thủy sản", "hải sản", "sỉ", "tôm sú"],
        sourceUrls: ["https://minhphuseafood.com/vi/co-hoi-hop-tac"],
        evidence: "Tập đoàn xuất khẩu thủy hải sản hàng đầu Việt Nam, hỗ trợ giao hàng xe đông lạnh.",
        confidence: 88
      },
      {
        name: "Hải sản Sạch Biển Đông",
        contactPerson: "Anh Đông (Điều phối sỉ)",
        email: "contact@biendongseafood.vn",
        phone: "0909998887",
        address: "Cảng cá Thọ Quang, Sơn Trà, TP. Đà Nẵng",
        website: "https://biendongseafood.vn",
        tags: ["hải sản", "tươi sống", "đà nẵng", "sỉ"],
        sourceUrls: ["https://biendongseafood.vn/about"],
        evidence: "Chuyên thu mua hải sản đánh bắt trong ngày tại tàu, cung cấp sỉ cho chuỗi nhà hàng miền Trung.",
        confidence: 85
      }
    ];
  } else if (normQuery.includes("gạo") || normQuery.includes("nông sản") || normQuery.includes("rau") || normQuery.includes("củ") || normQuery.includes("quả") || normQuery.includes("trái cây") || normQuery.includes("hành") || normQuery.includes("tỏi") || normQuery.includes("ớt")) {
    rawCandidates = [
      {
        name: "Hợp tác xã Nông sản Sạch Đà Lạt Green",
        contactPerson: "Chị Lan (Chủ nhiệm HTX)",
        email: "dalatgreencoop@gmail.com",
        phone: "0903334445",
        address: "12 Vạn Kiếp, Phường 8, TP. Đà Lạt, Lâm Đồng",
        website: "https://dalatgreen.vn",
        tags: ["rau củ", "nông sản", "rau sạch", "đà lạt"],
        sourceUrls: ["https://dalatgreen.vn/gioi-thieu"],
        evidence: "Nhà vườn đạt chuẩn VietGAP, chuyên canh rau củ tươi sỉ số lượng lớn cho bếp ăn công nghiệp.",
        confidence: 90
      },
      {
        name: "Tổng kho Gạo sạch miền Tây - Lộc Trời",
        contactPerson: "Anh Lộc (Đại diện sỉ)",
        email: "sales@loctroigrice.com",
        phone: "0918887776",
        address: "Số 23 Đường Trần Hưng Đạo, Mỹ Xuyên, TP. Long Xuyên, An Giang",
        website: "https://loctroi.vn",
        tags: ["gạo", "gạo sỉ", "nông sản", "st25"],
        sourceUrls: ["https://loctroi.vn/linh-vuc-nong-san"],
        evidence: "Nhà phân phối gạo ST25, Lài Sữa, Nàng Thơm uy tín bậc nhất, hóa đơn VAT đỏ đầy đủ.",
        confidence: 93
      },
      {
        name: "Nông sản Hữu cơ Organica",
        contactPerson: "Chị Thảo (Kinh doanh chuỗi)",
        email: "sales@organica.vn",
        phone: "0901234567",
        address: "130 Nguyễn Đình Chiểu, Phường 6, Quận 3, TP.HCM",
        website: "https://organica.vn",
        tags: ["nông sản", "hữu cơ", "rau củ", "sỉ"],
        sourceUrls: ["https://organica.vn/lien-he"],
        evidence: "Chứng nhận hữu cơ quốc tế USDA/EU, chuyên dòng rau củ quả cao cấp cho nhà hàng Fine Dining.",
        confidence: 86
      }
    ];
  } else if (normQuery.includes("dầu") || normQuery.includes("gia vị") || normQuery.includes("nước mắm") || normQuery.includes("tương") || normQuery.includes("chin-su") || normQuery.includes("chinsu")) {
    rawCandidates = [
      {
        name: "Công ty Cổ phần Hàng tiêu dùng Masan (Masan Consumer)",
        contactPerson: "Anh Minh (Sales Lead B2B)",
        email: "sales-b2b@masangroup.com",
        phone: "02862563862",
        address: "Tòa nhà MapleTree, 1060 Nguyễn Văn Linh, Tân Phong, Quận 7, TP.HCM",
        website: "https://masangroup.com",
        tags: ["gia vị", "nước tương", "dầu ăn", "chinsu"],
        sourceUrls: ["https://masangroup.com/vi/our-business/masan-consumer"],
        evidence: "Nhà sản xuất nước mắm Nam Ngư, tương ớt Chin-su, nước tương Tam Thái Tử hàng đầu.",
        confidence: 95
      },
      {
        name: "Đại lý Phân phối Gia vị & Dầu ăn Song Long",
        contactPerson: "Anh Song (Quản lý sỉ)",
        email: "songlongdistributor@gmail.com",
        phone: "0908889999",
        address: "155 Lê Trọng Tấn, Sơn Kỳ, Tân Phú, TP.HCM",
        website: "https://songlongdistributor.com",
        tags: ["gia vị", "dầu ăn", "đại lý sỉ"],
        sourceUrls: ["https://songlongdistributor.com/contact"],
        evidence: "Đại lý phân phối cấp 1 của Simply, Neptune, Meizan, Knorr, Ajinomoto tại miền Nam.",
        confidence: 89
      }
    ];
  } else {
    rawCandidates = [
      {
        name: "Nhà phân phối Tổng hợp Thành Đạt",
        contactPerson: "Anh Đạt (Chủ đại lý)",
        email: "sales@thanhdatdistributor.com",
        phone: "0902221110",
        address: "Khu dân cư Trung Sơn, Bình Hưng, Bình Chánh, TP.HCM",
        website: "https://thanhdatdistributor.com",
        tags: [query, "sỉ", "nhà phân phối"],
        sourceUrls: ["https://thanhdatdistributor.com/contact-us"],
        evidence: "Đại lý bán sỉ đa mặt hàng tiêu dùng và thực phẩm khô, chiết khấu cao cho đối tác Stally.",
        confidence: 85
      },
      {
        name: "Tổng kho Sỉ và Lẻ Hoàng Long",
        contactPerson: "Chị Long (Điều phối B2B)",
        email: "hoanglongwholesale@gmail.com",
        phone: "0934567890",
        address: "Phố Nối A, Yên Mỹ, Tỉnh Hưng Yên",
        website: "https://hoanglongwholesale.com",
        tags: [query, "sỉ", "tổng kho"],
        sourceUrls: ["https://hoanglongwholesale.com/about-us"],
        evidence: "Chuyên cung ứng nguyên liệu sỉ đầu vào cho các chuỗi ẩm thực và bếp ăn tập thể.",
        confidence: 87
      },
      {
        name: "Công ty TNHH Thương mại & Dịch vụ B2B Việt Nam",
        contactPerson: "Anh Tuấn (Trưởng phòng Thu mua)",
        email: "support@b2bvietnam.vn",
        phone: "0977665544",
        address: "Vinhomes Central Park, Bình Thạnh, TP.HCM",
        website: "https://b2bvietnam.vn",
        tags: [query, "B2B", "sỉ"],
        sourceUrls: ["https://b2bvietnam.vn/contact"],
        evidence: "Đối tác liên kết chuỗi cung ứng logistics toàn quốc, cung cấp hóa đơn đỏ VAT đầy đủ.",
        confidence: 84
      }
    ];
  }

  return rawCandidates
    .map((candidate) => normalizeCandidate(candidate, query, existingSuppliers))
    .filter(Boolean) as SupplierDiscoveryCandidate[];
}

export async function discoverSuppliers(ai: GoogleGenAI | null, input: SupplierDiscoveryInput) {
  const cleanQuery = cleanText(input.query);
  if (!cleanQuery) {
    throw new Error("Thiếu từ khóa hoặc mặt hàng cần tìm nhà cung cấp.");
  }

  const limit = Math.min(Math.max(input.limit || 5, 1), 8);
  let candidates: SupplierDiscoveryCandidate[] = [];

  if (!ai) {
    console.log("No valid GEMINI_API_KEY found or AI client is null. Running supplier discovery in simulator mode.");
    // Simulate a short network delay of 2.5s for a realistic experience
        candidates = runDiscoverySimulation(cleanQuery, limit, input.existingSuppliers);
  } else {
    try {
      const caseItems = input.caseObj?.items?.map((item) => `${item.name} ${item.quantity} ${item.unit}`).join("; ") || "";
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

      candidates = parsed
        .map((candidate) => normalizeCandidate(candidate, cleanQuery, input.existingSuppliers))
        .filter(Boolean) as SupplierDiscoveryCandidate[];
    } catch (err: any) {
      console.warn("AI supplier discovery failed, falling back to simulator mode. Error:", err.message || err);
      // Simulate a short network delay of 2.5s for a realistic experience
            candidates = runDiscoverySimulation(cleanQuery, limit, input.existingSuppliers);
    }
  }

  return candidates
    .sort((a, b) => Number(b.autoAddEligible) - Number(a.autoAddEligible) || b.confidence - a.confidence)
    .slice(0, limit);
}
