import React from "react";
import { UserRole } from "../types";
import { 
  LayoutDashboard, 
  GitMerge, 
  FileSpreadsheet, 
  SendToBack, 
  Building2, 
  LogOut,
  ChevronRight
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: UserRole;
  onLogout: () => void;
  t: (key: any) => string;
}

export default function Sidebar({ activeTab, setActiveTab, onLogout, t }: SidebarProps) {
  const menuItems = [
    { id: "overview", label: t("dashboard"), icon: LayoutDashboard },
    { id: "cases", label: t("cases"), icon: GitMerge },
    { id: "pr", label: t("purchaseRequests"), icon: FileSpreadsheet },
    { id: "rfq", label: t("rfq"), icon: SendToBack },
    { id: "suppliers", label: t("suppliers"), icon: Building2 },
  ];

  return (
    <>
    <aside className="hidden lg:flex w-64 bg-[#111827] flex-col justify-between h-screen fixed top-0 left-0 text-white/75 z-20 shadow-2xl">
      {/* Brand Section */}
      <div>
        <div className="p-5 border-b border-white/10 flex flex-col items-center">
          <div className="w-full flex items-center justify-center gap-2">
            <span className="w-8 h-8 rounded-full bg-accent-gold text-primary-dark flex items-center justify-center font-display text-lg border border-white/10">S</span>
            <span className="font-display text-2xl tracking-tight text-white">Stally</span>
          </div>
          <p className="text-[9px] text-white/40 font-sans tracking-[0.24em] font-bold mt-2 uppercase">Procurement Audit OS</p>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`btn-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer border ${
                  isActive
                    ? "bg-accent-gold text-primary-dark border-accent-gold shadow-accent-glow"
                    : "text-white/75 border-transparent hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary-dark" : "text-accent-gold"}`} />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary-dark" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <button
          onClick={onLogout}
          id="btn-logout"
          className="w-full flex items-center justify-center space-x-2 p-2.5 bg-transparent hover:bg-white hover:text-primary-dark border border-white/20 text-white text-xs font-bold uppercase rounded-xl tracking-wider transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-white shrink-0" />
          <span>{t("logout")}</span>
        </button>
      </div>
    </aside>

    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111827]/95 backdrop-blur border-t border-white/10 px-2 py-2 flex items-center justify-between gap-1 text-white shadow-2xl">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            id={`btn-mobile-tab-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[9px] font-bold transition ${
              isActive ? "bg-accent-gold text-primary-dark" : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full">{item.label}</span>
          </button>
        );
      })}
      <button
        onClick={onLogout}
        id="btn-mobile-logout"
        className="w-10 shrink-0 flex items-center justify-center rounded-xl py-2 text-white/65 hover:bg-white/10 hover:text-white"
        title={t("logoutMobileTitle")}
      >
        <LogOut className="w-4 h-4" />
      </button>
    </nav>
    </>
  );
}
