import React, { useEffect, useState } from "react";
import { User as AppUser, UserRole } from "../types";
import { 
  Utensils, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  TrendingUp, 
  Boxes, 
  User as UserIcon, 
  HelpCircle,
  FolderLock,
  X
} from "lucide-react";

interface LoginScreenProps {
  onLogin: (role: UserRole, wantsTutorial: boolean, user?: AppUser) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>("procurement");
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [emailRoleAuthEnabled, setEmailRoleAuthEnabled] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [googleOAuthAutoProvisionEnabled, setGoogleOAuthAutoProvisionEnabled] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [resolvedUser, setResolvedUser] = useState<AppUser | null>(null);
  const [loginError, setLoginError] = useState("");
  const [checkingLogin, setCheckingLogin] = useState(false);

  useEffect(() => {
    fetch("/api/v1/auth/config")
      .then(res => res.json())
      .then(data => {
        setEmailRoleAuthEnabled(Boolean(data.data?.emailRoleAuthEnabled));
        setGoogleOAuthEnabled(Boolean(data.data?.googleOAuthEnabled));
        setGoogleOAuthAutoProvisionEnabled(Boolean(data.data?.googleOAuthAutoProvisionEnabled));
      })
      .catch(() => setEmailRoleAuthEnabled(false));
  }, []);

  useEffect(() => {
    fetch("/api/v1/auth/session", {
      headers: { "X-Organization-Id": "org-1" }
    })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.data) {
          onLogin(data.data.role, false, data.data);
        }
      })
      .catch(() => {});
  }, [onLogin]);

  const roles = [
    {
      id: "requester" as UserRole,
      title: "Bếp Trưởng",
      name: "Trần Lý Bình",
      dept: "Khối Vận hành Nhà Hàng",
      icon: Utensils,
      color: "from-coral-light to-coral-dark",
      accentBorder: "border-coral",
      accentBg: "bg-coral-light/10",
      textAccent: "text-coral-dark",
      desc: "Chuyên trách quản lý bếp, định hình định mức, tạo yêu cầu mua sắm thực vật tư (PR) khi có thâm hụt.",
      responsibilities: ["Đề xuất thầu vật tư (PR)", "Dùng AI trợ lý tạo dự thảo", "Kiểm sát tồn khả dụng tối thiểu"]
    },
    {
      id: "procurement" as UserRole,
      title: "Trưởng Phòng Thu Mua",
      name: "Phan Công Tâm",
      dept: "Ban Procurement & Sourcing",
      icon: TrendingUp,
      color: "from-primary-light to-primary-dark",
      accentBorder: "border-primary",
      accentBg: "bg-primary-bg",
      textAccent: "text-primary-dark",
      desc: "Trực ban rà duyệt yêu cầu, gán cặp nhà cung cấp NCC ưu tú, phát thầu RFQ và đàm phán tối ưu biểu giá.",
      responsibilities: ["Gửi thầu RFQ cho NCC đối tác", "So sánh đơn thầu tự động", "Chuyển duyệt báo giá tối ưu lên CEO"]
    },
    {
      id: "manager" as UserRole,
      title: "Giám Đốc Phê Duyệt",
      name: "Nguyễn Thị Mai",
      dept: "Ban Giám Đốc (CEO)",
      icon: Building2,
      color: "from-accent-light to-accent-dark",
      accentBorder: "border-accent-gold",
      accentBg: "bg-accent-light/10",
      textAccent: "text-accent-dark",
      desc: "Phê duyệt các quyết toán đơn PO dựa trên bảng đối chiếu thầu thông minh đa chiều tự động do phòng mua sắm đệ trình.",
      responsibilities: ["Ký duyệt thầu chính thức (PO)", "Phân tích tài chính mua sắm tổng", "Bản đồ nhiệt chấm điểm NCC"]
    },
    {
      id: "warehouse" as UserRole,
      title: "Thủ Kho Trưởng",
      name: "Lý Văn Khoa",
      dept: "Tổ Kho & Cung Ứng Vật Tư",
      icon: Boxes,
      color: "from-sky-blue to-primary",
      accentBorder: "border-sky-blue",
      accentBg: "bg-sky-blue/10",
      textAccent: "text-sky-blue",
      desc: "Xác nhận nhận hàng thực tế dựa trên PO đã duyệt, kiểm kê hao hụt nguyên vật liệu định kỳ, kiểm duyệt nhật ký dòng kho.",
      responsibilities: ["Nhận hàng vật lý khớp PO thầu", "Cân đối điều chỉnh tồn hao hụt", "Nhật ký lưu kho luồng nhập xuất"]
    }
  ];

  const currentInfo = roles.find(r => r.id === selectedRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (emailRoleAuthEnabled) {
      if (!loginEmail.trim()) {
        setLoginError("Vui lòng nhập email đã được cấp quyền.");
        return;
      }

      setCheckingLogin(true);
      try {
        const res = await fetch(`/api/v1/me?email=${encodeURIComponent(loginEmail.trim())}`, {
          headers: { "X-Organization-Id": "org-1" }
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || "Email chưa được cấp quyền.");
        }
        setResolvedUser(data.data);
        setSelectedRole(data.data.role);
      } catch (err: any) {
        setLoginError(err.message || "Không xác thực được email.");
        return;
      } finally {
        setCheckingLogin(false);
      }
    }

    setShowQuestionModal(true);
  };

  const handleSelectTutorialMode = (wantsTutorial: boolean) => {
    setShowQuestionModal(false);
    onLogin(resolvedUser?.role || selectedRole, wantsTutorial, resolvedUser || undefined);
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/v1/auth/google/start";
  };

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Playful background decor */}
      <div className="absolute inset-0 bg-[radial-gradient(#2ba8a2_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
      
      {/* Dynamic blurred glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-bg rounded-full blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-light/20 rounded-full blur-3xl opacity-50 pointer-events-none" />

      <div className="w-full max-w-5xl bg-white rounded-3xl border-3 border-primary-dark shadow-card relative z-10 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[660px]">
        
        {/* Left Dynamic Selector Column */}
        <div className="lg:col-span-7 p-8 md:p-10 flex flex-col justify-between border-r-3 border-primary-dark">
          <div>
            {/* Playful Flip7 Style Logo Header */}
            <div className="flex flex-col items-center mb-8">
              {/* Fan Cards Background */}
              <div className="relative w-48 h-20 flex items-center justify-center mt-3">
                <div className="absolute w-12 h-18 bg-coral rounded-lg border-2 border-primary-dark rotate-[-24deg] -translate-x-12 shadow-md"></div>
                <div className="absolute w-12 h-18 bg-accent-gold rounded-lg border-2 border-primary-dark rotate-[-12deg] -translate-x-6 shadow-md"></div>
                <div className="absolute w-12 h-18 bg-cream rounded-lg border-2 border-primary-dark rotate-[0deg] shadow-md"></div>
                <div className="absolute w-12 h-18 bg-sky-blue rounded-lg border-2 border-primary-dark rotate-[12deg] translate-x-6 shadow-md"></div>
                <div className="absolute w-12 h-18 bg-primary rounded-lg border-2 border-primary-dark rotate-[24deg] translate-x-12 shadow-md"></div>
                
                {/* Skew parallelogram banner with text */}
                <div className="absolute bg-cream border-3 border-primary-dark px-4 py-2 skew-x-[-6deg] rotate-[-3deg] shadow-md w-64 text-center">
                  <span className="font-display font-black text-md tracking-widest text-primary-dark">STALLY B2B</span>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center sm:text-left">
              <h2 className="text-xl font-black text-primary-dark font-display tracking-tight leading-tight">
                Hệ Thống Điều Phối Mua Sắm & Cung Ứng STALLY
              </h2>
              <p className="text-primary-dark/85 text-xs mt-3 max-w-lg leading-relaxed font-medium">
                Chào mừng bạn đến với Cổng quản trị phân quyền chuỗi cung ứng STALLY. Vui lòng lựa chọn tài khoản tương ứng với vai trò nghiệp vụ để truy cập đúng phân hệ:
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
                    onClick={() => !emailRoleAuthEnabled && setSelectedRole(r.id)}
                    disabled={emailRoleAuthEnabled}
                    className={`p-4 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 relative transform ${
                      isSelected 
                        ? "border-primary-dark bg-cream shadow-accent-glow scale-[1.03]" 
                        : "border-primary-dark/20 bg-white hover:border-primary-dark/50 hover:scale-[1.01]"
                    }`}
                  >
                    {/* Left state accent bar */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 rounded-l-xl ${
                      r.id === "requester" ? "bg-coral" :
                      r.id === "procurement" ? "bg-primary" :
                      r.id === "manager" ? "bg-accent-gold" : "bg-sky-blue"
                    }`} />
                    
                    <div className="flex items-center space-x-3 pl-1.5">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${r.color} text-white flex items-center justify-center border-2 border-primary-dark shadow-sm shrink-0`}>
                        <Icon className="w-4 h-4 text-primary-dark" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-black text-primary-dark">{r.title}</p>
                        <p className="text-[10px] text-primary-dark/60 font-black truncate">{r.name}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3 shrink-0 bg-accent-gold text-primary-dark rounded-full border border-primary-dark p-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t-2 border-primary-dark/15 flex items-center justify-between text-[11px] text-primary-dark/60 font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <FolderLock className="w-3.5 h-3.5" />
              Cách ly dữ liệu: org-1
            </span>
            <span className="font-mono font-medium">Stally ERP © 2026</span>
          </div>
        </div>

        {/* Right Preview & Action Column */}
        <div className="lg:col-span-5 p-8 md:p-10 bg-primary-dark text-white flex flex-col justify-between relative border-t-3 lg:border-t-0 lg:border-l-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-light/10 rounded-full blur-2xl pointer-events-none" />
          
          {currentInfo ? (
            <div className="space-y-6 flex flex-col justify-between h-full">
              <div className="space-y-5">
                <div>
                  <span className="text-[9px] font-mono tracking-widest uppercase font-black px-3 py-1 bg-cream/20 border border-cream/30 text-accent-light rounded-full">
                    Đặc Quyền Vai Trò
                  </span>
                  
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-12 h-12 rounded-2xl bg-cream border-2 border-primary-dark flex items-center justify-center text-primary shadow-lg">
                      <currentInfo.icon className="w-6 h-6 text-primary-dark" />
                    </div>
                    <div>
                      <h3 className="text-md font-black text-white uppercase tracking-wider">{currentInfo.title}</h3>
                      <p className="text-xs text-accent-light font-bold">{currentInfo.dept}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-cream border-2 border-primary-dark p-5 rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-primary-dark" />
                    <span className="text-xs text-primary-dark/80 font-black">Mã nhân sự:</span>
                    <span className="text-xs font-mono font-bold text-primary-dark">{currentInfo.name}</span>
                  </div>
                  <p className="text-xs text-primary-dark/80 leading-relaxed font-bold">
                    {currentInfo.desc}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-wider text-accent-light font-black font-display">
                    Nhiệm vụ nghiệp vụ khả dụng:
                  </h4>
                  <ul className="space-y-2">
                    {currentInfo.responsibilities.map((resTask, idx) => (
                      <li key={idx} className="flex items-center space-x-2.5 text-xs text-white font-bold">
                        <span className="w-2 h-2 rounded-full bg-accent-gold border border-primary-dark shadow-accent-glow" />
                        <span>{resTask}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="pt-6 border-t border-white/20 space-y-3">
                {googleOAuthEnabled && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full bg-white hover:bg-cream text-primary-dark font-black text-xs p-3.5 rounded-full cursor-pointer border-2 border-primary-dark transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.95] flex items-center justify-center gap-2 tracking-widest uppercase shadow-md"
                    >
                      <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-[11px] text-[#4285F4]">G</span>
                      ĐĂNG NHẬP BẰNG GOOGLE
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-white/20" />
                      <span className="text-[9px] text-white/45 font-black uppercase">hoặc</span>
                      <div className="h-px flex-1 bg-white/20" />
                    </div>
                  </>
                )}
                {emailRoleAuthEnabled && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-accent-light font-black">
                      Email được cấp quyền
                    </label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-white text-primary-dark border-2 border-primary-dark rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-accent-gold"
                    />
                    <p className="text-[9px] text-white/55 leading-snug font-bold">
                      Đang bật phân quyền theo email. Role sẽ lấy từ Supabase, không chọn thủ công.
                    </p>
                  </div>
                )}
                {loginError && (
                  <div className="bg-coral/15 border border-coral text-coral-light rounded-xl p-2.5 text-[10px] font-black">
                    {loginError}
                  </div>
                )}
                <button
                  type="submit"
                  id="btn-login"
                  disabled={checkingLogin}
                  className="w-full bg-accent-gold hover:bg-accent-dark text-primary-dark font-black text-xs p-3.5 rounded-full cursor-pointer border-2 border-primary-dark transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.95] flex items-center justify-center gap-2 tracking-widest uppercase shadow-accent-glow"
                >
                  {checkingLogin ? "ĐANG KIỂM TRA EMAIL..." : "BẮT ĐẦU VẬN HÀNH"} <Sparkles className="w-4 h-4 text-primary-dark" />
                </button>
                <p className="text-[9px] text-center text-white/50 leading-none flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest">
                  <HelpCircle className="w-3.5 h-3.5" /> {googleOAuthEnabled ? googleOAuthAutoProvisionEnabled ? "Google OAuth: tự tạo user mới" : "Google OAuth + phân quyền Supabase" : emailRoleAuthEnabled ? "Phân quyền theo email" : "Test mode: chọn role nhanh"}
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
        <div id="onboarding-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
          <div className="w-full max-w-md bg-white border-3 border-primary-dark shadow-coral-glow rounded-3xl p-6 md:p-7 text-slate-800 relative overflow-hidden animate-crown-bounce">
            {/* Top color stripe */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-coral via-accent-gold to-primary" />
            
            <button 
              type="button"
              onClick={() => setShowQuestionModal(false)}
              className="absolute top-4 right-4 text-primary-dark hover:text-coral p-1 rounded-lg transition-colors cursor-pointer border-2 border-transparent hover:border-primary-dark/20"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-14 h-14 bg-cream border-2 border-primary-dark text-primary-dark rounded-2xl flex items-center justify-center shadow-accent-glow mb-4">
                <HelpCircle className="w-7 h-7 text-primary-dark" />
              </div>

              <h3 className="text-lg font-black text-primary-dark leading-tight font-display uppercase tracking-wide">
                Bạn đã biết sử dụng hệ thống này chưa?
              </h3>
              
              <div className="mt-2 text-xs text-primary-dark/70 leading-relaxed font-sans max-w-sm w-full">
                <span className="block mt-1 bg-cream px-2.5 py-1.5 border-2 border-primary-dark rounded-xl text-[10px] text-primary-dark font-black font-mono">
                  BẮT ĐẦU: {currentInfo?.title} ({resolvedUser?.name || currentInfo?.name})
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectTutorialMode(true)}
                className="w-full bg-primary hover:bg-primary-dark text-white p-3.5 rounded-full cursor-pointer text-xs font-black tracking-widest uppercase border-2 border-primary-dark shadow-teal-glow transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.95] flex items-center justify-center gap-2"
              >
                CHƯA BIẾT
              </button>

              <button
                type="button"
                onClick={() => handleSelectTutorialMode(false)}
                className="w-full bg-cream hover:bg-[#fff0cb] border-2 border-primary-dark text-primary-dark p-3.5 rounded-full cursor-pointer text-xs font-black tracking-widest uppercase transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.95] flex items-center justify-center gap-1.5"
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
