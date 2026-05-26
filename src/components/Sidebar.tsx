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
    <aside className="w-72 bg-[#0c2b29] border-r-3 border-primary-dark flex flex-col justify-between h-screen fixed top-0 left-0 text-slate-300 z-20 shadow-xl">
      {/* Brand Section */}
      <div>
        <div className="p-6 border-b border-[#135d5a] flex flex-col items-center">
          <div className="retro-ribbon w-full py-2.5 shadow-md flex items-center justify-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-accent-gold text-primary-dark flex items-center justify-center font-extrabold text-xs border border-primary-dark">S</span>
            <span className="font-display font-black text-[12px] tracking-widest text-[#1e8c86]">STALLY B2B</span>
          </div>
          <p className="text-[9px] text-accent-light font-mono tracking-widest font-extrabold mt-2.5 uppercase">Enterprise Node</p>
        </div>

        {/* Locked Profile Badge */}
        <div className="p-4 mx-4 mt-4 bg-cream border-2 border-primary-dark rounded-2xl flex items-center space-x-3 shadow-md shadow-primary/10">
          <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center border-2 border-primary-dark font-black text-xs shadow-teal-glow shrink-0">
            {roleLabels[currentRole]?.substring(0, 2)}
          </div>
          <div className="overflow-hidden">
            <p className="text-[9px] text-primary-dark/70 font-black leading-none uppercase tracking-wider">VẬN HÀNH</p>
            <p className="text-xs text-primary-dark font-black mt-1.5 truncate">{roleLabels[currentRole]}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-2 mt-4">
          <div className="px-3 mb-2 text-[9px] font-bold text-accent-light/50 uppercase tracking-widest font-display">CHỨC NĂNG CẤP PHÉP</div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`btn-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-xs font-black tracking-wider uppercase transition-all duration-200 cursor-pointer border-2 ${
                  isActive
                    ? "bg-accent-gold text-primary-dark border-primary-dark shadow-accent-glow transform scale-[1.02]"
                    : "text-white/90 border-transparent hover:bg-primary-light hover:text-white hover:scale-[1.01]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary-dark" : "text-accent-light"}`} />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary-dark animate-pulse" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout & Tenant Context */}
      <div className="p-4 border-t border-[#135d5a] bg-[#091f1e]">
        {/* Simple Tenant Info */}
        <div className="mb-3 bg-cream p-3 rounded-2xl border-2 border-primary-dark flex items-center space-x-2.5 shadow-sm">
          <FolderKey className="w-4 h-4 text-primary shrink-0" />
          <div className="overflow-hidden">
            <p className="text-[9px] text-primary-dark/70 font-bold uppercase tracking-wider font-mono">Cách Ly Dữ Liệu</p>
            <p className="text-xs text-primary-dark font-black truncate">Stally Food Group</p>
          </div>
        </div>

        {/* Logout Trigger button */}
        <button
          onClick={onLogout}
          id="btn-logout"
          className="w-full flex items-center justify-center space-x-2 p-2.5 bg-coral hover:bg-coral-dark border-2 border-primary-dark text-white text-xs font-black uppercase rounded-full tracking-wider transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-coral-glow"
        >
          <LogOut className="w-3.5 h-3.5 text-white shrink-0" />
          <span>Đăng xuất hệ thống</span>
        </button>
      </div>
    </aside>
  );
}
