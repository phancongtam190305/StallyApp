import React, { useEffect, useState } from "react";
import { apiUrl } from "../config";
import { User as AppUser, UserRole } from "../types";
import { Sparkles, FolderLock } from "lucide-react";

interface LoginScreenProps {
  onLogin: (role: UserRole, wantsTutorial: boolean, user?: AppUser) => void;
  t: (key: any) => string;
  locale: "vi" | "en";
  setLocale: (locale: "vi" | "en") => void;
}

export default function LoginScreen({ onLogin, t, locale, setLocale }: LoginScreenProps) {
  const [emailRoleAuthEnabled, setEmailRoleAuthEnabled] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [googleOAuthAutoProvisionEnabled, setGoogleOAuthAutoProvisionEnabled] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    let role: UserRole = "procurement";
    let user: AppUser | undefined = undefined;

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
        role = data.data.role;
        user = data.data;
      } catch (err: any) {
        setLoginError(err.message || t("loginErrAuthFailed"));
        return;
      } finally {
        setCheckingLogin(false);
      }
    }

    onLogin(role, false, user);
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/v1/auth/google/start";
  };

  return (
    <div className="min-h-screen stally-lux-shell flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="stally-flow-lines" />

      <div className="w-full max-w-md lux-card relative z-10 p-8 md:p-10 shadow-2xl flex flex-col justify-between">
        {/* Language selector top-right inside login card */}
        <div className="absolute top-4 right-4 flex items-center bg-slate-100 rounded-2xl p-1 shadow-sm">
          <button
            type="button"
            id="login-btn-lang-vi"
            onClick={() => setLocale("vi")}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
              locale === "vi"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            VI
          </button>
          <button
            type="button"
            id="login-btn-lang-en"
            onClick={() => setLocale("en")}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
              locale === "en"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            EN
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-accent-gold text-primary-dark flex items-center justify-center font-display text-3xl border border-primary-dark/10 shadow-accent-glow mb-6">
            S
          </div>
          <h1 className="font-display text-4xl leading-none tracking-tight text-primary-dark font-extrabold">Stally</h1>
          <p className="text-[10px] uppercase tracking-[0.28em] text-primary-dark/45 font-bold mt-2">Procurement OS</p>

          <h2 className="text-xl font-bold text-primary-dark mt-8 leading-snug">
            {t("loginHeader")}
          </h2>
          <p className="text-primary-dark/60 text-xs mt-3 leading-relaxed max-w-sm">
            {t("loginDesc")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 pt-6 border-t border-primary-dark/10 space-y-4">
          {googleOAuthEnabled && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs p-3.5 rounded-2xl cursor-pointer border border-slate-200 transition-all duration-150 flex items-center justify-center gap-2 tracking-widest uppercase shadow-sm"
              >
                <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-[11px] text-[#4285F4]">G</span>
                {t("loginGoogle")}
              </button>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-primary-dark/10" />
                <span className="text-[9px] text-primary-dark/45 font-bold uppercase">{t("loginOr")}</span>
                <div className="h-px flex-1 bg-primary-dark/10" />
              </div>
            </>
          )}

          {emailRoleAuthEnabled && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-primary-dark/60 font-bold">
                {t("loginEmailLabel")}
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-white text-primary-dark border border-primary-dark/15 rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-accent-gold"
              />
              <p className="text-[9px] text-primary-dark/50 leading-snug font-medium">
                {t("loginEmailSubtext")}
              </p>
            </div>
          )}

          {loginError && (
            <div className="bg-coral/15 border border-coral text-coral-dark rounded-xl p-2.5 text-[10px] font-bold">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            id="btn-login"
            disabled={checkingLogin}
            className="w-full lux-button text-xs p-3.5 cursor-pointer flex items-center justify-center gap-2 tracking-widest uppercase shadow-accent-glow"
          >
            {checkingLogin ? t("loginCheckingEmail") : t("loginEnterWorkspace")} <Sparkles className="w-4 h-4 text-primary-dark" />
          </button>
        </form>      </div>
    </div>
  );
}
