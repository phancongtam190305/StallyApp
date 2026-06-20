import React, { useState, useEffect } from "react";
import { apiUrl } from "../config";
import { 
  Plus, 
  Search, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  SlidersHorizontal,
  ChevronRight,
  GitPullRequest,
  Coins,
  ShieldCheck,
  FileCheck,
  Calendar,
  Building,
  Info,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { UserRole, ProcurementCase, PurchaseRequestItem } from "../types";
import { useToast } from "../context/ToastContext";
import MetricCard from "./dashboard/MetricCard";

interface ProcurementDashboardProps {
  currentRole: UserRole;
  orgId: string;
  onSelectCase: (caseId: string) => void;
  isActive?: boolean;
  t: (key: any) => string;
}

export default function ProcurementDashboard({ 
  currentRole, 
  orgId, 
  onSelectCase,
  isActive = true,
  t
}: ProcurementDashboardProps) {

  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<ProcurementCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form fields for new thầu
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newRequiredDate, setNewRequiredDate] = useState("");
  const [initialItems, setInitialItems] = useState<Array<{ name: string; quantity: number; unit: string; notes: string }>>([
    { name: "", quantity: 1, unit: "kg", notes: "" }
  ]);
  const [creating, setCreating] = useState(false);

  const fetchCases = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch(apiUrl(`/api/v1/cases`), {
        headers: { "X-Organization-Id": orgId }
      });
      const data = await res.json();
      setCases(data.data || []);
      setLoading(false);
    } catch (e) {
      console.error(e);
      showToast(t("errLoadCases"), "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      fetchCases(cases.length > 0);
    }
  }, [orgId, isActive]);

  const lanes = [
    {
      id: "intake",
      title: t("laneIntakeTitle"),
      desc: t("laneIntakeDesc"),
      statuses: ["draft_request", "request_submitted", "request_validating"],
      bgColor: "bg-white/78 border border-primary-dark/10",
      accentColor: "border border-primary-dark/10 text-primary-dark bg-[#F2F0EA]"
    },
    {
      id: "sourcing",
      title: t("laneSourcingTitle"),
      desc: t("laneSourcingDesc"),
      statuses: ["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"],
      bgColor: "bg-white/78 border border-primary-dark/10",
      accentColor: "border border-primary-dark/10 text-primary-dark bg-[#F2F0EA]"
    },
    {
      id: "negotiation",
      title: t("laneNegotiationTitle"),
      desc: t("laneNegotiationDesc"),
      statuses: ["quote_review", "comparison_ready", "negotiating"],
      bgColor: "bg-white/78 border border-primary-dark/10",
      accentColor: "border border-primary-dark/10 text-primary-dark bg-[#F2F0EA]"
    },
    {
      id: "approval",
      title: t("laneApprovalTitle"),
      desc: t("laneApprovalDesc"),
      statuses: ["pending_approval", "approved", "po_draft"],
      bgColor: "bg-white/78 border border-primary-dark/10",
      accentColor: "border border-primary-dark/10 text-accent-dark bg-[#F2F0EA]"
    },
    {
      id: "fulfillment",
      title: t("laneFulfillmentTitle"),
      desc: t("laneFulfillmentDesc"),
      statuses: ["po_sent", "receiving", "closed", "cancelled", "exception"],
      bgColor: "bg-white/78 border border-primary-dark/10",
      accentColor: "border border-primary-dark/10 text-success bg-[#F2F0EA]"
    }
  ];

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
    
    return matchesSearch && matchesPriority;
  });

  const totalActiveCases = cases.filter(c => c.status !== "closed" && c.status !== "cancelled").length;
  const pendingApprovalCount = cases.filter(c => c.status === "pending_approval").length;
  const exceptionCount = cases.filter(c => c.status === "exception").length;
  const totalCompletedCount = cases.filter(c => c.status === "closed").length;

  const handleAddInitialItem = () => {
    setInitialItems(prev => [...prev, { name: "", quantity: 1, unit: "kg", notes: "" }]);
  };

  const handleRemoveInitialItem = (idx: number) => {
    if (initialItems.length === 1) return;
    setInitialItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemFieldChange = (idx: number, field: string, val: any) => {
    setInitialItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleCreateCase = async () => {
    if (!newTitle) {
      showToast(t("errCaseTitleEmpty"), "error");
      return;
    }
    const cleanItems = initialItems.filter(it => it.name.trim() !== "");
    if (cleanItems.length === 0) {
      showToast(t("errCaseItemsEmpty"), "error");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/cases`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({
          title: newTitle,
          priority: newPriority,
          requiredDate: newRequiredDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          requesterName: "Bếp Trưởng Bình",
          departmentName: t("deptKitchen") + " STALLY",
          createdFrom: "manual",
          items: cleanItems
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      showToast(t("successCaseCreated"), "success");
      setShowCreateModal(false);
      setNewTitle("");
      setInitialItems([{ name: "", quantity: 1, unit: "kg", notes: "" }]);
      fetchCases();
    } catch (e: any) {
      showToast(e.message || t("errCaseCreateFailed"), "error");
    } finally {
      setCreating(false);
    }
  };

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case "urgent": return "bg-coral-light/10 text-coral-dark border-coral";
      case "high": return "bg-accent-light/10 text-accent-dark border-accent-gold";
      case "medium": return "bg-primary-bg text-primary-dark border-primary";
      default: return "bg-slate-50 text-slate-650 border-slate-200";
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case "urgent": return t("casePriorityUrgent");
      case "high": return t("casePriorityHigh");
      case "medium": return t("casePriorityMedium");
      default: return t("casePriorityLow");
    }
  };

  const getStatusSimpleLabel = (s: string) => {
    return t(`status_${s}` as any);
  };

  return (
    <div className="flex-1 flex flex-col space-y-5 select-none overflow-hidden h-full">

      {/* KPI summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <MetricCard
          label={t("kpiCasesTitle")}
          value={totalActiveCases}
          subtitle={t("kpiCasesDesc")}
          icon={Layers}
          tone="neutral"
        />
        <MetricCard
          label={t("kpiPendingApprovalTitle")}
          value={pendingApprovalCount}
          subtitle={t("kpiPendingApprovalDesc")}
          icon={FileCheck}
          tone={pendingApprovalCount > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label={t("kpiExceptionTitle")}
          value={exceptionCount}
          subtitle={t("kpiExceptionDesc")}
          icon={AlertTriangle}
          tone={exceptionCount > 0 ? "danger" : "neutral"}
        />
        <MetricCard
          label={t("kpiClosedTitle")}
          value={totalCompletedCount}
          subtitle={t("kpiClosedDesc")}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      {/* Interactive Controls & Filters */}
      <div className="lux-card p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shrink-0">
        
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search (Cream Color Style) */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input 
              type="text" 
              placeholder={t("searchCasesPlaceholder")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-primary-dark/10 bg-[#F7F5F0] focus:border-accent-gold rounded-full text-xs font-medium text-primary-dark focus:outline-none transition-all"
            />
            <Search className="w-4 h-4 text-primary-dark/60 absolute left-3.5 top-3" />
          </div>

          {/* Priority filter */}
          <div className="flex items-center space-x-1.5 text-xs font-bold text-primary-dark">
            <SlidersHorizontal className="w-4 h-4 text-accent-dark" />
            <span>{t("priorityLabel")}</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="p-2 bg-[#F7F5F0] border border-primary-dark/10 rounded-full text-xs font-medium text-primary-dark focus:outline-none"
            >
              <option value="all">{t("priorityAll")}</option>
              <option value="urgent">{t("casePriorityUrgent")}</option>
              <option value="high">{t("casePriorityHigh")}</option>
              <option value="medium">{t("casePriorityMedium")}</option>
              <option value="low">{t("casePriorityLow")}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchCases}
            className="px-4 py-2.5 border border-primary-dark/15 bg-white hover:bg-primary-dark hover:text-white text-primary-dark font-bold text-xs rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("refreshBtn")}
          </button>
          
          <button
            id="btn-create-case"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 lux-button text-xs rounded-full flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 text-primary-dark" /> {t("createCaseBtn")}
          </button>
        </div>
      </div>

      {/* 5-Lane Kanban Board Layout (Responsive smooth-scrolling Board) */}
      <div
        data-testid="procurement-kanban-board"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 flex-1 pb-4 w-full select-none min-h-0 relative overflow-hidden"
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/55 backdrop-blur-[2px] flex items-center justify-center rounded-3xl border border-primary-dark/10">
            <div className="lux-card p-6 flex flex-col items-center gap-4 animate-scale-up">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-accent-dark animate-spin" />
                <Sparkles className="w-4 h-4 text-accent-gold absolute top-0 right-0 animate-bounce" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary-dark font-sans">{t("loadingCases")}</span>
            </div>
          </div>
        )}
        {lanes.map((lane) => {
          const laneCases = filteredCases.filter(c => lane.statuses.includes(c.status));
          
          return (
            <div 
              key={lane.id} 
              className={`min-w-0 p-3 rounded-2xl flex flex-col space-y-3 h-full overflow-hidden ${lane.bgColor} relative shadow-sm`}
            >
              {/* Lane Header */}
              <div className={`p-3 rounded-xl flex justify-between items-center ${lane.accentColor}`}>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-display font-bold tracking-tight truncate leading-none">{lane.title}</h4>
                  <span className="text-[8px] text-primary-dark/45 font-medium font-sans tracking-[0.2em] mt-1 block uppercase leading-none">{lane.desc}</span>
                </div>
                <span className="text-xs font-bold font-mono bg-white px-2 py-0.5 rounded-full border border-primary-dark/10 shadow-sm shrink-0">
                  {laneCases.length}
                </span>
              </div>

              {/* Lane Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
                {laneCases.map((c) => (
                  <div
                    key={c.id}
                    id={laneCases.indexOf(c) === 0 ? "case-card-first" : undefined}
                    onClick={() => onSelectCase(c.id)}
                    className="bg-white border border-primary-dark/10 p-3 rounded-2xl shadow-card hover:shadow-accent-glow transition-all cursor-pointer space-y-2.5 flex flex-col group relative overflow-hidden duration-200 border-l-4"
                    style={{
                      borderLeftColor: 
                        c.priority === "urgent" ? "#B85B3F" :
                        c.priority === "high" ? "#E6A756" : "#9A6A2F"
                    }}
                  >
                    {/* Top row priority & code */}
                    <div className="flex justify-between items-center text-[9px] font-bold">
                      <span className="text-primary-dark/45 font-mono tracking-wider">#{c.id.toUpperCase().split('-')[1]}</span>
                      <span className={`px-1.5 py-0.5 rounded-md border uppercase font-mono ${getPriorityBadgeColor(c.priority)}`}>
                        {getPriorityLabel(c.priority)}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h5 className="text-sm font-bold text-primary-dark tracking-tight leading-tight group-hover:text-accent-dark transition">
                        {c.title}
                      </h5>
                    </div>

                    {/* Items snippet (Cream background container) */}
                    <div className="bg-[#F7F5F0] border border-primary-dark/10 p-2 rounded-xl space-y-1.5">
                      <p className="text-[8px] font-bold text-primary-dark/45 uppercase tracking-widest leading-none">{t("itemsRequiredCount").replace("{count}", String(c.items.length))}</p>
                      <div className="space-y-0.5">
                        {c.items.slice(0, 2).map((it, idx) => (
                          <p key={idx} className="text-[10px] font-bold text-primary-dark truncate leading-normal">
                            {it.name} <span className="text-accent-dark font-bold font-mono">({it.quantity} {it.unit})</span>
                          </p>
                        ))}
                        {c.items.length > 2 && (
                          <p className="text-[9px] font-bold text-primary-dark/50 italic font-sans pl-2 leading-none">{t("moreItemsCount").replace("{count}", String(c.items.length - 2))}</p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Metadata row */}
                    <div className="flex justify-between items-center text-[9.5px] text-primary-dark/60 font-bold border-t border-primary-dark/10 pt-2 mt-1 uppercase tracking-wider">
                      <span className="truncate max-w-[90px]">{c.requesterName.split(' ')[0]}</span>
                      <span className="font-mono text-[8px] bg-cream px-2 py-0.5 rounded-full border border-primary-dark/10">{getStatusSimpleLabel(c.status)}</span>
                    </div>
                  </div>
                ))}

                {laneCases.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-primary-dark/15 rounded-3xl h-32 text-center text-primary-dark/40 font-bold text-[10px] space-y-1">
                    <FolderOpen className="w-6 h-6 text-primary-light" />
                    <span>{t("emptyLane")}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="lux-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
            
            {/* Modal Header using setup parallellogram design */}
            <div className="p-5 border-b border-primary-dark/10 flex justify-between items-center bg-cream">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-accent-dark" />
                <h3 className="text-xl font-normal text-primary-dark font-display tracking-tight">{t("createCaseModalTitle")}</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-primary-dark hover:text-coral font-bold font-mono text-sm cursor-pointer p-1.5 border border-transparent hover:border-primary-dark/15 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold text-primary-dark uppercase tracking-[0.22em]">{t("fieldCaseTitle")}</label>
                  <input 
                    type="text" 
                    placeholder={t("placeholderCaseTitle")}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="p-2.5 border border-primary-dark/10 bg-cream rounded-2xl text-xs font-medium text-primary-dark focus:outline-none focus:border-accent-gold"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold text-primary-dark uppercase tracking-[0.22em]">{t("fieldExpectedDelivery")}</label>
                  <input 
                    type="date" 
                    value={newRequiredDate}
                    onChange={e => setNewRequiredDate(e.target.value)}
                    className="p-2.5 border border-primary-dark/10 bg-cream rounded-2xl text-xs font-medium text-primary-dark focus:outline-none focus:border-accent-gold"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-bold text-primary-dark uppercase tracking-[0.22em]">{t("fieldCasePriority")}</label>
                <div className="grid grid-cols-4 gap-2 text-xs font-bold text-center uppercase tracking-wider">
                  {[
                    { val: "low", label: t("casePriorityLow") },
                    { val: "medium", label: t("casePriorityMedium") },
                    { val: "high", label: t("casePriorityHigh") },
                    { val: "urgent", label: t("casePriorityUrgent") }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setNewPriority(opt.val as any)}
                      className={`p-2 rounded-full border transition cursor-pointer ${
                        newPriority === opt.val 
                          ? "bg-accent-gold border-accent-gold text-primary-dark shadow-accent-glow" 
                          : "bg-white border-primary-dark/20 text-primary-dark/70 hover:bg-cream"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items checklist editor */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-primary-dark uppercase tracking-[0.22em]">{t("fieldInitialItems")}</label>
                  <button
                    onClick={handleAddInitialItem}
                    className="p-1 px-3 text-[10px] bg-primary-bg hover:bg-accent-gold border border-primary-dark/10 text-primary-dark font-bold uppercase rounded-full tracking-wider transition cursor-pointer"
                  >
                    {t("addInitialItemBtn")}
                  </button>
                </div>

                <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                  {initialItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-cream/50 p-3 rounded-3xl border border-primary-dark/10 relative">
                      <div className="sm:col-span-5 flex flex-col space-y-1">
                        <input 
                          type="text" 
                          placeholder={t("placeholderItemName")}
                          value={item.name}
                          onChange={e => handleItemFieldChange(idx, "name", e.target.value)}
                          className="p-2 border border-primary-dark/10 bg-cream focus:border-accent-gold rounded-2xl text-xs font-medium text-primary-dark focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3 flex flex-col space-y-1">
                        <input 
                          type="number" 
                          placeholder={t("placeholderItemQty")}
                          value={item.quantity}
                          onChange={e => handleItemFieldChange(idx, "quantity", Number(e.target.value))}
                          className="p-2 border border-primary-dark/10 bg-cream focus:border-accent-gold rounded-2xl text-xs font-mono font-bold text-center focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3 flex flex-col space-y-1">
                        <select 
                          value={item.unit}
                          onChange={e => handleItemFieldChange(idx, "unit", e.target.value)}
                          className="p-2 border border-primary-dark/10 bg-cream focus:border-accent-gold rounded-2xl text-xs font-bold text-primary-dark focus:outline-none"
                        >
                          <option value="kg">{t("optionUnitKg")}</option>
                          <option value="bao">{t("optionUnitBag")}</option>
                          <option value="hộp">{t("optionUnitBox")}</option>
                          <option value="chai">{t("optionUnitBottle")}</option>
                          <option value="đv">{t("optionUnitUnit")}</option>
                        </select>
                      </div>
                      <div className="sm:col-span-1 text-center">
                        <button
                          onClick={() => handleRemoveInitialItem(idx)}
                          disabled={initialItems.length === 1}
                          className="p-1.5 text-coral hover:bg-coral-light/10 border border-transparent hover:border-coral/40 rounded-xl transition disabled:opacity-30 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer (Pill Buttons) */}
            <div className="p-4 bg-cream border-t border-primary-dark flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-primary-dark/15 text-primary-dark font-bold text-xs rounded-full uppercase tracking-wider cursor-pointer"
              >
                {t("cancelBtn")}
              </button>
              <button
                onClick={handleCreateCase}
                disabled={creating}
                className="px-6 py-2.5 lux-button text-xs rounded-full flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {t("createCaseSubmitBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
