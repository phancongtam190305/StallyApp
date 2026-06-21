import React, { useState, useEffect, useRef } from "react";
import { UserRole } from "../types";
import { 
  Sparkles, 
  ArrowRight, 
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

  // Focused hand-holding steps for each role in the current case-based workflow.
  const getStepsByRole = (r: UserRole): Step[] => {
    switch (r) {
      case "requester":
        return [
          {
            tab: "overview",
            title: "BƯỚC 1 - KIỂM TRA TỒN KHO",
            description: "Trước khi tạo yêu cầu mua, xem nhanh mặt hàng nào đang dưới mức tồn tối thiểu để ưu tiên đúng nhu cầu của bộ phận yêu cầu.",
            targetId: "#btn-tab-overview",
            tooltip: "Mở Tổng quan để xem cảnh báo tồn kho thấp."
          },
          {
            tab: "cases",
            title: "BƯỚC 2 - TẠO HỒ SƠ MUA HÀNG",
            description: "Vào Hồ sơ mua hàng để nhập mặt hàng, số lượng, đơn vị và ngày cần hàng. Hồ sơ là đầu vào chính cho phòng mua hàng xử lý sourcing.",
            targetId: "#btn-tab-cases",
            tooltip: "Mở Hồ sơ mua hàng để tạo yêu cầu."
          },
          {
            tab: "cases",
            title: "BƯỚC 3 - GỬI CHO THU MUA",
            description: "Sau khi kiểm tra nội dung hồ sơ, bấm tạo. Phòng mua hàng sẽ tiếp nhận, chọn nhà cung cấp và gửi RFQ trong cùng một timeline.",
            targetId: "#btn-create-case",
            tooltip: "Bấm Tạo hồ sơ mua hàng rồi điền đủ mặt hàng."
          },
          {
            tab: "inventory",
            title: "BƯỚC 4 - THEO DÕI KHO",
            description: "Sau khi PO được duyệt và thủ kho nhận hàng, số lượng tồn kho sẽ tự tăng. Nếu vẫn thiếu hàng, tạo PR bù tồn tiếp.",
            targetId: "#btn-tab-inventory",
            tooltip: "Mở Tồn kho để kiểm tra lượng đã cập nhật."
          }
        ];
      case "procurement":
        return [
          {
            tab: "cases",
            title: "BƯỚC 1 - MỞ KANBAN CASE",
            description: "Đây là màn vận hành chính của phòng mua hàng. Mỗi thẻ case đi từ đón nhận, mời thầu, đàm phán, duyệt PO tới nhập kho.",
            targetId: "#btn-tab-cases",
            tooltip: "Mở tab Quy trình để xử lý case mua hàng."
          },
          {
            tab: "cases",
            title: "BƯỚC 2 - TẠO HOẶC MỞ CASE",
            description: "Nếu có yêu cầu mới, tạo case thu mua. Nếu đã có case từ bộ phận yêu cầu, bấm vào thẻ để vào timeline xử lý chi tiết.",
            targetId: "#btn-create-case",
            tooltip: "Tạo case mới hoặc mở thẻ case đang chờ."
          },
          {
            tab: "cases",
            title: "BƯỚC 3 - SOẠN VÀ GỬI RFQ",
            description: "Trong case, chọn nhà cung cấp, để AI soạn email RFQ, review nội dung rồi bấm gửi Gmail thật cho nhà cung cấp.",
            targetId: "#btn-send-case-rfq",
            tooltip: "Nếu chưa thấy nút này, mở một case đang ở bước Mời thầu."
          },
          {
            tab: "cases",
            title: "BƯỚC 4 - THEO DÕI BÁO GIÁ",
            description: "Khi NCC reply Gmail, hệ thống đọc mail, trích xuất báo giá và cập nhật bảng so sánh. Kiểm tra tổng tiền, ngày giao, điều khoản công nợ.",
            targetId: "#btn-tab-cases",
            tooltip: "Mở case ở bước Thương thảo để xem matrix."
          },
          {
            tab: "cases",
            title: "BƯỚC 5 - ĐÀM PHÁN AI",
            description: "Nếu cần giảm giá, chọn NCC, chọn mục tiêu như giảm 5%, để AI soạn mail thương lượng. Khi NCC đồng ý, bảng giá sẽ tự cập nhật.",
            targetId: "#btn-draft-negotiation",
            tooltip: "Nếu chưa thấy nút này, case cần có ít nhất một báo giá."
          },
          {
            tab: "cases",
            title: "BƯỚC 6 - TRÌNH DUYỆT PO",
            description: "Chọn phương án tốt nhất rồi trình lên Giám Đốc. Từ đây manager duyệt, sau đó phòng mua hàng tạo và gửi PO chính thức.",
            targetId: "#btn-request-approval",
            tooltip: "Bấm Trình duyệt PO trên dòng nhà cung cấp phù hợp."
          }
        ];
      case "manager":
        return [
          {
            tab: "overview",
            title: "BƯỚC 1 - XEM HỒ SƠ CHỜ DUYỆT",
            description: "Tổng quan cho biết hồ sơ nào đang chờ duyệt PO. Ưu tiên hồ sơ khẩn cấp hoặc có giá trị lớn.",
            targetId: "#btn-tab-overview",
            tooltip: "Mở Tổng quan để xem hàng đợi duyệt."
          },
          {
            tab: "cases",
            title: "BƯỚC 2 - MỞ CASE CẦN DUYỆT",
            description: "Vào Quy trình và mở case ở trạng thái Chờ CEO duyệt. Kiểm tra nhà cung cấp được đề xuất, tổng tiền và lý do chọn.",
            targetId: "#btn-tab-cases",
            tooltip: "Mở tab Quy trình rồi chọn case chờ duyệt."
          },
          {
            tab: "cases",
            title: "BƯỚC 3 - KÝ DUYỆT HOẶC TRẢ VỀ",
            description: "Nếu giá và điều kiện đạt yêu cầu, bấm ký duyệt. Nếu chưa ổn, bác bỏ để phòng mua hàng quay lại đàm phán.",
            targetId: "#btn-manager-approve-case",
            tooltip: "Nếu chưa thấy nút này, hãy mở case đang ở bước CEO Duyệt."
          },
          {
            tab: "inventory",
            title: "BƯỚC 4 - KIỂM TRA SAU DUYỆT",
            description: "Sau khi PO gửi và thủ kho nhận hàng, tồn kho sẽ tự cập nhật. Manager có thể kiểm tra kết quả cuối ở tab Tồn kho.",
            targetId: "#btn-tab-inventory",
            tooltip: "Mở Tồn kho để xem lượng hàng sau nhập."
          }
        ];
      case "warehouse":
        return [
          {
            tab: "cases",
            title: "BƯỚC 1 - MỞ CASE ĐANG NHẬN HÀNG",
            description: "Vào Quy trình để tìm case ở trạng thái Đang nhận hàng. Đây là lô PO đã được phòng mua hàng gửi chính thức.",
            targetId: "#btn-tab-cases",
            tooltip: "Mở tab Quy trình để tìm case cần nhập kho."
          },
          {
            tab: "cases",
            title: "BƯỚC 2 - XÁC NHẬN NHẬP KHO",
            description: "Khi hàng về đủ, bấm xác nhận kiểm kho. Hệ thống tự tăng tồn khả dụng, giảm hàng đang về và ghi stock movement.",
            targetId: "#btn-receive-case-po",
            tooltip: "Nếu chưa thấy nút này, mở case có PO đã gửi và đang nhận."
          },
          {
            tab: "inventory",
            title: "BƯỚC 3 - KIỂM TRA TỒN ĐÃ TĂNG",
            description: "Sau khi nhận PO, quay về Tồn kho để kiểm tra số lượng đã tăng đúng theo số nhận thực tế.",
            targetId: "#btn-receive-po",
            tooltip: "Mở Tồn kho để đối chiếu lượng hàng."
          },
          {
            tab: "inventory",
            title: "BƯỚC 4 - GHI ĐIỀU CHỈNH NẾU LỆCH",
            description: "Nếu phát hiện hư hỏng, hao hụt hoặc kiểm kê lệch, dùng điều chỉnh tồn kho để tạo lịch sử đối soát.",
            targetId: "#btn-adjust-inventory",
            tooltip: "Ghi tăng/giảm tồn và lý do điều chỉnh."
          }
        ];
      default:
        return [
          {
            tab: "overview",
            title: "BẮT ĐẦU",
            description: "Mở Tổng quan để xem trạng thái vận hành, sau đó vào Quy trình để xử lý từng case mua hàng.",
            targetId: "#btn-tab-overview",
            tooltip: "Tab tổng quan mặc định."
          }
        ];
    }
  };

  const steps = getStepsByRole(role);
  const currentStep = steps[currentStepIndex];
  const targetFound = Boolean(coords);

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

    let cancelled = false;
    let index = 0;
    const initialText = currentStep.description;
    
    const interval = setInterval(() => {
      if (cancelled) return;
      index++;
      setDisplayedText(initialText.slice(0, index));
      if (index >= initialText.length) {
        clearInterval(interval);
        setTypingComplete(true);
      }
    }, 12); // Snappy streaming effect

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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
      <div className="absolute inset-0 bg-[#1A1A1A]/25 backdrop-blur-[0.5px] transition-all duration-300" />

      {/* Dynamic Hand-holding Highlight Box */}
      {coords && (
        <div 
          className="absolute border border-accent-gold rounded-2xl pointer-events-none transition-all duration-300 ring-4 ring-accent-gold/20 shadow-2xl z-50"
          style={{
            top: coords.top - 6,
            left: coords.left - 6,
            width: coords.width + 12,
            height: coords.height + 12,
          }}
        >
          {/* Glowing Animated outline */}
          <div className="absolute inset-0 border border-accent-gold rounded-2xl animate-ping opacity-50 pointer-events-none" />
          
          {/* Little Floating pointing tag */}
          <div className="absolute -top-3.5 -right-3.5 bg-accent-gold text-primary-dark p-1 rounded-full animate-bounce z-50 shadow-md">
            <MousePointerClick className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Floating Snappy Streaming Chat Dialog card */}
      <div className="absolute bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm bg-[#1A1A1A] border border-white/10 text-white rounded-[2rem] shadow-2xl p-4.5 pointer-events-auto select-none font-sans flex flex-col gap-3">
        
        {/* Brand/Role Tag Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-[0.22em] text-accent-gold">
            <Zap className="w-3.5 h-3.5 text-accent-gold shrink-0" />
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
          <h4 className="text-base font-display font-normal text-accent-light tracking-tight">
            {currentStep.title}
          </h4>
          
          <div className="min-h-12 flex flex-col justify-center">
            <p className="text-xs text-slate-100 font-medium leading-relaxed">
              {displayedText}
              {!typingComplete && (
                <span className="inline-block w-1.5 h-3 bg-accent-gold ml-1 animate-pulse" />
              )}
            </p>
          </div>
        </div>

        {/* Targeted action bubble helper */}
        <div className="bg-white/8 border border-white/10 p-2 rounded-2xl text-[10px] text-accent-light flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 inline-block ${targetFound ? "bg-accent-gold animate-ping" : "bg-coral"}`} />
          <span className="italic leading-snug">
            <strong>{targetFound ? "Chỉ vị:" : "Cần mở đúng màn:"}</strong> {currentStep.tooltip}
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
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10.5px] font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Lùi
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 bg-accent-gold hover:bg-white border border-accent-gold text-primary-dark rounded-full text-xs font-bold tracking-wide transition-all shadow-md cursor-pointer flex items-center gap-1"
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
