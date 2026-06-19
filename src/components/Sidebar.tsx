import React from "react";
import { UserRole } from "../types";
import { 
  LayoutDashboard, 
  GitMerge, 
  FileSpreadsheet, 
  SendToBack, 
  Building2, 
  Boxes,
  LogOut,
  ChevronRight,
  FolderKey
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: UserRole;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, currentRole, onLogout }: SidebarProps) {
  const allMenuItems = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "cases", label: "Quy trình (Cases)", icon: GitMerge },
    { id: "pr", label: "Yêu cầu (PR)", icon: FileSpreadsheet },
    { id: "rfq", label: "Thầu & Giá (RFQ)", icon: SendToBack },
    { id: "suppliers", label: "Nhà cung cấp", icon: Building2 },
    { id: "inventory", label: "Tồn kho", icon: Boxes },
  ];

  // Role dynamic tabs definition
  const roleAllowedTabs: Record<UserRole, string[]> = {
    requester: ["overview", "cases", "pr", "inventory"],
    procurement: ["overview", "cases", "pr", "rfq", "suppliers"],
    manager: ["overview", "cases", "rfq", "suppliers", "inventory"],
    warehouse: ["overview", "inventory", "cases", "rfq"],
    admin: ["overview", "cases", "pr", "rfq", "suppliers", "inventory"]
  };

  const allowedTabIds = roleAllowedTabs[currentRole] || ["overview"];
  const menuItems = allMenuItems.filter(item => allowedTabIds.includes(item.id));

  const roleLabels: Record<UserRole, string> = {
    requester: "Bếp Trưởng",
    procurement: "Ban Mua Sắm",
    manager: "Giám Đốc (CEO)",
    warehouse: "Thủ Kho Trưởng",
    admin: "Quản Trị Viên"
  };

  return (
    <aside className="w-72 bg-[#1A1A1A] flex flex-col justify-between h-screen fixed top-0 left-0 text-white/75 z-20 shadow-2xl">
      {/* Brand Section */}
      <div>
        <div className="p-6 border-b border-white/10 flex flex-col items-center">
          <div className="w-full flex items-center justify-center gap-2">
            <span className="w-8 h-8 rounded-full bg-accent-gold text-primary-dark flex items-center justify-center font-display text-lg border border-white/10">S</span>
            <span className="font-display text-2xl tracking-tight text-white">Stally</span>
          </div>
          <p className="text-[9px] text-white/40 font-sans tracking-[0.28em] font-bold mt-2.5 uppercase">Procurement Audit OS</p>
        </div>

        {/* Locked Profile Badge */}
        <div className="p-4 mx-4 mt-4 bg-white/8 border border-white/10 rounded-3xl flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-accent-gold text-primary-dark flex items-center justify-center font-bold text-xs shrink-0">
            {roleLabels[currentRole]?.substring(0, 2)}
          </div>
          <div className="overflow-hidden">
            <p className="text-[9px] text-white/45 font-bold leading-none uppercase tracking-[0.22em]">Vận hành</p>
            <p className="text-sm text-white font-medium mt-1.5 truncate">{roleLabels[currentRole]}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-2 mt-4">
          <div className="px-3 mb-2 text-[9px] font-bold text-white/35 uppercase tracking-[0.25em] font-sans">Chức năng cấp phép</div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`btn-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer border ${
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

      {/* Logout & Tenant Context */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        {/* Simple Tenant Info */}
        <div className="mb-3 bg-white/8 p-3 rounded-2xl border border-white/10 flex items-center space-x-2.5">
          <FolderKey className="w-4 h-4 text-accent-gold shrink-0" />
          <div className="overflow-hidden">
            <p className="text-[9px] text-white/45 font-bold uppercase tracking-[0.22em] font-sans">Cách ly dữ liệu</p>
            <p className="text-xs text-white font-medium truncate">Multi-branch Procurement</p>
          </div>
        </div>

        {/* Logout Trigger button */}
        <button
          onClick={onLogout}
          id="btn-logout"
          className="w-full flex items-center justify-center space-x-2 p-2.5 bg-transparent hover:bg-white hover:text-primary-dark border border-white/20 text-white text-xs font-bold uppercase rounded-full tracking-wider transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-white shrink-0" />
          <span>Đăng xuất hệ thống</span>
        </button>
      </div>
    </aside>
  );
}
