import React, { useState, useRef, useEffect } from "react";
import { apiUrl } from "../config";
import { 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  RefreshCw, 
  ArrowUpRight, 
  Check, 
  FilePlus2
} from "lucide-react";
import { PriorityLevel, PurchaseRequestItem } from "../types";
import ItemIcon from "./ItemIcon";
import MarkdownText from "./MarkdownText";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  isDraftConfirmed?: boolean;
}

interface ChatbotPanelProps {
  onCreatePr: (prData: { title: string; priority: PriorityLevel; requiredDate: string; items: PurchaseRequestItem[] }) => void;
  setActiveTab: (tab: string) => void;
}

export default function ChatbotPanel({ onCreatePr, setActiveTab }: ChatbotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "init", 
      role: "assistant", 
      content: `Xin chào! Tôi là **Stally Sourcing AI Agent** 🤖.

Tôi sẵn sàng hỗ trợ bạn quản lý kho và quy trình đặt hàng:
- Hỏi tôi: *"Sản phẩm nào cạn kho?"* để quét định vị tồn dưới an toàn.
- Hoặc yêu cầu: *"Đặt mua 80kg gạo ST25"* hoặc *"Lập PR mua 15 chai Dầu Ăn"*. 

Tôi hoạt động theo cơ chế **Draft-and-Confirm** an toàn tuyệt đối: Tôi sẽ soạn nháp trước, bạn chỉ cần một chạm bấm xác nhận để tự động tạo thầu lập tức trên hệ thống!` 
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const samplePrompts = [
    { title: "Kiểm tra kho vơi", prompt: "Sản phẩm nào đang sắp hết hàng trong kho?" },
    { title: "Mua 100kg Gạo ST25", prompt: "Tạo PR mua 100kg gạo ST25 khẩn cấp" },
    { title: "Đặt 40 chai Dầu ăn", prompt: "Lập phiếu mua 40 chai dầu ăn Tường An" }
  ];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

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
          messages: [...messages, userMsg],
          currentRole: "procurement"
        })
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.message || "Không có phản hồi từ máy chủ."
      }]);
    } catch (err) {
      console.error("Chatbot API response error", err);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "Hệ thống AI bận hoặc chưa nhận được phản hồi. Bạn có muốn gửi lại không?"
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmDraft = (draftData: { title: string; priority: PriorityLevel; items: PurchaseRequestItem[] }, messageId: string) => {
    // Call parent handler to create request document
    onCreatePr({
      title: draftData.title,
      priority: draftData.priority,
      requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: draftData.items
    });

    // Mark that draft has been successfully processed in list
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDraftConfirmed: true } : m));
    
    // Add quick bot alert
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        role: "assistant",
        content: `🎉 Tuyệt vời! Phiếu mua sắm **"${draftData.title}"** đã được phát hành thành công ở trạng thái **Submitted** (Đã lưu nháp).\nBan Mua Sắm đã nhận được phiếu thầu và có thể so khớp báo giá thầu tự động ngay tại tab **Thầu & Giá (RFQ)**.`
      }]);
    }, 400);
  };

  // Extract structured <DRAFT_ACTION> elements to display custom interactive cards
  const renderMessageContent = (msg: Message) => {
    const raw = msg.content;
    const regex = /<DRAFT_ACTION>([\s\S]*?)<\/DRAFT_ACTION>/;
    const match = raw.match(regex);

    if (match) {
      // Remove XML tags to render plain conversation message above
      const cleanText = raw.replace(regex, "").trim();
      let draftData = null;
      try {
        draftData = JSON.parse(match[1]);
      } catch (e) {
        console.error("Failed to parse JSON inside <DRAFT_ACTION>", e);
      }

      return (
        <div className="space-y-4 font-sans leading-relaxed text-slate-700">
          {cleanText && <div className="text-slate-700 font-medium"><MarkdownText text={cleanText} /></div>}
          
          {draftData && (
            <div className={`border rounded-2xl p-4 transition-all duration-300 ${
              msg.isDraftConfirmed 
                ? "bg-slate-100/50 border-slate-200 text-slate-500" 
                : "bg-amber-50/20 border-amber-200/50 shadow-sm text-slate-700"
            }`}>
              <div className="flex items-center justify-between border-b border-slate-150 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <FilePlus2 className={`w-4 h-4 ${msg.isDraftConfirmed ? "text-slate-400" : "text-accent-dark animate-pulse"}`} />
                  <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-accent-dark">DỰ THẢO THẦU MUA SẮM (PR)</span>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg uppercase font-mono ${
                  msg.isDraftConfirmed ? "bg-slate-200 text-slate-500" : "bg-amber-50 text-accent-dark"
                }`}>
                  {draftData.priority || "Medium"}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#1A1A1A]">{draftData.title}</h4>
                
                <div className="space-y-1.5 pl-2 border-l border-slate-200 text-[11px] font-medium text-slate-600">
                  {draftData.items?.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-0.5">
                      <div className="flex items-center gap-1.5">
                        <ItemIcon name={it.name} size="sm" className="shadow-sm scale-75 border-slate-200/30" />
                        <span>{it.name}</span>
                      </div>
                      <span className="font-mono text-slate-800 font-extrabold">{it.quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex justify-between items-center text-[10.5px]">
                  <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Draft-and-Confirm Engine</span>
                  
                  {msg.isDraftConfirmed ? (
                    <span className="text-slate-500 font-extrabold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" /> Đã tạo phiếu thầu
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConfirmDraft(draftData, msg.id)}
                      className="bg-primary-dark hover:bg-[#000000] text-white font-bold p-2 px-3 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>✓ Phát hành thầu tức thì</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return <div className="text-slate-700 font-medium"><MarkdownText text={raw} /></div>;
  };

  return (
    <div className="lux-card flex flex-col h-[600px] overflow-hidden relative animate-fade-slide-up">
      {/* Bot Header */}
      <div className="p-4 border-b border-slate-150 bg-[#F7F5F0]/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/50 flex items-center justify-center text-accent-dark font-bold relative shadow-sm">
            <Bot className="w-4 h-4" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              Bộ điều phối AI Sourcing Agent <Sparkles className="w-3 h-3 text-accent-dark" />
            </h3>
            <p className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1">
              <span>HỆ THỐNG TRỰC TUYẾN</span>
              <span>•</span>
              <span>GEMINI-2.5-FLASH</span>
            </p>
          </div>
        </div>
        <div>
          <button
            onClick={() => setMessages([messages[0]])}
            title="Khởi động lại cuộc chat"
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F7F5F0]/35">
        {messages.map((msg) => {
          const isBot = msg.role === "assistant";
          return (
            <div 
              key={msg.id}
              className={`flex items-start space-x-3 max-w-[85%] ${isBot ? "" : "ml-auto flex-row-reverse space-x-reverse"}`}
            >
              {/* Avatar circle */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                isBot 
                  ? "bg-amber-50 border-amber-200 text-accent-dark" 
                  : "bg-[#1A1A1A] border-amber-200 text-white"
              }`}>
                {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              {/* Message bubble */}
              <div className={`p-4 rounded-2xl text-[11.5px] border ${
                isBot 
                  ? "bg-white border-slate-150 text-slate-700 rounded-tl-none leading-relaxed shadow-sm" 
                  : "bg-amber-50 border-amber-200/50 text-[#1A1A1A] rounded-tr-none leading-relaxed shadow-sm"
              }`}>
                {renderMessageContent(msg)}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-start space-x-3 max-w-[80%]">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-accent-dark flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl text-[11.5px] bg-white border border-slate-150 text-slate-400 rounded-tl-none flex items-center gap-1.5 shadow-sm">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-dark" />
              <span className="font-medium">AI Sourcing Agent đang rà duyệt danh sách định mức...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Quick Prompts Panel */}
      <div className="px-5 pb-2 pt-1 border-t border-slate-150 bg-[#F7F5F0] flex flex-wrap gap-2 overflow-x-auto select-none">
        {samplePrompts.map((sp, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(sp.prompt)}
            className="text-[10px] bg-white hover:bg-[#F3D7A6]/35 border border-[#E6A756]/25 px-3 py-1.5 rounded-full text-slate-500 hover:text-accent-dark transition-all flex items-center gap-1 cursor-pointer font-bold"
          >
            <span>{sp.title}</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400" />
          </button>
        ))}
      </div>

      {/* Input box */}
      <div className="p-4 border-t border-slate-150 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            id="chatbot-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Gửi yêu cầu lập PR (ví dụ: 'Yêu cầu lập PR mua gạo ST25', 'Kho còn gì sắp hết?')..."
            className="flex-1 bg-white border border-slate-205 focus:outline-none focus:border-accent-gold rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 font-medium"
          />
          <button
            type="submit"
            id="btn-chatbot-send"
            disabled={!inputValue.trim() || sending}
            className={`p-3 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              !inputValue.trim() || sending
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-primary-dark hover:bg-[#000000] text-white"
            }`}
          >
            <Send className="w-3.5 h-3.5" /> Gửi
          </button>
        </form>
      </div>
    </div>
  );
}
