import React, { useEffect, useRef, useState } from "react";
import { apiUrl } from "../config";
import { User as AppUser, UserRole } from "../types";
import { 
  ArrowDown, 
  Utensils, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  TrendingUp, 
  Boxes, 
  User as UserIcon, 
  HelpCircle,
  FolderLock,
  X,
  MailCheck,
  ScanSearch,
  ClipboardCheck,
  Warehouse,
} from "lucide-react";

interface LoginScreenProps {
  onLogin: (role: UserRole, wantsTutorial: boolean, user?: AppUser) => void;
  t: (key: any) => string;
  locale: "vi" | "en";
  setLocale: (locale: "vi" | "en") => void;
}

export default function LoginScreen({ onLogin, t, locale, setLocale }: LoginScreenProps) {
  const loginPanelRef = useRef<HTMLDivElement>(null);
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
      title: "Người Yêu Cầu",
      name: "Trần Lý Bình",
      dept: "Khối Vận hành Nhà Hàng",
      icon: Utensils,
      desc: "Chuyên trách quản lý nhu cầu vận hành, định hình định mức, tạo yêu cầu mua sắm thực vật tư khi có thâm hụt.",
      responsibilities: ["Đề xuất yêu cầu mua hàng", "Dùng AI trợ lý tạo dự thảo", "Theo dõi tồn khả dụng tối thiểu"],
    },
    {
      id: "procurement" as UserRole,
      title: "Trưởng Phòng Thu Mua",
      name: "Phan Công Tâm",
      dept: "Ban Procurement & Sourcing",
      icon: TrendingUp,
      desc: "Chuẩn hóa yêu cầu, kiểm soát danh sách nhà cung cấp, phát thầu RFQ và giữ audit trail cho từng quyết định mua hàng.",
      responsibilities: ["Gửi RFQ có kiểm duyệt", "So sánh báo giá có red-flag", "Chuyển duyệt kèm dấu vết quyết định"],
    },
    {
      id: "manager" as UserRole,
      title: "Giám Đốc Phê Duyệt",
      name: "Nguyễn Thị Mai",
      dept: "Ban Giám Đốc",
      icon: Building2,
      desc: "Phê duyệt PO dựa trên bảng đối chiếu, cảnh báo rủi ro trích xuất và lịch sử trao đổi rõ ràng từ phòng mua hàng.",
      responsibilities: ["Ký duyệt PO có kiểm soát", "Xem spend trong 30 giây", "Truy vết lý do chọn NCC"],
    },
    {
      id: "warehouse" as UserRole,
      title: "Thủ Kho Trưởng",
      name: "Lý Văn Khoa",
      dept: "Tổ Kho & Cung Ứng Vật Tư",
      icon: Boxes,
      desc: "Xác nhận nhận hàng thực tế dựa trên PO đã duyệt, kiểm kê hao hụt nguyên vật liệu định kỳ và kiểm duyệt nhật ký dòng kho.",
      responsibilities: ["Nhận hàng vật lý khớp PO", "Cân đối điều chỉnh tồn hao hụt", "Nhật ký lưu kho luồng nhập xuất"],
    },
  ];

  const currentInfo = roles.find(r => r.id === selectedRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (emailRoleAuthEnabled) {
      if (!loginEmail.trim()) {
        setLoginError(t("loginErrEmailRequired"));
        return;
      }

      setCheckingLogin(true);
      try {
        const res = await fetch(apiUrl(`/api/v1/me?email=${encodeURIComponent(loginEmail.trim())}`), {
          headers: { "X-Organization-Id": "org-1" }
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || t("loginErrEmailUnauthorized"));
        }
        setResolvedUser(data.data);
        setSelectedRole(data.data.role);
      } catch (err: any) {
        setLoginError(err.message || t("loginErrAuthFailed"));
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

  const scrollToLogin = () => {
    loginPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen stally-lux-shell flex flex-col items-center relative overflow-hidden font-sans">
      <div className="stally-flow-lines" />

      <section className="relative z-10 w-full min-h-screen flex flex-col px-4 md:px-8 py-6 md:py-8">
        <nav className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={scrollToLogin}
            className="flex items-center gap-3 text-left cursor-pointer"
            aria-label="Cuộn xuống khu vực đăng nhập"
          >
            <div className="w-11 h-11 rounded-full bg-accent-gold text-primary-dark flex items-center justify-center font-display text-2xl border border-primary-dark/10 shadow-accent-glow">
              S
            </div>
            <div>
              <div className="font-display text-3xl leading-none tracking-tight text-primary-dark">Stally</div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-primary-dark/45 font-bold mt-1">Procurement OS</div>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-7 text-[11px] uppercase tracking-[0.22em] font-bold text-primary-dark/55">
            <button type="button" onClick={scrollToLogin} className="hover:text-primary-dark transition-colors cursor-pointer">Quy trình</button>
            <button type="button" onClick={scrollToLogin} className="hover:text-primary-dark transition-colors cursor-pointer">Vai trò</button>
            <button type="button" onClick={scrollToLogin} className="hover:text-primary-dark transition-colors cursor-pointer">Demo</button>
          </div>

          <button
            type="button"
            onClick={scrollToLogin}
            className="lux-button px-5 py-3 text-[11px] uppercase tracking-[0.18em] flex items-center gap-2"
          >
            Đăng nhập
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </nav>

        <div className="w-full max-w-7xl mx-auto flex-1 grid grid-cols-1 lg:grid-cols-[1.02fr_0.98fr] gap-10 lg:gap-14 items-center pt-14 pb-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-dark/10 bg-white/70 px-4 py-2 text-[10px] uppercase tracking-[0.22em] font-bold text-primary-dark/60">
              <Sparkles className="w-3.5 h-3.5 text-accent-dark" />
              AI Procurement Workflow
            </div>

            <h1 className="mt-7 font-display text-[clamp(3.4rem,8vw,8rem)] leading-[0.86] tracking-tight text-primary-dark max-w-4xl">
              Mua hàng rõ ràng từ yêu cầu đến nhập kho.
            </h1>

            <p className="mt-7 max-w-2xl text-base md:text-lg leading-8 text-primary-dark/62 font-medium">
              Stally chuẩn hóa yêu cầu mua hàng, gửi RFQ qua Gmail, đọc báo giá, cảnh báo rủi ro và giữ toàn bộ audit trail để đội vận hành ra quyết định nhanh mà vẫn kiểm soát được.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={scrollToLogin}
                className="lux-button px-7 py-4 text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
              >
                Bắt đầu vận hành
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={scrollToLogin}
                className="rounded-full border border-primary-dark/15 bg-white/75 px-7 py-4 text-xs uppercase tracking-[0.2em] font-bold text-primary-dark hover:bg-primary-dark hover:text-white transition-all duration-150 flex items-center justify-center gap-2"
              >
                Xem luồng demo
                <ScanSearch className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative min-h-[560px] hidden lg:block">
            <div className="absolute inset-0 rounded-[2rem] border border-primary-dark/10 bg-white/55 shadow-card backdrop-blur-xl" />
            <div className="absolute left-8 right-8 top-8 lux-panel p-5">
              <div className="flex items-center justify-between gap-4 border-b border-primary-dark/10 pb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-primary-dark/45 font-bold">Case đang xử lý</div>
                  <div className="mt-1 font-display text-2xl text-primary-dark">Gạo ST25 Cao Cấp</div>
                </div>
                <div className="rounded-full border border-accent-gold/50 bg-accent-light/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-dark">
                  RFQ
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ["NCC", "2"],
                  ["Best quote", "190k"],
                  ["ETA", "2 ngày"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-primary-dark/10 bg-white/72 p-4">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-primary-dark/40 font-bold">{label}</div>
                    <div className="mt-2 font-mono text-lg font-bold text-primary-dark">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute left-14 top-[245px] w-[48%] rounded-[1.5rem] border border-primary-dark/10 bg-[#1A1A1A] p-5 text-white shadow-card">
              <MailCheck className="w-5 h-5 text-accent-gold" />
              <div className="mt-4 text-[10px] uppercase tracking-[0.22em] text-white/45 font-bold">Gmail RFQ</div>
              <div className="mt-2 text-sm font-bold">Đã gửi yêu cầu báo giá thật</div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[78%] rounded-full bg-accent-gold" />
              </div>
            </div>

            <div className="absolute right-7 top-[310px] w-[46%] rounded-[1.5rem] border border-primary-dark/10 bg-white p-5 shadow-card">
              <ClipboardCheck className="w-5 h-5 text-accent-dark" />
              <div className="mt-4 text-[10px] uppercase tracking-[0.22em] text-primary-dark/45 font-bold">AI review</div>
              <div className="mt-2 text-sm font-bold text-primary-dark">Quote lỗi bị red-flag</div>
              <div className="mt-3 rounded-full border border-coral/30 bg-coral/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-coral-dark">
                cần kiểm tra
              </div>
            </div>

            <div className="absolute left-20 right-10 bottom-9 rounded-[1.5rem] border border-primary-dark/10 bg-white/88 p-5 shadow-card">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-accent-gold/25 border border-accent-gold/40 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-accent-dark" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-primary-dark/45 font-bold">Kho</div>
                    <div className="text-sm font-bold text-primary-dark">Nhập kho khớp PO</div>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-success">+2 kg</div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={scrollToLogin}
          className="mx-auto mb-4 flex items-center gap-2 rounded-full border border-primary-dark/10 bg-white/65 px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-bold text-primary-dark/55 hover:text-primary-dark hover:border-accent-gold/60 transition-colors cursor-pointer"
        >
          Cuộn xuống đăng nhập
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </section>

      <section ref={loginPanelRef} className="relative z-10 w-full px-4 md:px-8 py-10 md:py-16 scroll-mt-0">
      <div className="w-full max-w-6xl lux-card mx-auto relative z-10 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        
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
                Procurement OS cho doanh nghiệp cần kiểm soát, không chỉ tốc độ.
              </h2>
              <p className="text-primary-dark/60 text-sm mt-5 max-w-lg leading-relaxed font-medium">
                Chuẩn hóa yêu cầu mua hàng từ bộ phận yêu cầu, gửi RFQ có kiểm duyệt, đọc báo giá và giữ audit trail để CFO/COO nhìn rõ chi tiêu trong vài giây.
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

          <div className="mt-8 pt-6 border-t border-primary-dark/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-primary-dark/45 font-bold uppercase tracking-[0.18em]">
            <span className="flex items-center gap-1.5">
              <FolderLock className="w-3.5 h-3.5" />
              Cách ly dữ liệu: org-1
            </span>
            <button
              type="button"
              onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
              className="w-fit rounded-full border border-primary-dark/10 px-3 py-1 text-primary-dark/55 hover:text-primary-dark hover:border-accent-gold/50 transition-colors"
            >
              {locale === "vi" ? "VI" : "EN"}
            </button>
          </div>
        </div>

        {/* Right Preview & Action Column */}
        <div className="lg:col-span-5 p-8 md:p-10 bg-[#1A1A1A] text-white flex flex-col justify-between relative border-t lg:border-t-0 border-primary-dark/10">
          {currentInfo ? (
            <div className="space-y-6 flex flex-col justify-between h-full">
              <div className="space-y-5">
                <div>
                  <span className="text-[9px] tracking-[0.28em] uppercase font-bold px-3 py-1 bg-white/10 border border-white/10 text-accent-light rounded-full">
                    Đặc Quyền Vai Trò
                  </span>

                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-12 h-12 rounded-full bg-accent-gold flex items-center justify-center shadow-lg">
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
                    <span className="text-xs font-mono font-bold text-white">{resolvedUser?.name || currentInfo.name}</span>
                  </div>
                  <p className="text-sm text-white/68 leading-relaxed font-medium">
                    {currentInfo.desc}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-[0.22em] text-accent-light font-bold">
                    Nhiệm vụ nghiệp vụ khả dụng:
                  </h4>
                  <ul className="space-y-2">
                    {currentInfo.responsibilities.map((resTask, idx) => (
                      <li key={idx} className="flex items-center space-x-2.5 text-xs text-white/75 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold shrink-0" />
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
                      Đăng nhập bằng Google
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
                  className="w-full lux-button text-xs p-3.5 cursor-pointer flex items-center justify-center gap-2 tracking-widest uppercase shadow-accent-glow disabled:opacity-60 disabled:cursor-wait"
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
      </section>

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
