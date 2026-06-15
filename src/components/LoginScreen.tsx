import React, { useEffect, useState } from "react";
import { apiUrl } from "../config";
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
    fetch(apiUrl("/api/v1/auth/config"))
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
        const res = await fetch(apiUrl(`/api/v1/me?email=${encodeURIComponent(loginEmail.trim())}`), {
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
    <div className="min-h-screen stally-lux-shell flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="stally-flow-lines" />

      <div className="w-full max-w-6xl lux-card relative z-10 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        
        {/* Left Dynamic Selector Column */}
        <div className="lg:col-span-7 p-8 md:p-12 flex flex-col justify-between border-r border-primary-dark/10">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-full bg-accent-gold text-primary-dark flex items-center justify-center font-display text-2xl border border-primary-dark/10">S</div>
              <div>
                <div className="font-display text-3xl leading-none tracking-tight text-primary-dark">Stally</div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-primary-dark/45 font-bold mt-1">Procurement OS</div>
              </div>
            </div>

            <div className="mt-4 text-center sm:text-left">
              <h2 className="text-4xl md:text-5xl font-normal text-primary-dark font-display tracking-tight leading-[0.95] max-w-xl">
                Điều phối mua sắm và cung ứng bằng AI.
              </h2>
              <p className="text-primary-dark/60 text-sm mt-5 max-w-lg leading-relaxed font-medium">
                Chọn vai trò nghiệp vụ để vào đúng workspace: tạo PR, gửi RFQ Gmail, đàm phán, duyệt PO và nhập kho.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              {roles.map((r) => {
                const isSelected = selectedRole === r.id;
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => !emailRoleAuthEnabled && setSelectedRole(r.id)}
                    disabled={emailRoleAuthEnabled}
                    className={`p-4 rounded-3xl border text-left cursor-pointer transition-all duration-200 relative ${
                      isSelected 
                        ? "border-accent-gold bg-[#F7F0E4] shadow-accent-glow" 
                        : "border-primary-dark/10 bg-white hover:border-accent-gold/70 hover:bg-[#FAF8F3]"
                    }`}
                  >
                    {/* Left state accent bar */}
                    <div className="absolute top-4 bottom-4 left-0 w-1 rounded-r-full bg-accent-gold" />
                    
                    <div className="flex items-center space-x-3 pl-1.5">
                      <div className="w-10 h-10 rounded-full bg-primary-bg text-primary-dark flex items-center justify-center border border-primary-dark/10 shrink-0">
                        <Icon className="w-4 h-4 text-primary-dark/80" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-primary-dark">{r.title}</p>
                        <p className="text-[11px] text-primary-dark/50 font-medium truncate">{r.name}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3 shrink-0 bg-accent-gold text-primary-dark rounded-full border border-primary-dark/10 p-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-primary-dark/10 flex items-center justify-between text-[11px] text-primary-dark/45 font-bold uppercase tracking-[0.18em]">
            <span className="flex items-center gap-1.5">
              <FolderLock className="w-3.5 h-3.5" />
              Cách ly dữ liệu: org-1
            </span>
            <span className="font-mono font-medium">Stally ERP © 2026</span>
          </div>
        </div>

        {/* Right Preview & Action Column */}
        <div className="lg:col-span-5 p-8 md:p-10 bg-[#1A1A1A] text-white flex flex-col justify-between relative border-t lg:border-t-0 lg:border-l-0 border-primary-dark/10">
          {currentInfo ? (
            <div className="space-y-6 flex flex-col justify-between h-full">
              <div className="space-y-5">
                <div>
                  <span className="text-[9px] font-sans tracking-[0.28em] uppercase font-bold px-3 py-1 bg-white/10 border border-white/10 text-accent-light rounded-full">
                    Đặc Quyền Vai Trò
                  </span>
                  
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-12 h-12 rounded-full bg-accent-gold flex items-center justify-center text-primary shadow-lg">
                      <currentInfo.icon className="w-6 h-6 text-primary-dark" />
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-normal text-white tracking-tight">{currentInfo.title}</h3>
                      <p className="text-xs text-white/50 font-medium">{currentInfo.dept}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/8 border border-white/10 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-accent-gold" />
                    <span className="text-xs text-white/45 font-bold">Mã nhân sự:</span>
                    <span className="text-xs font-mono font-bold text-white">{currentInfo.name}</span>
                  </div>
                  <p className="text-sm text-white/68 leading-relaxed font-medium">
                    {currentInfo.desc}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-[0.22em] text-accent-light font-bold font-sans">
                    Nhiệm vụ nghiệp vụ khả dụng:
                  </h4>
                  <ul className="space-y-2">
                    {currentInfo.responsibilities.map((resTask, idx) => (
                      <li key={idx} className="flex items-center space-x-2.5 text-xs text-white/75 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
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
                      className="w-full bg-white hover:bg-cream text-primary-dark font-bold text-xs p-3.5 rounded-full cursor-pointer border border-white/20 transition-all duration-150 flex items-center justify-center gap-2 tracking-widest uppercase shadow-md"
                    >
                      <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-[11px] text-[#4285F4]">G</span>
                      ĐĂNG NHẬP BẰNG GOOGLE
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-white/20" />
                      <span className="text-[9px] text-white/45 font-bold uppercase">hoặc</span>
                      <div className="h-px flex-1 bg-white/20" />
                    </div>
                  </>
                )}
                {emailRoleAuthEnabled && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-accent-light font-bold">
                      Email được cấp quyền
                    </label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-white text-primary-dark border border-transparent rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-accent-gold"
                    />
                    <p className="text-[9px] text-white/55 leading-snug font-bold">
                      Đang bật phân quyền theo email. Role sẽ lấy từ Supabase, không chọn thủ công.
                    </p>
                  </div>
                )}
                {loginError && (
                  <div className="bg-coral/15 border border-coral text-coral-light rounded-xl p-2.5 text-[10px] font-bold">
                    {loginError}
                  </div>
                )}
                <button
                  type="submit"
                  id="btn-login"
                  disabled={checkingLogin}
                  className="w-full lux-button text-xs p-3.5 cursor-pointer flex items-center justify-center gap-2 tracking-widest uppercase shadow-accent-glow"
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
          <div className="w-full max-w-md lux-card p-6 md:p-7 text-slate-800 relative overflow-hidden">
            {/* Top color stripe */}
            <div className="absolute top-0 inset-x-0 h-1 bg-accent-gold" />
            
            <button 
              type="button"
              onClick={() => setShowQuestionModal(false)}
              className="absolute top-4 right-4 text-primary-dark hover:text-coral p-1 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-primary-dark/20"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-14 h-14 bg-cream border border-primary-dark/10 text-primary-dark rounded-full flex items-center justify-center shadow-accent-glow mb-4">
                <HelpCircle className="w-7 h-7 text-primary-dark" />
              </div>

              <h3 className="text-2xl font-normal text-primary-dark leading-tight font-display tracking-tight">
                Bạn đã biết sử dụng hệ thống này chưa?
              </h3>
              
              <div className="mt-2 text-xs text-primary-dark/70 leading-relaxed font-sans max-w-sm w-full">
                <p className="font-bold">
                  Nếu chưa quen, hệ thống sẽ mở tour cầm tay chỉ việc theo đúng vai trò: chỉ từng tab, từng nút cần bấm và thứ tự xử lý case.
                </p>
                <span className="block mt-2 bg-cream px-2.5 py-1.5 border border-primary-dark/10 rounded-full text-[10px] text-primary-dark font-bold font-mono">
                  BẮT ĐẦU: {currentInfo?.title} ({resolvedUser?.name || currentInfo?.name})
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectTutorialMode(true)}
                className="w-full lux-button p-3.5 cursor-pointer text-xs tracking-widest uppercase flex items-center justify-center gap-2"
              >
                CHƯA BIẾT - MỞ HƯỚNG DẪN
              </button>

              <button
                type="button"
                onClick={() => handleSelectTutorialMode(false)}
                className="w-full bg-white hover:bg-primary-dark hover:text-white border border-primary-dark/15 text-primary-dark p-3.5 rounded-full cursor-pointer text-xs font-bold tracking-widest uppercase transition-all duration-150 flex items-center justify-center gap-1.5"
              >
                BỎ QUA HƯỚNG DẪN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
