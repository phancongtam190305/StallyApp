import React, { useState } from "react";
import { 
  UserRole 
} from "../types";
import { 
  Utensils, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  TrendingUp, 
  Boxes, 
  User, 
  Key,
  HelpCircle,
  FolderLock,
  X
} from "lucide-react";

interface LoginScreenProps {
  onLogin: (role: UserRole, wantsTutorial: boolean) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>("procurement");
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  const roles = [
    {
      id: "requester" as UserRole,
      title: "Bếp Trưởng",
      name: "Trần Lý Bình",
      dept: "Khối Vận hành Nhà Hàng",
      icon: Utensils,
      color: "from-amber-500 to-orange-600",
      bgClass: "hover:border-amber-400 bg-amber-50/20 text-neutral-800",
      textAccent: "text-amber-700",
      desc: "Chuyên trách quản lý bếp, định hình định mức, tạo yêu cầu mua sắm thực vật tư (PR) khi có thâm hụt.",
      responsibilities: ["Đề xuất thầu vật tư (PR)", "Dùng AI trợ lý tạo dự thảo", "Kiểm sát tồn khả dụng tối thiểu"]
    },
    {
      id: "procurement" as UserRole,
      title: "Trưởng Phòng Thu Mua",
      name: "Phan Công Tâm",
      dept: "Ban Procurement & Sourcing",
      icon: TrendingUp,
      color: "from-teal-500 to-emerald-600",
      bgClass: "hover:border-teal-400 bg-teal-50/20 text-neutral-800",
      textAccent: "text-teal-700",
      desc: "Trực ban rà duyệt yêu cầu, gán cặp nhà cung cấp NCC ưu tú, phát thầu RFQ và đàm phán tối ưu biểu giá.",
      responsibilities: ["Gửi thầu RFQ cho NCC đối tác", "So sánh đơn thầu tự động", "Chuyển duyệt báo giá tối ưu lên CEO"]
    },
    {
      id: "manager" as UserRole,
      title: "Giám Đốc Phê Duyệt",
      name: "Nguyễn Thị Mai",
      dept: "Ban Giám Đốc (CEO)",
      icon: Building2,
      color: "from-indigo-500 to-blue-600",
      bgClass: "hover:border-indigo-400 bg-indigo-50/20 text-neutral-800",
      textAccent: "text-indigo-700",
      desc: "Phê duyệt các quyết toán đơn PO dựa trên bảng đối chiếu thầu thông minh đa chiều tự động do phòng mua sắm đệ trình.",
      responsibilities: ["Ký duyệt thầu chính thức (PO)", "Phân tích tài chính mua sắm tổng", "Bản đồ nhiệt chấm điểm NCC"]
    },
    {
      id: "warehouse" as UserRole,
      title: "Thủ Kho Trưởng",
      name: "Lý Văn Khoa",
      dept: "Tổ Kho & Cung Ứng Vật Tư",
      icon: Boxes,
      color: "from-sky-500 to-cyan-600",
      bgClass: "hover:border-sky-400 bg-sky-50/20 text-neutral-800",
      textAccent: "text-sky-700",
      desc: "Xác nhận nhận hàng thực tế dựa trên PO đã duyệt, kiểm kê hao hụt nguyên vật liệu định kỳ, kiểm duyệt nhật ký dòng kho.",
      responsibilities: ["Nhận hàng vật lý khớp PO thầu", "Cân đối điều chỉnh tồn hao hụt", "Nhật ký lưu kho luồng nhập xuất"]
    }
  ];

  const currentInfo = roles.find(r => r.id === selectedRole);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowQuestionModal(true);
  };

  const handleSelectTutorialMode = (wantsTutorial: boolean) => {
    setShowQuestionModal(false);
    onLogin(selectedRole, wantsTutorial);
  };

  return (
    <div className="min-h-screen bg-[#f3f6f9] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative top grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e9f0_1px,transparent_1px),linear-gradient(to_bottom,#e5e9f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />
      
      {/* Dynamic blurred orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

      <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200/80 shadow-2xl relative z-10 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[660px]">
        
        {/* Left Interactive / Selectable Roles Column */}
        <div className="lg:col-span-7 p-8 md:p-10 flex flex-col justify-between border-r border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-[#00535b] text-white flex items-center justify-center font-extrabold text-sm shadow-md">
                S
              </div>
              <div className="font-display font-black text-slate-800 tracking-tight text-md">
                STALLY <span className="text-teal-600 font-bold">PROCUREMENT</span>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-black text-[#00535b] font-display tracking-tight leading-none">
                Hệ Thống Điều Phối Mua Sắm & Cung Ứng STALLY
              </h2>
              <p className="text-slate-500 text-xs mt-3 max-w-lg leading-relaxed">
                Chào mừng bạn đến với Cổng quản trị phân quyền chuỗi cung ứng STALLY. Vui lòng lựa chọn tài khoản tương ứng với vai trò nghiệp vụ của bạn để truy cập đúng các phân hệ chức năng:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {roles.map((r) => {
                const isSelected = selectedRole === r.id;
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRole(r.id)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 relative ${
                      isSelected 
                        ? "border-[#00535b] bg-slate-50 shadow-md ring-2 ring-teal-600/10 scale-[1.02]" 
                        : "border-slate-150 hover:border-slate-300 bg-white hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${r.color} text-white flex items-center justify-center shadow-lg shadow-teal-900/10 shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-black text-slate-800">{r.title}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{r.name}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3 shrink-0 bg-teal-600 text-white rounded-full p-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 fill-teal-600" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <FolderLock className="w-3.5 h-3.5 text-slate-400" />
              Isolated Multi-Tenant Node: org-1
            </span>
            <span className="font-mono font-medium">Stally ERP Enterprise © 2026</span>
          </div>
        </div>

        {/* Right Preview & Action Column */}
        <div className="lg:col-span-5 p-8 md:p-10 bg-gradient-to-br from-[#091e22] via-[#051518] to-[#040f11] text-white flex flex-col justify-between relative">
          {/* Subtle decor dots */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />
          
          {currentInfo ? (
            <div className="space-y-6 animate-fade-slide-up flex flex-col justify-between h-full">
              <div className="space-y-6">
                <div>
                  <span className={`text-[10px] font-mono tracking-widest uppercase font-extrabold px-3 py-1 bg-teal-950/80 border border-teal-850 text-teal-400 rounded-full`}>
                    Xem trước đặc quyền
                  </span>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-teal-400 shadow-xl">
                      <currentInfo.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-md font-bold text-white">{currentInfo.title}</h3>
                      <p className="text-xs text-slate-400">{currentInfo.dept}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-teal-400" />
                    <span className="text-xs text-slate-300 font-bold">Mã nhân sự:</span>
                    <span className="text-xs font-mono font-bold text-slate-100">{currentInfo.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    {currentInfo.desc}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold font-display">
                    Nhiệm vụ nghiệp vụ khả dụng:
                  </h4>
                  <ul className="space-y-2">
                    {currentInfo.responsibilities.map((resTask, idx) => (
                      <li key={idx} className="flex items-center space-x-2.5 text-xs text-slate-300 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                        <span>{resTask}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="pt-6 border-t border-white/10 space-y-3">
                <button
                  type="submit"
                  id="btn-login"
                  className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white font-black text-xs p-3.5 rounded-2xl cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 tracking-wide font-display shadow-lg shadow-teal-500/10"
                >
                  BẮT ĐẦU VẬN HÀNH <Sparkles className="w-4 h-4 text-white shrink-0 animate-pulse" />
                </button>
                <p className="text-[10px] text-center text-slate-500 leading-none flex items-center justify-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" /> Mật khẩu tự động điền (SSO)
                </p>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              Chọn một vị trí để hiển thị thông tin...
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Dialog Question Modal */}
      {showQuestionModal && (
        <div id="onboarding-modal" className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
          <div className="w-full max-w-md bg-white border border-slate-250/80 shadow-2xl rounded-3xl p-6 md:p-7 text-slate-800 relative overflow-hidden animate-bounce-short">
            {/* Top color strap */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 to-emerald-600" />
            
            <button 
              type="button"
              onClick={() => setShowQuestionModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-14 h-14 bg-teal-50 border border-teal-200 text-[#00535b] rounded-2.5xl flex items-center justify-center shadow-md mb-4 animate-pulse">
                <HelpCircle className="w-7 h-7 text-[#00535b]" />
              </div>

              <h3 className="text-lg font-black text-[#00535b] leading-tight font-display">
                Bạn đã biết cách sử dụng hệ thống này chưa?
              </h3>
              
              <div className="mt-2 text-xs text-slate-500 leading-relaxed font-sans max-w-sm w-full">
                <span className="block mt-1 bg-teal-50 px-2.5 py-1.5 border border-teal-150/40 rounded-lg text-[10px] text-teal-700 font-bold font-mono">
                  Vai trò của bạn: {currentInfo?.title} ({currentInfo?.name})
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectTutorialMode(true)}
                className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white p-3.5 rounded-2xl cursor-pointer text-xs font-black tracking-wide shadow-lg shadow-teal-500/10 transition-all duration-150 flex items-center justify-center gap-2"
              >
                CHƯA BIẾT
              </button>

              <button
                type="button"
                onClick={() => handleSelectTutorialMode(false)}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 p-3.5 rounded-2xl cursor-pointer text-xs font-bold tracking-wide transition-all duration-150 flex items-center justify-center gap-1.5"
              >
                TÔI ĐÃ BIẾT SỬ DỤNG RỒI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
