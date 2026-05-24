import React from "react";
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  SendToBack, 
  Boxes, 
  Bot, 
  Building2, 
  ChevronRight,
  LogOut,
  FolderKey,
  ChevronLeft,
  GitMerge
} from "lucide-react";
import { UserRole } from "../types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: UserRole;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, currentRole, onLogout }: SidebarProps) {
  const allMenuItems = [
    { id: "overview", label: "Tổng quan Dashboard", icon: LayoutDashboard },
    { id: "cases", label: "Quy trình mua sắm (Cases)", icon: GitMerge },
    { id: "pr", label: "Yêu cầu mua (PR)", icon: FileSpreadsheet },
    { id: "rfq", label: "Đấu thầu & Giá (RFQ)", icon: SendToBack },
    { id: "suppliers", label: "Hồ sơ đối tác NCC", icon: Building2 },
    { id: "inventory", label: "Quản lý tồn kho", icon: Boxes },
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
    warehouse: "Thủ Kho",
    admin: "Quản Trị Viên (Admin)"
  };

  return (
    <aside className="w-72 bg-[#091e22] border-r border-[#1a383d] flex flex-col justify-between h-screen fixed top-0 left-0 text-slate-350 z-20 shadow-2xl">
      {/* Brand Section */}
      <div>
        <div className="p-6 border-b border-[#1a383d] flex items-center space-x-3 bg-gradient-to-r from-[#0d2a30] via-[#091e22] to-transparent">
          <div className="w-9 h-9 rounded-xl bg-[#82d3de] flex items-center justify-center shadow-lg text-[#003d44] font-extrabold text-lg font-display">
            S
          </div>
          <div>
            <h1 className="text-md font-black text-white font-display tracking-tight leading-none">STALLY PROCUREMENT</h1>
            <p className="text-[9px] text-[#82d3de] font-mono tracking-wider font-extrabold mt-1.5 uppercase">Enterprise Node</p>
          </div>
        </div>

        {/* Locked Profile Badge */}
        <div className="p-4 mx-4 mt-4 bg-[#0d262a] border border-[#1a3c42] rounded-xl flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#14b8a6]/25 flex items-center justify-center border border-[#14b8a6]/30 font-bold text-teal-400 text-xs">
            {roleLabels[currentRole]?.substring(0, 2)}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] text-slate-400 font-bold leading-none">Vai Trò Đăng Nhập</p>
            <p className="text-xs text-white font-black mt-1 truncate">{roleLabels[currentRole]}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5 mt-2">
          <div className="px-3 mb-2 text-[9px] font-bold text-[#82d3de]/50 uppercase tracking-widest font-display">Chức Năng Được Cấp Quyền</div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`btn-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-[#004d53] text-white border-l-4 border-[#82d3de] pl-2.5"
                    : "text-slate-300 hover:bg-[#0c282d] hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#82d3de]" : "text-slate-400 group-hover:text-white"}`} />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#82d3de]" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout & Tenant Context */}
      <div className="p-4 border-t border-[#1a383d] bg-[#061518]">
        {/* Simple Tenant Info */}
        <div className="mb-3 bg-[#091e22]/50 p-3 rounded-xl border border-[#1a383d]/60 flex items-center space-x-2.5">
          <FolderKey className="w-4 h-4 text-[#82d3de] shrink-0" />
          <div className="overflow-hidden">
            <p className="text-[9px] text-[#82d3de]/70 font-bold uppercase tracking-wider font-mono">Cách Ly Dữ Liệu</p>
            <p className="text-xs text-slate-200 font-bold truncate">Stally Food Group</p>
          </div>
        </div>

        {/* Logout Trigger button */}
        <button
          onClick={onLogout}
          id="btn-logout"
          className="w-full flex items-center justify-center space-x-2 p-2.5 bg-rose-950/45 hover:bg-rose-900/60 border border-rose-900/40 text-rose-300 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Đăng xuất hệ thống</span>
        </button>
      </div>
    </aside>
  );
}
