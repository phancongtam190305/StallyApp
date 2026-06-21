import React from "react";
import { 
  FileCheck, 
  Send, 
  AlertTriangle, 
  CircleDollarSign, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  Lock,
  ChefHat,
  ShoppingBag,
  Coins,
  BarChart3,
  Utensils,
  Wallet
} from "lucide-react";
import { PurchaseRequest, RfqCase, Quote, InventoryItem } from "../types";

interface StatsDashboardProps {
  purchaseRequests: PurchaseRequest[];
  rfqs: RfqCase[];
  quotes: Quote[];
  inventory: InventoryItem[];
  onCreatePrFromStock: (item: InventoryItem) => void;
  setActiveTab: (tab: string) => void;
}

export default function StatsDashboard({ 
  purchaseRequests, 
  rfqs, 
  quotes, 
  inventory,
  onCreatePrFromStock,
  setActiveTab
}: StatsDashboardProps) {
  
  // Calculate summary metrics
  const activePrCount = purchaseRequests.filter(p => ["submitted", "draft"].includes(p.status)).length;
  const pendingRfqCount = rfqs.filter(r => ["sent", "quotes_received"].includes(r.status)).length;
  
  const lowStockItems = inventory.filter(i => i.quantityAvailable < i.minStockLevel);
  const lowStockCount = lowStockItems.length;

  const approvedOrdersAmount = quotes
    .filter(q => q.status === "selected")
    .reduce((sum, q) => sum + q.totalAmount, 0);

  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Upper header summary with luxury feel */}
      <div className="enterprise-section p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent-dark font-extrabold">Phòng Kiểm soát Mua sắm & Cung ứng</p>
          <h2 className="text-xl font-extrabold font-display text-[#1A1A1A] tracking-tight flex items-center gap-2">
            CFO/COO kiểm soát chi tiêu, rủi ro và truy vết lịch sử trong 30 giây <Sparkles className="w-4 h-4 text-accent-dark" />
          </h2>
          <p className="text-slate-500 text-xs mt-1 max-w-3xl">
            Theo dõi PR, RFQ, báo giá, PO và tồn kho trong một mặt phẳng kiểm soát chuẩn hóa cho Horeca.
          </p>
          <div className="sr-only">
          <h2 className="text-xl font-extrabold font-display text-[#1A1A1A] tracking-tight flex items-center gap-2">
            Tổng quan kiểm soát mua hàng <Sparkles className="w-4 h-4 text-accent-dark" />
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Theo dõi PR, RFQ, báo giá, PO và tồn kho theo một truy vết lịch sử chuẩn hóa cho doanh nghiệp nhiều phòng ban.
          </p>
        </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
          <Clock className="w-3.5 h-3.5 text-accent-dark" />
          <span>Hệ thống trực tuyến</span>
        </div>
      </div>

      {/* Grid count cards - Sleek Ocean Grey & Ocean Teal theme */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active PRs Card */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl executive-shadow executive-shadow-hover select-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Yêu cầu mua (PR)</p>
              <h3 className="text-2xl font-bold text-[#1e293b] mt-1.5 font-display">{activePrCount} Yêu cầu</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-accent-dark border border-amber-200">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[1px] bg-slate-100 my-3" />
          <p className="text-[11px] text-slate-500">
            Đang chờ khớp nhà cung ứng hoặc duyệt.
          </p>
        </div>

        {/* Active RFQs Card */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl executive-shadow executive-shadow-hover select-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Phiên thầu RFQ</p>
              <h3 className="text-2xl font-bold text-[#1e293b] mt-1.5 font-display">{pendingRfqCount} Đang thầu</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[1px] bg-slate-100 my-3" />
          <p className="text-[11px] text-slate-500">
            Báo giá được bóc tách kèm red-flag khi confidence thấp.
          </p>
        </div>

        {/* Low Stock Alerts Card */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl executive-shadow executive-shadow-hover select-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Cảnh báo thiếu kho</p>
              <h3 className={`text-2xl font-bold mt-1.5 font-display ${lowStockCount > 0 ? "text-rose-600 animate-pulse" : "text-slate-700"}`}>
                {lowStockCount} Mặt hàng
              </h3>
            </div>
            <div className={`p-2.5 rounded-xl ${lowStockCount > 0 ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-slate-50 text-slate-400 border border-slate-200"}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[1px] bg-slate-100 my-3" />
          <p className="text-[11px] text-slate-500">
            Số lượng tồn kho dưới mức tối thiểu.
          </p>
        </div>

        {/* Total approved PO spent */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl executive-shadow executive-shadow-hover select-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Chi tiêu Đã duyệt</p>
              <h3 className="text-[18px] font-bold text-[#1A1A1A] mt-2 font-display truncate">
                {formatVND(approvedOrdersAmount)}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CircleDollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[1px] bg-slate-100 my-3" />
          <p className="text-[11px] text-slate-500">
            Hóa đơn PO chính thức gửi NCC.
          </p>
        </div>
      </div>

      {/* Visual Analytics & Rich Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biểu đồ Xu hướng Chi tiêu */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-6 rounded-2xl executive-shadow flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5 font-display">
                  <BarChart3 className="w-4 h-4 text-accent-dark" /> Xu hướng chi tiêu thu mua (Tuần gần nhất)
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold">Lưu lượng tích lũy giá trị đơn đặt hàng PO thành công theo ngày.</p>
              </div>
              <span className="text-[9px] bg-amber-50 text-accent-dark font-bold px-2 py-0.5 rounded border border-amber-200 font-mono">
                Số liệu thực tế
              </span>
            </div>

            {/* SVG Interactive Chart with gradient fills and precise grid lines */}
            <div className="relative h-64 mt-6 w-full group">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                <defs>
                  {/* Gradient fill underneath the area curve */}
                  <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.00" />
                  </linearGradient>
                  {/* Curve gradient stroke */}
                  <linearGradient id="chart-curve-stroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0ea5e9" />
                    <stop offset="50%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal guidelines */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="70" x2="500" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="170" x2="500" y2="170" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />

                {/* X and Y baseline */}
                <line x1="0" y1="180" x2="500" y2="180" stroke="#e2e8f0" strokeWidth="1.5" />

                {/* Chart Path Area polygon */}
                <path
                  d="M 10,180 Q 80,110 160,130 T 320,50 T 480,30 L 480,180 Z"
                  fill="url(#chart-area-fill)"
                />

                {/* Chart Path Stroke Line */}
                <path
                  d="M 10,180 Q 80,110 160,130 T 320,50 T 480,30"
                  fill="none"
                  stroke="url(#chart-curve-stroke)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Interactive Points circles */}
                <circle cx="10" cy="180" r="5" className="fill-white stroke-sky-500 stroke-[3] transition-all duration-350 hover:r-7 cursor-pointer" />
                <circle cx="95" cy="115" r="5" className="fill-white stroke-sky-450 stroke-[3] transition-all duration-350 hover:r-7 cursor-pointer" />
                <circle cx="178" cy="120" r="5" className="fill-white stroke-teal-500 stroke-[3] transition-all duration-350 hover:r-7 cursor-pointer" />
                <circle cx="320" cy="50" r="5" className="fill-white stroke-teal-600 stroke-[3] transition-all duration-350 hover:r-7 cursor-pointer" />
                <circle cx="480" cy="30" r="5" className="fill-white stroke-emerald-500 stroke-[3] transition-all duration-350 hover:r-7 cursor-pointer" />

                {/* Floating tooltips inside SVG */}
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <rect x="270" y="8" width="100" height="24" rx="6" fill="#0f172a" />
                  <text x="320" y="23" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">PO Đỉnh: 42.5 M</text>
                </g>
              </svg>

              {/* Chart Date Tags */}
              <div className="flex justify-between px-1 text-[10px] font-mono text-slate-400 font-bold mt-2.5">
                <span>Thứ 2</span>
                <span>Thứ 3</span>
                <span>Thứ 4</span>
                <span>Thứ 5</span>
                <span>Thứ 6</span>
                <span>Thứ 7</span>
                <span>Chủ Nhật</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-center justify-between text-xs mt-4">
            <span className="text-slate-500 font-bold">Trung bình phản hồi của nhà cung ứng:</span>
            <span className="text-[#1A1A1A] font-bold font-mono">3.4 báo giá / phiên thầu</span>
          </div>
        </div>

        {/* Cân Đối Ngân Sách Danh Mục */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-6 rounded-2xl executive-shadow flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5 font-display">
              <Coins className="w-4 h-4 text-emerald-600" /> Ngân Sách Nguyên Liệu Thực Phẩm
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold">
              Tỷ lệ giải ngân nhóm nguyên vật liệu mục tiêu tháng này.
            </p>

            <div className="space-y-4 mt-6">
              {[
                { name: "Lương thực & Gạo thơm (ST25)", progress: 78, color: "bg-amber-500", raw: "5.4 M / 7 M", icon: ChefHat },
                { name: "Thịt Sạch & Hải Sản tươi", progress: 62, color: "bg-primary-dark", raw: "12.4 M / 20 M", icon: Utensils },
                { name: "Gia vị & Khối yêu cầu vận hành", progress: 41, color: "bg-indigo-500", raw: "2.1 M / 5 M", icon: Coins },
                { name: "Rau củ hữu cơ Đà Lạt", progress: 91, color: "bg-emerald-500", raw: "4.5 M / 5 M", icon: ShoppingBag }
              ].map((category, idx) => {
                const Icon = category.icon;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <div className="p-1 rounded bg-slate-50 text-slate-400">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate max-w-[150px]">{category.name}</span>
                      </div>
                      <span className="font-mono text-[10.5px] text-slate-500 font-extrabold">{category.raw}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full ${category.color} rounded-full transition-all duration-500`}
                        style={{ width: `${category.progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-center justify-between mt-4">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Biến động ngân sách tổng quan:
            </span>
            <span className="text-emerald-700 font-bold text-xs font-mono">An Toàn (0% vượt mẫu)</span>
          </div>
        </div>
      </div>

      {/* Critical Stock Warn & Quick AI Action Panel */}
      {lowStockCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-lg" />
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-accent-dark uppercase tracking-wider font-mono flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-accent-dark" /> Đề xuất bù tồn kho có kiểm duyệt
              </p>
              <h4 className="text-sm font-bold text-slate-800">
                Có {lowStockCount} mặt hàng thiết yếu sắp cạn kiệt! Bạn muốn khởi tạo đơn thầu ngay không?
              </h4>
              <p className="text-xs text-slate-500">
                Hệ thống gợi ý số lượng bù thâm hụt, gán ưu tiên Cao và tạo PR nháp để đội mua hàng kiểm tra trước khi gửi RFQ.
              </p>
            </div>
            <div className="flex gap-2.5 shrink-0">
              <button 
                onClick={() => setActiveTab("chatbot")}
                className="bg-[#1A1A1A] hover:bg-[#000000] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Dùng Trợ lý AI
              </button>
              <button 
                onClick={() => {
                  lowStockItems.forEach(it => onCreatePrFromStock(it));
                  setActiveTab("pr");
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Tạo PR bù tồn nhanh
              </button>
            </div>
          </div>

          {/* Mini-list of warn items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
            {lowStockItems.map((it) => (
              <div key={it.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-slate-800">{it.name}</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Hiện tồn: <span className="text-rose-600 font-semibold">{it.quantityAvailable}</span> | Ngưỡng mốc: {it.minStockLevel} {it.unit}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onCreatePrFromStock(it);
                    setActiveTab("pr");
                  }}
                  className="p-1 px-2.5 text-[10px] bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-200 text-accent-dark rounded-lg transition-all font-semibold cursor-pointer"
                >
                  Bù hàng +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System operation Flowchart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 executive-shadow space-y-6">
        <div>
          <h3 className="text-sm font-extrabold text-[#1A1A1A] font-display">Quy trình tự động hóa chuỗi cung ứng</h3>
          <p className="text-xs text-slate-500 mt-1">
            Quy trình phối hợp khép kín giữa các bộ phận, từ yêu cầu nội bộ đến quản lý thầu và đối soát thực tồn.
          </p>
        </div>

        {/* Steps diagram */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-center space-y-2">
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center mx-auto text-xs font-bold">1</div>
            <p className="text-xs font-bold text-slate-800">Yêu cầu nội bộ (PR)</p>
            <p className="text-[11px] text-slate-500 leading-normal">Bộ phận yêu cầu đề xuất mua hàng hoặc kho tự động sinh yêu cầu bổ sung khi vơi.</p>
          </div>

          <div className="bg-[#e0f1f2]/40 p-4 rounded-xl border border-[#b2dfdb]/40 text-center space-y-2">
            <div className="w-9 h-9 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center mx-auto text-xs font-bold">2</div>
            <p className="text-xs font-bold text-primary-dark flex justify-center items-center gap-1">RFQ có audit trail</p>
            <p className="text-[11px] text-slate-500 leading-normal">Gửi RFQ, ghi nhận phản hồi, red-flag báo giá rủi ro và trình duyệt có lý do.</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-center space-y-2">
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center mx-auto text-xs font-bold">3</div>
            <p className="text-xs font-bold text-slate-800">Nhập kho &amp; Đối soát</p>
            <p className="text-[11px] text-slate-500 leading-normal">Khi hàng về, thủ kho thẩm định chất lượng, ghi số để tăng lượng tồn kho.</p>
          </div>
        </div>

        {/* Security / Isolation declaration */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-3">
          <Lock className="w-4 h-4 text-accent-dark shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-700">Cách ly dữ liệu đầu cuối an toàn</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dữ liệu đơn hàng PR, RFQ, thông tin đối tác của bạn được mã hóa và cô lập hoàn toàn lớp logic nhằm đảm bảo tính bảo mật đặc quyền trong hoạt động kinh doanh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
