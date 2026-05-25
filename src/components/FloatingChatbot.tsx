import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  RefreshCw, 
  X, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  Check, 
  FilePlus2, 
  Compass, 
  BookOpen, 
  PlusCircle, 
  History, 
  GitMerge, 
  ShieldAlert
} from "lucide-react";
import { PriorityLevel, PurchaseRequestItem, UserRole } from "../types";
import ItemIcon from "./ItemIcon";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  isDraftConfirmed?: boolean;
}

interface FloatingChatbotProps {
  currentRole: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onCreatePr: (prData: { title: string; priority: PriorityLevel; requiredDate: string; items: PurchaseRequestItem[] }) => void;
}

interface FAQItem {
  q: string;
  a: string;
  tags: string[];
}

export default function FloatingChatbot({
  currentRole,
  activeTab,
  setActiveTab,
  onCreatePr
}: FloatingChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTabPanel, setActiveTabPanel] = useState<"chat" | "faq">("chat");
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- WELCOME MESSAGES BY ROLE ---
  const welcomeMessage = useMemo(() => {
    switch (currentRole) {
      case "requester":
        return `Xin chào **Bếp Trưởng Bình**! 👨‍🍳 Tôi là **Stally Sourcing AI Agent**.
        
Tôi có thể giúp bạn kiểm tra các sản phẩm sắp cạn trong kho hoặc tự động tạo phiếu đề xuất mua hàng (PR) nháp cho bếp.
        
👉 Hãy thử hỏi tôi: *"Kho còn gạo không?"* hoặc nhắn: *"Lập PR mua 50kg gạo ST25 và 20 chai dầu ăn"*!`;
      
      case "procurement":
        return `Chào **Staff Thu Mua Tâm**! 💼 Tôi là trợ lý **Stally Sourcing AI Agent**.
        
Tôi sẵn sàng hỗ trợ bạn ghép nối nhà cung ứng CRM tiềm năng, lập dự thảo RFQ gửi Gmail, tự động bóc tách hóa đơn chào thầu qua OCR và đàm phán chiết khấu giá thầu.
        
👉 Hỏi tôi: *"Có báo giá mới nào chưa?"* hoặc *"Làm cách nào đàm phán giá?"*`;
      
      case "manager":
        return `Kính chào **Giám Đốc Mai**! 🏢 Tôi là trợ lý đặc quyền **Stally Executive AI**.
        
Tôi sẽ giúp Giám Đốc rà soát báo cáo tài chính giải ngân chuỗi cung ứng, đối chiếu ngân sách các nhóm hàng thực phẩm tháng này, và phân tích ma trận 3 Gold Metrics tối ưu thầu thầu để Giám đốc an tâm ký duyệt PO thầu.
        
👉 Hãy hỏi tôi: *"Tổng chi tiêu tháng này bao nhiêu?"* hoặc *"Hồ sơ nào cần duyệt?"*`;
      
      case "warehouse":
        return `Chào **Thủ Kho Khoa**! 📦 Tôi là trợ lý **Stally Warehouse AI**.
        
Tôi sẵn sàng hướng dẫn bạn quy trình Mark Nhận đủ hàng hóa giao về kho, hoặc điều chỉnh tồn kho tay, lập báo cáo lệch hỏng hao hụt nguyên liệu để gửi cho phòng thu mua xử lý.
        
👉 Hỏi tôi: *"Làm thế nào nhận hàng PO?"* hoặc *"Cách báo cáo hỏng hóc?"*`;

      default:
        return `Xin chào! Tôi là **Stally Sourcing AI Agent** 🤖. Tôi có thể hỗ trợ bạn rà duyệt kho, soạn thảo PR mua hàng và đàm phán thầu tự động.`;
    }
  }, [currentRole]);

  const [messages, setMessages] = useState<Message[]>([]);

  // Reset messages when role changes to give fresh relevant assistance
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: welcomeMessage
      }
    ]);
  }, [currentRole, welcomeMessage]);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sending, isOpen]);

  // --- KNOWLEDGE BASE FAQ DATABASE ---
  const faqs: FAQItem[] = [
    {
      q: "Làm cách nào để thêm một nhà cung cấp mới?",
      a: "Để thêm nhà cung cấp mới vào hệ thống CRM:\n1. Bấm vào tab **Nhà Cung Cấp (Suppliers)** từ Sidebar bên trái.\n2. Chọn nút **Thêm Nhà Cung Cấp** ở trên cùng.\n3. Nhập đầy đủ thông tin bao gồm tên đối tác, đại diện liên hệ, địa chỉ email, số điện thoại, đánh giá sao (1-5), và các thẻ phân loại ngành hàng thầu (ví dụ: gạo, rau củ, hải sản).\n4. Bấm **Lưu** để hoàn tất. AI sẽ ngay lập tức ghi nhận nhà cung ứng này vào cơ sở dữ liệu để tự động ghép cặp thầu về sau!",
      tags: ["crm", "nhà cung cấp", "supplier", "thêm ncc"]
    },
    {
      q: "Làm cách nào để Giám Đốc duyệt một báo giá thầu?",
      a: "Quy trình phê duyệt thông minh dành cho Giám Đốc:\n1. Chọn vai trò **Giám Đốc (Manager)** để đăng nhập vào workspace cách ly đặc quyền.\n2. Trên bảng điều khiển Tổng quan, di chuyển đến **Hộp Thư Phê Duyệt** hoặc tab **Thầu & Giá (RFQ)**.\n3. Nhấp chọn một Case thầu đang chờ duyệt để xem **Bản Tổng Hợp 3 Gold Metrics** (nhà thầu tối ưu, tổng chi phí so với dự toán ngân sách, và lý do đề xuất).\n4. Bấm **Xem so sánh chi tiết** để trượt Drawer kiểm toán so sánh giá thầu, file PDF gốc và email đàm phán.\n5. Bấm **Ký & Duyệt PO** để hoàn tất. PO sẽ tự động gửi email đến nhà thầu được duyệt!",
      tags: ["duyệt", "manager", "phê duyệt", "po", "báo giá", "giám đốc"]
    },
    {
      q: "Làm sao để Mark nhận đủ hàng hóa giao về kho?",
      a: "Đối với Thủ kho thực hiện check-in nhận hàng:\n1. Truy cập workspace của **Thủ Kho (Warehouse)** và chọn tab **Quản Lý Kho**.\n2. Trong mục **Incoming Deliveries (Hàng sắp về)**, chọn lô hàng PO thầu đang giao tới.\n3. Kiểm tra chất lượng và số lượng thực tế giao. Nếu khớp 100%, chỉ cần bấm nút lớn màu xanh **Nhận Đủ Toàn Bộ (Mark All Received)** để hệ thống tự tăng lượng tồn khả dụng trong kho và hạ lượng hàng đang order.\n4. Nếu có hỏng hóc hoặc thiếu hụt, nhấp vào dòng mặt hàng đó để chỉnh tay số lượng nhận và tích chọn **Hao hụt/Hỏng**. Hệ thống sẽ tự tạo Exception gửi cho phòng thu mua đối soát!",
      tags: ["thủ kho", "nhận hàng", "nhập kho", "hao hụt", "warehouse"]
    },
    {
      q: "AI đàm phán giá thầu tự động hoạt động như thế nào?",
      a: "Sau khi gửi email RFQ đến các nhà thầu và nhận phản hồi, AI đàm phán của Stally sẽ tự bóc tách file chao_gia.pdf qua OCR. Nếu đơn giá sản phẩm cao hơn giá lịch sử hoặc mức kỳ vọng, AI sẽ tự soạn thảo một email đàm phán thương lượng giảm giá (Round 2, Round 3) dựa trên các luận điểm thuyết phục (cam kết số lượng đặt hàng định kỳ hàng tuần, đối chiếu giá thầu đối thủ). Nhân viên thu mua chỉ cần duyệt nội dung thư do AI soạn và bấm gửi để hoàn tất đàm phán giảm chi phí nhanh chóng!",
      tags: ["ai", "đàm phán", "thương lượng", "giảm giá", "sourcing", "rfq"]
    },
    {
      q: "Hệ thống tự động cảnh báo vơi kho và bù hàng ra sao?",
      a: "Hệ thống Stally giám sát liên tục số lượng tồn kho khả dụng của các nguyên liệu thiết yếu. Khi tồn kho của mặt hàng rơi xuống dưới mức an toàn tối thiểu (minStockLevel):\n1. Một cảnh báo màu đỏ sẽ sáng lên trong tab **Tổng Quan**.\n2. Hệ thống sẽ tự động đề xuất một thẻ bù kho nhanh. Bạn chỉ cần bấm nút **Tạo PR bù tồn nhanh** hoặc ra lệnh cho Chatbot AI: *'Tạo PR bù kho'*.\n3. AI sẽ tự động tính toán chính xác số lượng thâm hụt cần mua để đạt mức an toàn, soạn thảo PR nháp ở trạng thái **Draft** và chuyển bạn đến danh mục gửi thầu RFQ chỉ trong 1 chạm!",
      tags: ["cảnh báo", "vơi kho", "bù hàng", "tồn kho", "pr", "nháp"]
    }
  ];

  // --- FILTERED FAQS ---
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const query = searchQuery.toLowerCase();
    return faqs.filter(faq => 
      faq.q.toLowerCase().includes(query) || 
      faq.a.toLowerCase().includes(query) ||
      faq.tags.some(t => t.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // --- CONTEXTUAL ACTION LINKS BASED ON ACTIVE ROLE & TAB ---
  const contextualActions = useMemo(() => {
    const list: Array<{ title: string; tab: string; query: string; icon: any }> = [];

    if (currentRole === "requester") {
      list.push(
        { title: "➕ Tạo Yêu Cầu Mới", tab: "pr", query: "Tôi muốn mở danh mục Tạo Yêu Cầu và nhờ bạn hướng dẫn lập PR nháp.", icon: PlusCircle },
        { title: "📋 Lịch Sử Đặt Hàng", tab: "pr", query: "Cho tôi xem danh sách lịch sử yêu cầu PR mua nguyên liệu của bếp.", icon: History }
      );
    } else if (currentRole === "procurement") {
      list.push(
        { title: "⚖️ So Sánh Báo Giá RFQ", tab: "rfq", query: "Tôi muốn so sánh các báo giá thầu đang có trong phiên thầu hiện tại.", icon: GitMerge },
        { title: "🏢 Quản Lý Nhà Cung Cấp", tab: "suppliers", query: "Hãy hướng dẫn tôi cách quản lý và thêm nhà cung cấp mới vào CRM.", icon: Compass }
      );
    } else if (currentRole === "manager") {
      list.push(
        { title: "📊 Báo Cáo Tài Chính", tab: "overview", query: "Tóm tắt chi tiêu giải ngân PO và ngân sách nhóm hàng thực phẩm tháng này.", icon: Sparkles },
        { title: "📥 Hộp Duyệt PO Chờ", tab: "overview", query: "Có hồ sơ thầu nào đang chờ Giám Đốc duyệt ký PO khẩn cấp không?", icon: Bot }
      );
    } else if (currentRole === "warehouse") {
      list.push(
        { title: "🚚 Kiểm Tra Lô Hàng Sắp Về", tab: "inventory", query: "Kho sắp đón nhận các chuyến giao hàng PO nào hôm nay?", icon: Compass },
        { title: "🔧 Điều Chỉnh Tồn Kho Tay", tab: "inventory", query: "Làm thế nào để điều chỉnh lượng tồn bột gạo, dầu ăn khi có hao hụt?", icon: History }
      );
    }

    return list;
  }, [currentRole]);

  // --- SEND CHAT HANDLER ---
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || sending) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: textToSend
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setSending(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages.slice(-5), userMsg], // Pass last few messages for memory
          currentRole: currentRole
        })
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.message || "Không nhận được phản hồi từ AI Agent."
      }]);
    } catch (err) {
      console.error("Floating Chatbot response failed:", err);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "🚨 Máy chủ AI đang bận xử lý dữ liệu thầu thợ. Vui lòng thử gửi lại yêu cầu."
      }]);
    } finally {
      setSending(false);
    }
  };

  // --- CONFIRM DRAFT PR TRIGGER ---
  const handleConfirmDraft = (draftData: { title: string; priority: PriorityLevel; items: PurchaseRequestItem[] }, messageId: string) => {
    onCreatePr({
      title: draftData.title,
      priority: draftData.priority,
      requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: draftData.items
    });

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDraftConfirmed: true } : m));
    
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        role: "assistant",
        content: `🎉 Chúc mừng! Phiếu mua sắm nháp **"${draftData.title}"** đã được phê duyệt nộp thầu thành công ở trạng thái **Submitted**!\nBan mua sắm có thể ngay lập tức tiến hành so khớp thầu thợ và gửi email RFQ tại tab **Thầu & Giá (RFQ)**.`
      }]);
    }, 450);
  };

  // --- PARSE MESSAGE WITH <DRAFT_ACTION> CARD ---
  const renderMessageContent = (msg: Message) => {
    const raw = msg.content;
    const regex = /<DRAFT_ACTION>([\s\S]*?)<\/DRAFT_ACTION>/;
    const match = raw.match(regex);

    if (match) {
      const cleanText = raw.replace(regex, "").trim();
      let draftData = null;
      try {
        draftData = JSON.parse(match[1]);
      } catch (e) {
        console.error("JSON parse failure in FloatingChatbot draft card:", e);
      }

      return (
        <div className="space-y-3">
          {cleanText && <p className="whitespace-pre-line text-primary-dark font-bold text-xs leading-relaxed">{cleanText}</p>}
          {draftData && (
            <div className={`border-2 rounded-[16px] p-3.5 transition-all duration-300 text-xs ${
              msg.isDraftConfirmed 
                ? "bg-slate-100/50 border-slate-300 text-slate-400" 
                : "bg-[#FFF8E7] border-primary-dark shadow-sm text-primary-dark"
            }`}>
              <div className="flex items-center justify-between border-b border-dashed border-primary-dark/20 pb-1.5 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <FilePlus2 className={`w-3.5 h-3.5 ${msg.isDraftConfirmed ? "text-slate-400" : "text-primary animate-pulse"}`} />
                  <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-primary-dark">DỰ THẢO PHIẾU PR MUA SẮM</span>
                </div>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                  msg.isDraftConfirmed ? "bg-slate-200 text-slate-400" : "bg-accent-gold text-primary-dark border border-primary-dark"
                }`}>
                  {draftData.priority || "Medium"}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="font-black text-primary-dark leading-snug">{draftData.title}</h4>
                <div className="space-y-1 pl-2 border-l-2 border-primary-dark/30 text-[10.5px]">
                  {draftData.items?.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-0.5">
                      <div className="flex items-center gap-1">
                        <ItemIcon name={it.name} size="sm" className="scale-75 opacity-80 border border-primary-dark/25" />
                        <span className="truncate max-w-[120px] font-bold">{it.name}</span>
                      </div>
                      <span className="font-mono font-black text-primary-dark">{it.quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between items-center text-[10px]">
                  <span className="text-[8px] font-mono text-slate-400">Draft-and-Confirm</span>
                  {msg.isDraftConfirmed ? (
                    <span className="text-success font-bold flex items-center gap-0.5">
                      <Check className="w-3.5 h-3.5" /> Đã duyệt tạo PR
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConfirmDraft(draftData, msg.id)}
                      className="bg-[#2BA8A2] hover:bg-[#1E8C86] text-white border border-primary-dark font-black p-1.5 px-3 rounded-full flex items-center gap-1 transition-all hover:scale-[1.03] active:scale-[0.95] cursor-pointer shadow-teal-glow text-[10px]"
                    >
                      <span>✓ Phát Hành PR Nháp</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return <p className="whitespace-pre-line text-primary-dark font-bold text-xs leading-relaxed">{raw}</p>;
  };

  // --- CONTEXT CLICK TRIGGER ---
  const handleContextActionClick = (act: { title: string; tab: string; query: string }) => {
    setActiveTab(act.tab);
    handleSendMessage(act.query);
  };

  return (
    <>
      {/* Floating Glassmorphic Mint Orb Bubble Button with active pulse */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-[#2BA8A2] hover:bg-[#3CC4BD] border-3 border-primary-dark text-white shadow-teal-glow rounded-full p-4 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center group animate-pulse"
        title="Trợ lý Stally Procurement AI"
      >
        <div className="relative">
          <Bot className="w-6 h-6 text-[#FFF8E7] group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#FFD23F] border-2 border-primary-dark" />
        </div>
        <div className="absolute right-16 bg-primary-dark text-white border-2 border-primary-dark text-[10px] font-black py-1.5 px-3 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-teal-glow">
          Chat với Trợ Lý Stally AI ⚡
        </div>
      </div>

      {/* Playful Floating Chatbot Window in Cream */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] sm:w-[380px] h-[550px] bg-cream border-3 border-primary-dark shadow-teal-glow rounded-[32px] flex flex-col overflow-hidden animate-fade-slide-up text-primary-dark font-sans">
          
          {/* Header in Gold Light */}
          <div className="p-4 border-b-3 border-primary-dark bg-[#FFE47A] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8.5 h-8.5 rounded-xl bg-white border-2 border-primary-dark flex items-center justify-center text-primary-dark font-bold relative shadow-sm">
                <Bot className="w-4 h-4 text-primary animate-bounce" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#FFD23F] border border-primary-dark" />
              </div>
              <div>
                <h3 className="text-xs font-black text-primary-dark flex items-center gap-1">
                  Stally Sourcing AI <Sparkles className="w-3.5 h-3.5 text-coral animate-pulse" />
                </h3>
                <span className="text-[8px] font-mono text-primary-dark/70 uppercase font-bold tracking-wider block">Hệ thống Trợ lý số hóa kho &amp; thầu</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-[#FFF8E7] rounded-xl text-primary-dark/70 hover:text-primary-dark transition-all cursor-pointer border-2 border-transparent hover:border-primary-dark/20"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Contextual Action Links (Pill-shaped) */}
          <div className="p-2 border-b-2 border-primary-dark/15 bg-white/40 flex gap-2 overflow-x-auto select-none no-scrollbar">
            {contextualActions.map((act, i) => {
              const Icon = act.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleContextActionClick(act)}
                  className="text-[9px] bg-white hover:bg-[#FFF8E7] border-2 border-primary-dark px-3 py-1.5 rounded-full text-primary-dark font-black transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Icon className="w-3 h-3 text-[#2BA8A2]" />
                  <span>{act.title}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation Panel Tabs (Pills) */}
          <div className="flex border-b-2 border-primary-dark/15 bg-white/20 p-1.5 gap-1.5">
            <button
              onClick={() => setActiveTabPanel("chat")}
              className={`flex-1 py-2 rounded-full font-black text-xs flex items-center justify-center gap-1.5 transition-all border-2 ${
                activeTabPanel === "chat" 
                  ? "bg-[#FFE47A] text-primary-dark border-primary-dark shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-white/30"
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-[#2BA8A2]" /> Trò Chuyện AI
            </button>
            <button
              onClick={() => setActiveTabPanel("faq")}
              className={`flex-1 py-2 rounded-full font-black text-xs flex items-center justify-center gap-1.5 transition-all border-2 ${
                activeTabPanel === "faq" 
                  ? "bg-[#FFE47A] text-primary-dark border-primary-dark shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-white/30"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#2BA8A2]" /> Thẩm Định &amp; FAQ
            </button>
          </div>

          {/* Body Content Panels */}
          <div className="flex-1 overflow-y-auto p-4 bg-white/20 flex flex-col relative">
            
            {/* PANEL 1: AI CHAT FEED */}
            {activeTabPanel === "chat" && (
              <div className="flex-1 flex flex-col justify-between h-full">
                <div className="flex-1 space-y-3.5 overflow-y-auto pr-1">
                  {messages.map((msg) => {
                    const isBot = msg.role === "assistant";
                    return (
                      <div 
                        key={msg.id}
                        className={`flex items-start space-x-2.5 max-w-[90%] ${isBot ? "" : "ml-auto flex-row-reverse space-x-reverse"}`}
                      >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 shadow-sm ${
                          isBot 
                            ? "bg-white border-primary-dark text-[#2BA8A2]" 
                            : "bg-[#2BA8A2] border-primary-dark text-white"
                        }`}>
                          {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>

                        {/* Bubble */}
                        <div className={`p-3 rounded-[20px] text-[11px] border-2 leading-relaxed shadow-card ${
                          isBot 
                            ? "bg-white border-primary-dark text-primary-dark rounded-tl-none" 
                            : "bg-[#E8F6F5] border-primary-dark text-primary-dark rounded-tr-none shadow-teal-glow"
                        }`}>
                          {renderMessageContent(msg)}
                        </div>
                      </div>
                    );
                  })}

                  {sending && (
                    <div className="flex items-start space-x-2.5 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-white border-2 border-primary-dark text-[#2BA8A2] flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="p-3 rounded-[20px] text-[10.5px] bg-white border-2 border-primary-dark text-slate-500 rounded-tl-none flex items-center gap-1.5 shadow-sm font-bold">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2BA8A2]" />
                        <span>AI Agent đang rà soát tồn kho...</span>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>

                {/* Chat Action Send Form */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(inputValue);
                  }}
                  className="mt-3 flex gap-2 border-t-2 border-dashed border-primary-dark/20 pt-3 shrink-0"
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Hỏi kho, thầu, hoặc yêu cầu mua hàng..."
                    className="flex-1 bg-white border-2 border-primary-dark focus:outline-none focus:border-[#2BA8A2] rounded-full p-2.5 px-4 text-xs text-primary-dark placeholder-slate-400 font-bold shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || sending}
                    className={`p-2.5 px-4 rounded-full border-2 border-primary-dark font-black text-xs flex items-center gap-1 transition-all cursor-pointer shadow-teal-glow ${
                      !inputValue.trim() || sending
                        ? "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed shadow-none"
                        : "bg-[#2BA8A2] hover:bg-[#1E8C86] text-white hover:scale-[1.03] active:scale-[0.95]"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* PANEL 2: INTERACTIVE FAQ KNOWLEDGE BASE */}
            {activeTabPanel === "faq" && (
              <div className="space-y-3.5 flex-1 flex flex-col h-full">
                
                {/* Search box */}
                <div className="relative shrink-0">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setExpandedFaqIndex(null);
                    }}
                    placeholder="Tìm kiếm tài liệu HD vận hành..."
                    className="w-full bg-white border-2 border-primary-dark focus:outline-none focus:border-[#2BA8A2] rounded-full p-2.5 pl-10 text-xs text-primary-dark placeholder-slate-400 font-bold shadow-inner"
                  />
                  <Search className="absolute left-4 top-3 w-4 h-4 text-primary" />
                </div>

                {/* FAQ List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[330px] pr-1">
                  {filteredFaqs.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                      <ShieldAlert className="w-8 h-8 text-coral animate-bounce" />
                      <p className="text-xs font-black text-primary-dark">Không tìm thấy tài liệu liên quan</p>
                      <p className="text-[10px] max-w-[180px] mx-auto text-slate-400 font-bold">Thử gõ các từ khóa đơn giản: kho, ncc, duyệt, đàm phán, po.</p>
                    </div>
                  ) : (
                    filteredFaqs.map((faq, idx) => {
                      const isExpanded = expandedFaqIndex === idx;
                      return (
                        <div 
                          key={idx}
                          className={`border-2 rounded-[16px] transition-all duration-200 overflow-hidden ${
                            isExpanded 
                              ? "bg-[#FFF8E7] border-primary-dark shadow-sm" 
                              : "bg-white border-primary-dark/10 hover:border-primary-dark hover:bg-[#FFF8E7]/30"
                          }`}
                        >
                          <div 
                            onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                            className="p-3 flex justify-between items-center cursor-pointer select-none text-xs font-extrabold text-primary-dark"
                          >
                            <span className="leading-snug pr-2">{faq.q}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-[#2BA8A2] shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                          </div>

                          {isExpanded && (
                            <div className="p-3 pt-0 border-t-2 border-dashed border-primary-dark/20 text-[10.5px] text-slate-600 leading-relaxed whitespace-pre-line bg-white/20 font-bold font-sans">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Guide info */}
                <div className="bg-[#E8F6F5] border-2 border-primary-dark p-2.5 rounded-[16px] text-[9.5px] text-primary-dark flex items-center gap-2 shadow-inner shrink-0 font-bold">
                  <Compass className="w-4 h-4 text-[#2BA8A2] shrink-0" />
                  <span>Mẹo: Chuyển đổi giữa các Vai trò bên dưới Sidebar để kiểm nghiệm toàn bộ quy trình isolated.</span>
                </div>

              </div>
            )}

          </div>

        </div>
      )}
    </>
  );
}
