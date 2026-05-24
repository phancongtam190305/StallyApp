import React, { useState, useEffect, useRef } from "react";
import { UserRole } from "../types";
import { 
  Sparkles, 
  ArrowRight, 
  CornerDownLeft, 
  HelpCircle, 
  CheckCircle2, 
  X,
  Compass,
  Zap,
  MousePointerClick
} from "lucide-react";

interface Step {
  tab: string;
  title: string;
  description: string;
  targetId: string; // Absolute targeted ID for "hand-holding"
  tooltip: string; // Micro instruction
}

interface OnboardingTutorialProps {
  role: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onComplete: () => void;
}

export default function OnboardingTutorial({ role, activeTab, setActiveTab, onComplete }: OnboardingTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [typingComplete, setTypingComplete] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Define super short, focused, hand-holding steps for each role
  const getStepsByRole = (r: UserRole): Step[] => {
    switch (r) {
      case "requester": // Bếp Trưởng
        return [
          {
            tab: "overview",
            title: "TỔNG QUAN KHO",
            description: "Dòm các ô nguyên liệu có dấu chấm đỏ cảnh báo khẩn cấp (sắp cạn kho bếp).",
            targetId: "#btn-tab-overview",
            tooltip: "Nhìn vào Tab Tổng quan để rà soát lượng tồn."
          },
          {
            tab: "pr",
            title: "BIỂU MẪU MUA HÀNG (PR)",
            description: "Click sang tab này để đặt đơn hàng mới, gửi thầu tuyển chọn nhà cung cấp.",
            targetId: "#btn-tab-pr",
            tooltip: "Bấm chuột vào Tab Yêu cầu mua hàng."
          },
          {
            tab: "pr",
            title: "GỬI ĐƠN PHÒNG THU MUA",
            description: "Nhập mặt mộc nguyên liệu ở cột trái rồi nhấn nút này gửi trực tế thầu của bạn.",
            targetId: "#btn-create-pr",
            tooltip: "Biểu mẫu điền nhanh rồi click Gửi."
          },
          {
            tab: "chatbot",
            title: "TRỢ LÝ AI SOURCING",
            description: "Để rảnh tay hơn, click vào đây để trò chuyện lập hợp đồng qua robot.",
            targetId: "#btn-tab-chatbot",
            tooltip: "Mở Tab Trợ lý ảo AI tiện dụng."
          },
          {
            tab: "chatbot",
            title: "RA LỆNH TRỰC TIẾP",
            description: "Gõ đại 'mua 20kg thịt bò' rồi Enter. AI lập đơn nháp trong 1 nốt nhạc!",
            targetId: "#chatbot-input",
            tooltip: "Gõ lệnh & xem robot viết đơn tức thời."
          }
        ];
      case "procurement": // Trưởng Phòng Thu Mua
        return [
          {
            tab: "pr",
            title: "XEM YÊU CẦU CỦA BẾP",
            description: "Nơi tụ hội toàn bộ nhu cầu mua sắm thực phẩm khẩn cấp từ bếp nhà hàng.",
            targetId: "#btn-tab-pr",
            tooltip: "Mở Tab PR kiểm định hồ sơ."
          },
          {
            tab: "pr",
            title: "QUẢN LÝ TIẾP QUẬN",
            description: "Bấm nút này trên một phiếu PR bất kỳ để xúc tiến liên kết đấu thầu.",
            targetId: "#btn-sourcing-rfq",
            tooltip: "Nhấn nút Sourcing/Khảo giá để điều thầu."
          },
          {
            tab: "rfq",
            title: "XUẤT YÊU CẦU BÁO GIÁ",
            description: "Nhấn đây để bắn thông báo email liên mời hàng loạt nhà thầu báo giá cạnh tranh.",
            targetId: "#btn-send-rfq",
            tooltip: "Nút gửi thư thầu RFQ đến các thương lái."
          },
          {
            tab: "rfq",
            title: "MA TRẬN ĐỐI CHIẾU GIÁ",
            description: "Hệ thống lấy email báo giá nộp về, tự tô xanh nhà bán lẻ rẻ nhất có lợi.",
            targetId: "#btn-tab-rfq",
            tooltip: "Nhìn bảng đối chiếu so giá thầu tự động."
          }
        ];
      case "manager": // Giám Đốc Phê Duyệt
        return [
          {
            tab: "rfq",
            title: "ĐÁNH GIÁ PHƯƠNG ÁN",
            description: "Mở bảng so thầu xem nhà cung cấp nào cam kết giá cạnh tranh nhất chuỗi ăn.",
            targetId: "#btn-tab-rfq",
            tooltip: "Tab RFQ giúp đối chiếu dòng tiền thu mua."
          },
          {
            tab: "rfq",
            title: "DUYỆT CHI & KÝ PO",
            description: "Bấm ký duyệt. Robot tự gieo email đơn PO cam kết cho đại lý tức tốc bốc xe.",
            targetId: "#btn-approve-po",
            tooltip: "Gõ duyệt & ký số xuất đơn hàng tức khắc."
          },
          {
            tab: "overview",
            title: "GIÁM SÁT TÀI CHÍNH",
            description: "Click đây để theo dõi biểu đồ cơ cấu nợ, thâm hụt tài toán doanh nghiệp.",
            targetId: "#btn-tab-overview",
            tooltip: "Phân tích đồ thị chi phí tối ưu."
          }
        ];
      case "warehouse": // Thủ Kho Trưởng
        return [
          {
            tab: "inventory",
            title: "XÁC THỰC NHẬN HÀNG (PO)",
            description: "Xe bốc hàng của đại lý cập bến, rà đơn và click đây tăng lượng tồn bãi.",
            targetId: "#btn-receive-po",
            tooltip: "Nhấn Xác thực Nhận PO để kiểm đếm tăng kho."
          },
          {
            tab: "inventory",
            title: "ĐIỀU CHỈNH HAO HỤT",
            description: "Có rau hỏng, dĩa mẻ? Dùng mục này điều chỉnh trực chứng và lưu nhật ký.",
            targetId: "#btn-adjust-inventory",
            tooltip: "Ghi biến động kho để đối chiếu kế toán."
          }
        ];
      default:
        return [
          {
            tab: "overview",
            title: "BẮT ĐẦU TRẢI NGHIỆM",
            description: "Hệ thống mua thầu chuỗi cung ứng đồng bộ. Click để xem tiếp.",
            targetId: "#btn-tab-overview",
            tooltip: "Tab tổng quan mặc định."
          }
        ];
    }
  };

  const steps = getStepsByRole(role);
  const currentStep = steps[currentStepIndex];

  // 1. Handle actual tab redirection inside main application state
  useEffect(() => {
    if (currentStep) {
      setActiveTab(currentStep.tab);
    }
  }, [currentStepIndex, role]);

  // 2. Typing / Streaming simulation implementation
  useEffect(() => {
    if (!currentStep) return;
    
    setDisplayedText("");
    setTypingComplete(false);
    
    let index = 0;
    const initialText = currentStep.description;
    
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + initialText.charAt(index));
      index++;
      if (index >= initialText.length) {
        clearInterval(interval);
        setTypingComplete(true);
      }
    }, 12); // Snappy streaming effect

    return () => clearInterval(interval);
  }, [currentStepIndex, role]);

  // 3. Dynamic target element coordinate calculations to "Cầm tay chỉ việc"
  const updateTargetCoordinates = () => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    } else {
      setCoords(null);
    }
  };

  useEffect(() => {
    updateTargetCoordinates();
    
    // Poll to match tab switching rendering delays
    const timer = setInterval(updateTargetCoordinates, 200);
    window.addEventListener("resize", updateTargetCoordinates);
    window.addEventListener("scroll", updateTargetCoordinates);

    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", updateTargetCoordinates);
      window.removeEventListener("scroll", updateTargetCoordinates);
    };
  }, [currentStepIndex, role, activeTab]);

  // 4. Keyboard Listener to go next step via "Enter" key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentStepIndex, typingComplete]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  if (!currentStep) return null;

  return (
    <div id="tutorial-workspace" className="fixed inset-0 z-50 pointer-events-none">
      
      {/* Dim overlay that filters clicks except on the targeted element if supported */}
      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[0.5px] transition-all duration-300" />

      {/* Dynamic Hand-holding Highlight Box */}
      {coords && (
        <div 
          className="absolute border-2 border-teal-400 rounded-xl pointer-events-none transition-all duration-300 ring-4 ring-[#14b8a6]/20 shadow-2xl z-50"
          style={{
            top: coords.top - 6,
            left: coords.left - 6,
            width: coords.width + 12,
            height: coords.height + 12,
          }}
        >
          {/* Glowing Animated outline */}
          <div className="absolute inset-0 border border-teal-300 rounded-lg animate-ping opacity-60 pointer-events-none" />
          
          {/* Little Floating pointing tag */}
          <div className="absolute -top-3.5 -right-3.5 bg-teal-500 text-white p-1 rounded-full animate-bounce z-50 shadow-md">
            <MousePointerClick className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Floating Snappy Streaming Chat Dialog card */}
      <div className="absolute bottom-6 right-6 z-50 w-full max-w-sm bg-slate-900 border border-teal-500/40 text-white rounded-2.5xl shadow-2xl p-4.5 pointer-events-auto select-none font-sans flex flex-col gap-3">
        
        {/* Brand/Role Tag Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-teal-400">
            <Zap className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>AI TRỢ THỦ • {currentStepIndex + 1}/{steps.length}</span>
          </div>
          
          <button 
            type="button"
            onClick={onComplete}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            title="Đóng hướng dẫn"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Typing streaming contents */}
        <div className="space-y-1">
          <h4 className="text-[11px] font-black text-[#5eead4] tracking-wide">
            {currentStep.title}
          </h4>
          
          <div className="min-h-12 flex flex-col justify-center">
            <p className="text-xs text-slate-100 font-medium leading-relaxed">
              {displayedText}
              {!typingComplete && (
                <span className="inline-block w-1.5 h-3 bg-teal-400 ml-1 animate-pulse" />
              )}
            </p>
          </div>
        </div>

        {/* Targeted action bubble helper */}
        <div className="bg-teal-950/40 border border-teal-900/50 p-2 rounded-xl text-[10px] text-teal-300 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0 animate-ping inline-block" />
          <span className="italic leading-snug">
            <strong>Chỉ vị:</strong> {currentStep.tooltip}
          </span>
        </div>

        {/* Buttons flow & navigation indicators */}
        <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-1">
          <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold font-mono">
            <span>Ấn</span>
            <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] text-slate-300">Enter</kbd>
            <span>để đi tiếp</span>
          </div>

          <div className="flex gap-2.5">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10.5px] font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Lùi
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 border border-teal-400 text-white rounded-xl text-xs font-black tracking-wide transition-all shadow-md cursor-pointer flex items-center gap-1"
            >
              {currentStepIndex === steps.length - 1 ? (
                <>XONG <CheckCircle2 className="w-3.5 h-3.5" /></>
              ) : (
                <>TIẾP <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
