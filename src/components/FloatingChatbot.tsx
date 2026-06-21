import React, { useState, useRef, useEffect, useMemo } from "react";
import { apiUrl } from "../config";
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
import MarkdownText from "./MarkdownText";

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
  t: (key: any) => string;
  locale: "vi" | "en";
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
  onCreatePr,
  t,
  locale
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
        return t("floatWelcomeRequester");
      case "procurement":
        return t("floatWelcomeProcurement");
      case "manager":
        return t("floatWelcomeManager");
      case "warehouse":
        return t("floatWelcomeWarehouse");
      default:
        return t("floatWelcomeDefault");
    }
  }, [currentRole, t]);

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
  const faqs = useMemo((): FAQItem[] => {
    if (locale === "en") {
      return [
        {
          q: "What is the standard workflow for new users?",
          a: "The standard Stally workflow is:\n1. **Chef/Requester** checks inventory and creates a PR when restocking is needed.\n2. **Sourcing/Procurement** opens or creates a case, selects suppliers, drafts an AI RFQ, and sends a real Gmail.\n3. The system scans Gmail replies, extracts quotes, and updates the comparison table.\n4. Sourcing selects the best supplier, negotiates via AI, and submits a PO draft for approval.\n5. **Manager** approves or sends back for renegotiation.\n6. Sourcing sends the official PO.\n7. **Warehouse Clerk** confirms goods receipt, and stock levels are updated automatically.",
          tags: ["guide", "workflow", "onboarding", "new user"]
        },
        {
          q: "How does Chef/Requester create a purchase request?",
          a: "Go to the **Purchase Requests** tab to make a PR.\n1. Check the **Overview** tab first to see which items are low on stock.\n2. Create a PR with a title, priority level, required date, and items list.\n3. Submit the PR to the procurement team.\n4. Once the PO is fulfilled and warehouse clerk confirms receipt, check **Inventory** to see the updated quantity.",
          tags: ["requester", "chef", "pr", "request", "inventory"]
        },
        {
          q: "How does Procurement send a real Gmail RFQ?",
          a: "Go to the **Cases** tab, and open the case you want to process.\n1. Check or select suitable suppliers.\n2. Click draft RFQ with AI to create a draft email.\n3. Review and edit the contents if needed.\n4. Click **Send Sourcing Email via Gmail**. This sends a real email using the configured email credentials.\n5. Once sent, the case moves to awaiting quotes, and the dashboard tracks supplier replies.",
          tags: ["rfq", "gmail", "send email", "procurement", "case"]
        },
        {
          q: "How does receiving quotes from Gmail replies work?",
          a: "The system uses inbound Gmail polling.\n1. Suppliers reply directly to the RFQ thread containing the STALLY subject code.\n2. A background worker reads unread emails periodically.\n3. AI extracts the total amount, delivery date, payment terms, and attachments.\n4. The case quote comparison table is automatically updated.\n5. If not updated, verify the thread subject, check if the inbound worker is running, and wait for the next polling cycle.",
          tags: ["gmail", "reply", "quotes", "polling", "inbound", "dashboard"]
        },
        {
          q: "How does AI price negotiation work?",
          a: "In the case details under quotes, select a supplier to negotiate with and click draft negotiation email with AI.\n1. Choose your targets such as 5% discount, free shipping, or faster delivery.\n2. AI drafts a negotiation email based on current quote terms.\n3. Procurement reviews and hits send to email the supplier.\n4. When the supplier replies with agreement, the system updates the negotiated terms and pricing.\n5. If the reply is ambiguous, AI flags it for manual review.",
          tags: ["ai", "negotiate", "discount", "sourcing", "rfq"]
        },
        {
          q: "Where does the Manager approve POs?",
          a: "Sign in with the **Manager** role, then go to the **Overview** or **Cases** tab.\n1. Open cases marked as pending approval.\n2. Review the recommended supplier, total amount, schedule, terms, and negotiation log.\n3. Click approve if everything is correct.\n4. Click reject/renegotiate if terms need improvement.\n5. Once approved, procurement will issue the official PO to the supplier.",
          tags: ["manager", "approve", "po", "approval", "director"]
        },
        {
          q: "Does inventory update automatically when the warehouse clerk receives goods?",
          a: "Yes. When a PO has been issued and goods arrive, the warehouse clerk opens the receiving case and confirms the receipt quantities.\n1. The system automatically adds received quantities to available stock.\n2. Quantities on order are decreased accordingly.\n3. A stock movement ledger entry is written for audits.\n4. If discrepancies or damaged goods are found, use the manual adjustment form to record notes.",
          tags: ["warehouse", "receipt", "inventory", "stock", "po"]
        }
      ];
    }

    return [
      {
        q: "Tôi mới vào hệ thống thì đi theo luồng nào?",
        a: "Luồng chuẩn của Stally là:\n1. **Requester** kiểm tra tồn kho và tạo PR khi cần mua thêm.\n2. **Thu mua/Procurement** mở hoặc tạo case, chọn NCC, soạn RFQ bằng AI rồi gửi Gmail thật.\n3. Hệ thống đọc Gmail reply của NCC, trích xuất báo giá và cập nhật bảng so sánh.\n4. Thu mua chọn NCC tốt nhất, có thể đàm phán bằng AI, rồi trình duyệt PO.\n5. **Manager** duyệt hoặc trả về đàm phán.\n6. Thu mua gửi PO chính thức.\n7. **Thủ kho/Warehouse** xác nhận hàng về, hệ thống tự cập nhật tồn kho.",
        tags: ["hướng dẫn", "workflow", "luồng", "mới dùng", "onboarding"]
      },
      {
        q: "Requester tạo yêu cầu mua hàng như thế nào?",
        a: "Vào tab **Yêu cầu** để lập PR.\n1. Kiểm tra trước tab **Tổng quan** để biết mặt hàng nào đang thấp tồn.\n2. Tạo PR với tên nhu cầu, mức ưu tiên, ngày cần hàng và danh sách mặt hàng.\n3. Gửi PR cho phòng thu mua.\n4. Sau khi case đi hết quy trình PO và thủ kho nhận hàng, quay lại **Tồn kho** để kiểm tra số lượng đã tăng.",
        tags: ["requester", "bộ phận yêu cầu", "pr", "yêu cầu", "tồn kho"]
      },
      {
        q: "Thu mua gửi yêu cầu báo giá Gmail thật ra sao?",
        a: "Vào tab **Quy trình**, mở case cần xử lý.\n1. Kiểm tra hoặc chọn danh sách NCC phù hợp.\n2. Bấm AI soạn RFQ để tạo bản nháp email.\n3. Review nội dung, chỉnh nếu cần.\n4. Bấm **Gửi thầu Gmail chính thức**. Đây là gửi thật qua provider email đang cấu hình, không phải mô phỏng.\n5. Sau khi gửi, case chuyển sang trạng thái chờ phản hồi và dashboard sẽ theo dõi NCC nào đã reply.",
        tags: ["rfq", "gmail", "gửi mail", "procurement", "case"]
      },
      {
        q: "Nhận báo giá từ Gmail reply hoạt động như thế nào?",
        a: "Hệ thống đang dùng inbound Gmail polling.\n1. NCC reply vào email RFQ hoặc negotiation có subject đúng mã STALLY.\n2. Worker định kỳ đọc mail chưa xử lý.\n3. AI trích xuất tổng tiền, ngày giao, điều khoản công nợ và nội dung phản hồi.\n4. Dashboard trong case cập nhật bảng so sánh báo giá.\n5. Nếu chưa thấy cập nhật, kiểm tra mail có đúng thread/subject không, worker inbound có bật không, và chờ thêm một vòng polling.",
        tags: ["gmail", "reply", "báo giá", "polling", "inbound", "dashboard"]
      },
      {
        q: "AI đàm phán giá hoạt động như thế nào?",
        a: "Trong case có báo giá, chọn NCC cần thương lượng rồi bấm AI soạn thư đàm phán.\n1. Chọn mục tiêu như giảm 5%, giảm giá vận chuyển hoặc cải thiện ngày giao.\n2. AI tạo email negotiation dựa trên báo giá hiện tại.\n3. Thu mua phải review và bấm gửi thì email mới đi thật.\n4. Khi NCC reply đồng ý, hệ thống cập nhật trạng thái đàm phán và giá trên bảng so sánh.\n5. Nếu NCC chỉ trả lời chung chung, AI sẽ ghi nhận nội dung nhưng có thể cần người dùng kiểm tra lại trước khi trình duyệt.",
        tags: ["ai", "đàm phán", "thương lượng", "giảm giá", "sourcing", "rfq"]
      },
      {
        q: "Manager duyệt PO ở đâu?",
        a: "Đăng nhập vai trò **Manager**, vào **Tổng quan** hoặc **Quy trình**.\n1. Mở case đang ở trạng thái chờ duyệt.\n2. Kiểm tra NCC được đề xuất, tổng thanh toán, lịch giao, điều khoản và lịch sử đàm phán.\n3. Bấm duyệt nếu đạt yêu cầu.\n4. Nếu chưa ổn, trả về để thu mua tiếp tục đàm phán.\n5. Sau khi duyệt, thu mua sẽ tạo và gửi PO chính thức cho NCC.",
        tags: ["manager", "duyệt", "po", "approval", "giám đốc"]
      },
      {
        q: "Thủ kho xác nhận hàng về thì tồn kho có tự tăng không?",
        a: "Có. Khi PO đã gửi và hàng về, thủ kho mở case ở trạng thái nhận hàng rồi bấm xác nhận kiểm kho.\n1. Hệ thống tự cộng số lượng vào tồn khả dụng.\n2. Lượng hàng đang đặt sẽ giảm tương ứng.\n3. Một stock movement được ghi lại để đối soát.\n4. Nếu nhập lệch hoặc phát hiện hao hụt sau đó, dùng chức năng điều chỉnh tồn kho để ghi lý do.",
        tags: ["thủ kho", "warehouse", "nhập kho", "tồn kho", "po"]
      },
      {
        q: "Cào nhà cung cấp xong có tự đưa hết vào danh sách chính không?",
        a: "Không nên đưa hết tự động. Luồng đúng là:\n1. Thu mua chạy crawl/discovery theo nhóm hàng.\n2. Hệ thống hiển thị danh sách NCC đề xuất cùng nguồn, email, website và độ tin cậy nếu có.\n3. Người dùng chọn NCC phù hợp.\n4. Chỉ các NCC được chọn mới được thêm vào danh sách chính hoặc dùng để gửi RFQ.\n5. Với NCC thiếu email hoặc thông tin mơ hồ, nên kiểm tra thủ công trước khi gửi thư thật.",
        tags: ["crawl", "nhà cung cấp", "supplier", "ncc", "discovery"]
      },
      {
        q: "Hệ thống tự động cảnh báo vơi kho và bù hàng ra sao?",
        a: "Stally theo dõi tồn khả dụng và mức tồn tối thiểu của từng mặt hàng.\n1. Khi tồn dưới mức an toàn, tab **Tổng quan** hiển thị cảnh báo.\n2. Requester có thể tạo PR bù tồn từ cảnh báo hoặc nhờ AI soạn PR nháp.\n3. PR được gửi cho phòng thu mua để mở case, gửi RFQ và mua hàng.\n4. Khi thủ kho xác nhận nhận hàng, tồn kho tự cập nhật lại.",
        tags: ["cảnh báo", "vơi kho", "bù hàng", "tồn kho", "pr", "nháp"]
      }
    ];
  }, [locale]);

  // --- FILTERED FAQS ---
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const query = searchQuery.toLowerCase();
    return faqs.filter(faq => 
      faq.q.toLowerCase().includes(query) || 
      faq.a.toLowerCase().includes(query) ||
      faq.tags.some(t => t.toLowerCase().includes(query))
    );
  }, [searchQuery, faqs]);

  // --- CONTEXTUAL ACTION LINKS BASED ON ACTIVE ROLE & TAB ---
  const contextualActions = useMemo(() => {
    const list: Array<{ title: string; tab: string; query: string; icon: any }> = [];

    if (currentRole === "requester") {
      list.push(
        { title: locale === "en" ? "Create Request" : "Tạo Yêu Cầu Mới", tab: "pr", query: locale === "en" ? "Help me draft a PR request." : "Tôi muốn mở danh mục Tạo Yêu Cầu và nhờ bạn hướng dẫn lập PR nháp.", icon: PlusCircle },
        { title: locale === "en" ? "Order History" : "Lịch Sử Đặt Hàng", tab: "pr", query: locale === "en" ? "Show me my PR request history." : "Cho tôi xem danh sách lịch sử yêu cầu PR mua nguyên liệu của bộ phận yêu cầu.", icon: History }
      );
    } else if (currentRole === "procurement") {
      list.push(
        { title: locale === "en" ? "Case Workflow" : "Quy Trình Case", tab: "cases", query: locale === "en" ? "Explain the RFQ and PO workflow." : "Hãy hướng dẫn tôi xử lý một case từ gửi RFQ tới trình duyệt PO.", icon: GitMerge },
        { title: locale === "en" ? "Supplier Sourcing" : "Quản Lý NCC", tab: "suppliers", query: locale === "en" ? "Explain supplier discovery and management." : "Hãy hướng dẫn tôi cách quản lý, crawl và chọn nhà cung cấp vào danh sách chính.", icon: Compass }
      );
    } else if (currentRole === "manager") {
      list.push(
        { title: locale === "en" ? "Financial Overview" : "Báo Cáo Tài Chính", tab: "overview", query: locale === "en" ? "Summarize PO spend and budget status." : "Tóm tắt chi tiêu giải ngân PO và ngân sách nhóm hàng thực phẩm tháng này.", icon: Sparkles },
        { title: locale === "en" ? "Approve POs" : "Hộp Duyệt PO", tab: "cases", query: locale === "en" ? "Are there cases pending director approval?" : "Có hồ sơ thầu nào đang chờ Giám Đốc duyệt ký PO không?", icon: Bot }
      );
    } else if (currentRole === "warehouse") {
      list.push(
        { title: locale === "en" ? "Expected Deliveries" : "Lô Hàng Sắp Về", tab: "cases", query: locale === "en" ? "What incoming PO deliveries are expected today?" : "Kho sắp đón nhận các chuyến giao hàng PO nào hôm nay?", icon: Compass },
        { title: locale === "en" ? "Adjust Stock" : "Điều Chỉnh Tồn", tab: "inventory", query: locale === "en" ? "How can I adjust stock for losses?" : "Làm thế nào để điều chỉnh lượng tồn khi có hao hụt?", icon: History }
      );
    }

    return list;
  }, [currentRole, locale]);

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
      const response = await fetch(apiUrl("/api/ai/chat"), {
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
        content: data.message || t("chatbotErrResponse")
      }]);
    } catch (err) {
      console.error("Floating Chatbot response failed:", err);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: t("chatbotErrBusy")
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
        content: t("chatbotSuccessAlert").replace("{0}", draftData.title)
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
          {cleanText && <div className="text-primary-dark font-bold text-xs leading-relaxed"><MarkdownText text={cleanText} /></div>}
          {draftData && (
            <div className={`border rounded-[16px] p-3.5 transition-all duration-300 text-xs ${
              msg.isDraftConfirmed 
                ? "bg-slate-100/50 border-slate-300 text-slate-400" 
                : "bg-cream border-primary-dark/10 shadow-sm text-primary-dark"
            }`}>
              <div className="flex items-center justify-between border-b border-dashed border-primary-dark/20 pb-1.5 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <FilePlus2 className={`w-3.5 h-3.5 ${msg.isDraftConfirmed ? "text-slate-400" : "text-primary animate-pulse"}`} />
                  <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-primary-dark">{t("chatbotDraftTitle")}</span>
                </div>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                  msg.isDraftConfirmed ? "bg-slate-200 text-slate-400" : "bg-accent-gold text-primary-dark border border-primary-dark"
                }`}>
                  {draftData.priority || "Medium"}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-primary-dark leading-snug">{draftData.title}</h4>
                <div className="space-y-1 pl-2 border-l border-primary-dark/30 text-[10.5px]">
                  {draftData.items?.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-0.5">
                      <div className="flex items-center gap-1">
                        <ItemIcon name={it.name} size="sm" className="scale-75 opacity-80 border border-primary-dark/25" />
                        <span className="truncate max-w-[120px] font-bold">{it.name}</span>
                      </div>
                      <span className="font-mono font-bold text-primary-dark">{it.quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between items-center text-[10px]">
                  <span className="text-[8px] font-mono text-slate-400 font-bold">Draft-and-Confirm</span>
                  {msg.isDraftConfirmed ? (
                    <span className="text-success font-bold flex items-center gap-0.5">
                      <Check className="w-3.5 h-3.5" /> {t("chatbotDraftCreatedAlert")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConfirmDraft(draftData, msg.id)}
                      className="bg-accent-gold hover:bg-primary-dark hover:text-white text-primary-dark border border-primary-dark/10 font-bold p-1.5 px-3 rounded-full flex items-center gap-1 transition-all cursor-pointer shadow-accent-glow text-[10px]"
                    >
                      <span>{t("chatbotConfirmDraftButton")}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return <div className="text-primary-dark font-bold text-xs leading-relaxed"><MarkdownText text={raw} /></div>;
  };

  // --- CONTEXT CLICK TRIGGER ---
  const handleContextActionClick = (act: { title: string; tab: string; query: string }) => {
    setActiveTab(act.tab);
    handleSendMessage(act.query);
  };

  return (
    <>
      {/* Floating Glassmorphic Mint Orb Bubble Button with active pulse */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:flex fixed bottom-20 lg:bottom-5 right-5 z-50 bg-[#1A1A1A] hover:bg-accent-gold hover:text-primary-dark border border-white/20 text-white shadow-accent-glow rounded-2xl p-3.5 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer items-center justify-center group"
        title={t("floatTitle")}
        aria-label={isOpen ? t("floatTitle") : t("floatTitle")}
      >
        <div className="relative">
          <Bot className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent-gold border border-primary-dark" />
        </div>
        <div className="absolute right-16 bg-primary-dark text-white border border-white/10 text-[10px] font-bold py-1.5 px-3 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-accent-glow">
          {t("floatTitle")}
        </div>
      </button>

      {/* Playful Floating Chatbot Window in Cream */}
      {isOpen && (
        <div className="hidden sm:flex fixed bottom-36 lg:bottom-20 right-5 z-50 w-[320px] sm:w-[360px] h-[520px] lux-card flex-col overflow-hidden animate-fade-slide-up text-primary-dark font-sans">
          
          {/* Header in Gold Light */}
          <div className="p-4 border-b border-primary-dark/10 bg-[#1A1A1A] text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8.5 h-8.5 rounded-full bg-accent-gold flex items-center justify-center text-primary-dark font-bold relative shadow-sm">
                <Bot className="w-4 h-4 text-primary-dark" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border border-primary-dark" />
              </div>
              <div>
                <h3 className="text-sm font-display font-normal text-white flex items-center gap-1">
                  {t("floatTitle")} <Sparkles className="w-3.5 h-3.5 text-accent-gold" />
                </h3>
                <span className="text-[8px] font-mono text-white/45 uppercase font-bold tracking-wider block">{locale === "en" ? "Warehouse & Sourcing Assistant System" : "Hệ thống trợ lý kho & thầu"}</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/10"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Contextual Action Links (Pill-shaped) */}
          <div className="p-2 border-b border-primary-dark/10 bg-[#F7F5F0]/70 flex gap-2 overflow-x-auto select-none no-scrollbar">
            {contextualActions.map((act, i) => {
              const Icon = act.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleContextActionClick(act)}
                  className="text-[9px] bg-white hover:bg-primary-dark hover:text-white border border-primary-dark/10 px-3 py-1.5 rounded-full text-primary-dark font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
                >
                  <Icon className="w-3 h-3 text-accent-dark" />
                  <span>{act.title}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation Panel Tabs (Pills) */}
          <div className="flex border-b border-primary-dark/10 bg-white/35 p-1.5 gap-1.5">
            <button
              onClick={() => setActiveTabPanel("chat")}
              className={`flex-1 py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                activeTabPanel === "chat" 
                  ? "bg-accent-gold text-primary-dark border-accent-gold shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-white/30"
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-accent-dark" /> {t("floatTabChat")}
            </button>
            <button
              onClick={() => setActiveTabPanel("faq")}
              className={`flex-1 py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                activeTabPanel === "faq" 
                  ? "bg-accent-gold text-primary-dark border-accent-gold shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-white/30"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-accent-dark" /> {t("floatTabFaq")}
            </button>
          </div>

          {/* Body Content Panels */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#F7F5F0]/70 flex flex-col relative">
            
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
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-sm ${
                          isBot 
                            ? "bg-white border-primary-dark/10 text-accent-dark" 
                            : "bg-primary-dark border-primary-dark text-white"
                        }`}>
                          {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>

                        {/* Bubble */}
                        <div className={`p-3 rounded-[20px] text-[11px] border leading-relaxed shadow-card ${
                          isBot 
                            ? "bg-white border-primary-dark/10 text-primary-dark rounded-tl-none" 
                            : "bg-[#F2F0EA] border-primary-dark/10 text-primary-dark rounded-tr-none shadow-accent-glow"
                        }`}>
                          {renderMessageContent(msg)}
                        </div>
                      </div>
                    );
                  })}

                  {sending && (
                    <div className="flex items-start space-x-2.5 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-white border border-primary-dark/10 text-accent-dark flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="p-3 rounded-[20px] text-[10.5px] bg-white border border-primary-dark/10 text-slate-500 rounded-tl-none flex items-center gap-1.5 shadow-sm font-bold">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-dark" />
                        <span>{t("chatbotSystemResponseWaiting")}</span>
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
                  className="mt-3 flex gap-2 border-t border-dashed border-primary-dark/20 pt-3 shrink-0"
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={t("chatbotInputPlaceholder")}
                    className="flex-1 bg-white border border-primary-dark/10 focus:outline-none focus:border-accent-gold rounded-full p-2.5 px-4 text-xs text-primary-dark placeholder-slate-400 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || sending}
                    className={`p-2.5 px-4 rounded-full border border-primary-dark/10 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-accent-glow ${
                      !inputValue.trim() || sending
                        ? "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed shadow-none"
                        : "bg-accent-gold hover:bg-primary-dark text-primary-dark hover:text-white"
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
                    placeholder={t("floatSearchFaqPlaceholder")}
                    className="w-full bg-white border border-primary-dark/10 focus:outline-none focus:border-accent-gold rounded-full p-2.5 pl-10 text-xs text-primary-dark placeholder-slate-400 font-medium"
                  />
                  <Search className="absolute left-4 top-3 w-4 h-4 text-primary" />
                </div>

                {/* FAQ List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[330px] pr-1">
                  {filteredFaqs.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                      <ShieldAlert className="w-8 h-8 text-coral animate-bounce" />
                      <p className="text-xs font-bold text-primary-dark">{locale === "en" ? "No relevant guides found" : "Không tìm thấy tài liệu liên quan"}</p>
                      <p className="text-[10px] max-w-[180px] mx-auto text-slate-400 font-bold">{locale === "en" ? "Try keywords: stock, supplier, approve, PO." : "Thử gõ các từ khóa đơn giản: kho, ncc, duyệt, đàm phán, po."}</p>
                    </div>
                  ) : (
                    filteredFaqs.map((faq, idx) => {
                      const isExpanded = expandedFaqIndex === idx;
                      return (
                        <div 
                          key={idx}
                          className={`border rounded-[16px] transition-all duration-200 overflow-hidden ${
                            isExpanded 
                              ? "bg-cream border-accent-gold/60 shadow-sm" 
                              : "bg-white border-primary-dark/10 hover:border-accent-gold hover:bg-cream/50"
                          }`}
                        >
                          <div 
                            onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                            className="p-3 flex justify-between items-center cursor-pointer select-none text-xs font-extrabold text-primary-dark"
                          >
                            <span className="leading-snug pr-2">{faq.q}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-accent-dark shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                          </div>

                          {isExpanded && (
                            <div className="p-3 pt-0 border-t border-dashed border-primary-dark/20 text-[10.5px] text-slate-600 leading-relaxed bg-white/20 font-bold font-sans">
                              <MarkdownText text={faq.a} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Guide info */}
                <div className="bg-cream border border-primary-dark/10 p-2.5 rounded-[16px] text-[9.5px] text-primary-dark flex items-center gap-2 shrink-0 font-bold">
                  <Compass className="w-4 h-4 text-accent-dark shrink-0" />
                  <span>{locale === "en" ? "Tip: If new, log out and sign in again, then select TUTORIAL to learn." : "Mẹo: Nếu mới dùng, đăng nhập lại và chọn CHƯA BIẾT để mở tour chỉ từng nút theo vai trò."}</span>
                </div>

              </div>
            )}

          </div>

        </div>
      )}
    </>
  );
}
