import React, { useState, useEffect } from "react";
import { apiUrl } from "../config";
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  Star, 
  Mail, 
  Phone, 
  MapPin, 
  User, 
  DollarSign, 
  Tag, 
  AlertCircle, 
  Check, 
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Search
} from "lucide-react";
import { Supplier, UserRole } from "../types";
import { calculateSupplierReputation } from "../supplierReputation";

interface SupplierManagementProps {
  currentRole: UserRole;
  orgId: string;
  onSuppliersChanged?: () => void;
  isActive?: boolean;
  t: (key: any) => string;
  locale: "vi" | "en";
}

export default function SupplierManagement({ 
  currentRole, 
  orgId, 
  onSuppliersChanged,
  isActive = true,
  t,
  locale
}: SupplierManagementProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  // Confirmation state for deletion
  const [deleteConfId, setDeleteConfId] = useState<string | null>(null);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Fields state
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [historicalPricing, setHistoricalPricing] = useState("");

  const hasAccessToModify = ["procurement", "manager"].includes(currentRole);

  const fetchSuppliers = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch(apiUrl("/api/suppliers"), {
        headers: { "X-Organization-Id": orgId }
      });
      if (!res.ok) throw new Error(t("errFetchSuppliers"));
      const data = await res.json();
      setSuppliers(data);
      if (data.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(data[0].id);
      }
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrorText(t("errServerFetchSuppliers"));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      fetchSuppliers(suppliers.length > 0);
    }
  }, [orgId, isActive]);

  // Handle supplier select
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || null;

  // Toggle state
  const openAddForm = () => {
    if (!hasAccessToModify) return;
    setIsAdding(true);
    setIsEditing(false);
    setName("");
    setContactPerson("");
    setEmail("");
    setPhone("");
    setAddress("");
    setTagInput("");
    setTags([]);
    setHistoricalPricing("");
    setErrorText("");
  };

  const openEditForm = (sup: Supplier) => {
    if (!hasAccessToModify) return;
    setIsEditing(true);
    setIsAdding(false);
    setName(sup.name);
    setContactPerson(sup.contactPerson || "");
    setEmail(sup.email);
    setPhone(sup.phone);
    setAddress(sup.address || "");
    setTags(sup.tags || []);
    setTagInput("");
    setHistoricalPricing(sup.historicalPricing || "");
    setErrorText("");
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit operations
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setErrorText(t("errRequiredFields"));
      return;
    }

    const payload = {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      tags,
      historicalPricing: historicalPricing.trim()
    };

    try {
      const url = isEditing ? apiUrl(`/api/suppliers/${selectedSupplierId}`) : apiUrl("/api/suppliers");
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Organization-Id": orgId
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t("errSaveTransaction"));
      }

      const savedSupplier = await res.json();
      setSuccessText(isEditing ? t("successUpdateSupplier") : t("successAddSupplier"));
      setIsEditing(false);
      setIsAdding(false);
      
      // Refresh list
      await fetchSuppliers();
      if (onSuppliersChanged) onSuppliersChanged();
      setSelectedSupplierId(savedSupplier.id);
      
      setTimeout(() => setSuccessText(""), 3500);
    } catch (err: any) {
      setErrorText(err.message || t("errSaveFailed"));
    }
  };

  const handleDeleteConfirmed = async (id: string) => {
    setErrorText("");
    setSuccessText("");
    setDeleteConfId(null);

    try {
      const res = await fetch(apiUrl(`/api/suppliers/${id}`), {
        method: "DELETE",
        headers: { "X-Organization-Id": orgId }
      });

      if (!res.ok) {
        throw new Error(t("errDeleteFailed"));
      }

      setSuccessText(t("successDeleteSupplier"));
      setSelectedSupplierId(null);
      await fetchSuppliers();
      if (onSuppliersChanged) onSuppliersChanged();
      setTimeout(() => setSuccessText(""), 3500);
    } catch (err: any) {
      setErrorText(err.message || t("errDeleteOperationFailed"));
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.tags && s.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const draftReputation = calculateSupplierReputation({
    name,
    contactPerson,
    email,
    phone,
    address,
    tags,
    historicalPricing,
    source: selectedSupplier?.source || "crm",
  });
  const selectedReputation = selectedSupplier ? calculateSupplierReputation(selectedSupplier) : null;
  const levelLabel = (level: string) => {
    if (locale === "en") return level === "high" ? "High trust" : level === "medium" ? "Needs review" : "High risk";
    return level === "high" ? "Uy tín cao" : level === "medium" ? "Cần rà soát" : "Rủi ro cao";
  };

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center enterprise-section p-5 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent-dark font-extrabold">{t("supplierMoat")}</p>
          <h2 className="text-xl font-extrabold font-display text-[#1A1A1A] tracking-tight flex items-center gap-2">
            {t("catalogTitle")}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">
            {t("catalogDesc")}
          </p>
          <h2 className="sr-only">
            {t("pageTitleSuppliers")}
          </h2>
          <p className="sr-only">
            {t("catalogDesc")}
          </p>
        </div>
        {hasAccessToModify && (
          <button
            onClick={openAddForm}
            className="bg-primary-dark hover:bg-[#1A1A1A] text-white text-xs font-bold p-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {t("addSupplierBtn")}
          </button>
        )}
      </div>

      {successText && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 font-bold" />
          <span className="font-semibold">{successText}</span>
        </div>
      )}

      {/* Access Control Alert */}
      {!hasAccessToModify && (
        <div className="bg-[#fcf8e3] border border-amber-200/80 p-4 rounded-2xl flex items-start gap-2.5 text-xs text-[#8a6d3b]">
          <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-extrabold">{t("readOnlyWarningTitle")}</span> {t("readOnlyWarningDesc").replace("{role}", currentRole === "requester" ? t("roleRequester") : t("roleWarehouse"))}
            <p className="text-[10px] text-slate-400 mt-1">{t("readOnlyWarningTip")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SUPPLIER CATALOG LIST */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-5 rounded-2xl executive-shadow space-y-4 flex flex-col max-h-[600px]">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("searchSupplierPlaceholder")}
              className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 pl-8 text-xs text-slate-800 placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-sans">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-accent-dark" />
                <span className="font-medium">{t("loadingSuppliers")}</span>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                {t("noSuppliersFound")}
              </div>
            ) : (
              filteredSuppliers.map((sup) => {
                const isActive = sup.id === selectedSupplierId;
                const reputation = calculateSupplierReputation(sup);
                return (
                  <div
                    key={sup.id}
                    onClick={() => {
                      setSelectedSupplierId(sup.id);
                      setIsEditing(false);
                      setIsAdding(false);
                      setDeleteConfId(null);
                      setErrorText("");
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                      isActive 
                        ? "bg-[#1A1A1A]/5 border-accent-gold/35" 
                        : "bg-white border-slate-150 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <h4 className="font-extrabold text-xs text-slate-700 capitalize truncate">{sup.name}</h4>
                      <div className="flex items-center gap-0.5 text-amber-500 font-mono text-[9px] shrink-0 bg-amber-50 p-0.5 px-1.5 rounded-lg border border-amber-200/50">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        <span className="font-bold">{reputation.rating}</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${reputation.level === "high" ? "bg-emerald-500" : reputation.level === "medium" ? "bg-amber-400" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(100, Math.round((reputation.reputationScore / 90) * 100))}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 font-bold">
                      {locale === "en" ? "Reputation" : "Uy tín"}: {reputation.reputationScore}/90 - {levelLabel(reputation.level)}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-1 font-medium">{t("contactPersonLabel").replace("{name}", sup.contactPerson || "N/A")}</p>
                    
                    <div className="flex flex-wrap gap-1 mt-2.5 select-none">
                      {sup.tags && sup.tags.map((tag, i) => (
                        <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL PANEL / FORMS */}
        <div className="lg:col-span-8 bg-white border border-slate-200 p-6 rounded-2xl executive-shadow min-h-[450px] relative overflow-hidden flex flex-col justify-between">
          
          {errorText && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{errorText}</span>
            </div>
          )}

          {/* ADDING OR EDITING FORM PANEL */}
          {(isAdding || isEditing) ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="border-b border-slate-150 pb-3 flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-accent-dark" /> 
                  {isAdding ? t("createSupplierTitle") : t("updateSupplierTitle").replace("{name}", name)}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setIsEditing(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                >
                  {t("cancelBtnShort")}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wide">{t("fieldSupplierName")} <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("placeholderSupplierName")}
                    className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wide">{t("fieldContactPerson")}</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder={t("placeholderContactPerson")}
                    className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wide">{t("fieldOfficialEmail")} <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("placeholderOfficialEmail")}
                    className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wide">{t("fieldPhoneNumber")} <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("placeholderPhoneNumber")}
                    className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 font-extrabold">
                      {locale === "en" ? "Auto reputation score" : "Điểm uy tín tự động"}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {locale === "en" ? "Calculated from contact verification, profile depth, category tags, commercial history and source reliability." : "Tính từ xác thực liên hệ, độ đầy đủ hồ sơ, ngành hàng, lịch sử giá/giao dịch và độ tin cậy nguồn."}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary-dark">{draftReputation.rating}/5.0</p>
                    <p className="text-[10px] font-bold text-slate-500">{draftReputation.reputationScore}/90 - {levelLabel(draftReputation.level)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {draftReputation.criteria.map((criterion) => (
                    <div key={criterion.key} className="bg-white border border-slate-150 rounded-xl p-2">
                      <p className="text-[9px] font-extrabold text-slate-500 leading-tight">{criterion.label}</p>
                      <p className="text-xs font-black text-primary-dark mt-1">{criterion.score}/{criterion.maxScore}</p>
                    </div>
                  ))}
                </div>
                {draftReputation.riskFlags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draftReputation.riskFlags.map((risk) => (
                      <span key={risk} className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5 font-bold">
                        {risk}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wide">{t("fieldHqAddress")}</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("placeholderHqAddress")}
                  className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              {/* Tags block */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wide">{t("fieldSuppliedProducts")}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder={t("placeholderSuppliedProducts")}
                    className="flex-1 bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-2 text-xs rounded-xl px-4 cursor-pointer"
                  >
                    {locale === "en" ? "Add tag" : "Thêm tag"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 select-none">
                  {tags.map((tg, idx) => (
                    <span 
                      key={idx} 
                      className="text-[10px] bg-amber-50 border border-amber-200 text-accent-dark px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold"
                    >
                      {tg}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTag(idx)} 
                        className="text-accent-dark hover:text-rose-500 text-xs font-bold font-mono ml-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && <span className="text-[10px] text-slate-400 italic">{t("noTagsLinked")}</span>}
                </div>
              </div>

              {/* Historical Pricing */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wide font-sans">{t("fieldHistoricalPricing")}</label>
                <textarea
                  value={historicalPricing}
                  onChange={(e) => setHistoricalPricing(e.target.value)}
                  placeholder={t("placeholderHistoricalPricing")}
                  rows={3}
                  className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-800 leading-relaxed placeholder-slate-400 font-mono"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setIsEditing(false);
                  }}
                  className="bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-xl p-2 px-4 text-xs font-bold cursor-pointer transition-all"
                >
                  {t("closeBtn")}
                </button>
                <button
                  type="submit"
                  className="bg-[#1A1A1A] hover:bg-[#000000] text-white rounded-xl p-2 px-5 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-accent-glow"
                >
                  <Check className="w-4 h-4" /> {t("saveInfoBtn")}
                </button>
              </div>
            </form>
          ) : selectedSupplier && selectedReputation ? (
            // VIEW MODE: SUPPLIER PROFILE PREVIEW CARD
            <div className="space-y-6 flex flex-col justify-between h-full">
              <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-slate-150 pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono bg-slate-100 border border-slate-200 rounded px-2.5 py-0.5 text-slate-500 font-bold">
                        ID: {selectedSupplier.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[10px] bg-amber-50 text-accent-dark px-2 py-0.5 rounded border border-amber-200 font-mono font-bold">
                        {t("statusActiveTenant")}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 capitalize leading-tight">{selectedSupplier.name}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {t("contactRepresentative").replace("{name}", selectedSupplier.contactPerson || "N/A")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 shrink-0 text-slate-700 text-xs">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wide">{t("trustedPartner")}</span>
                      <div className="flex items-center gap-0.5 font-mono font-extrabold text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{selectedReputation.rating}</span> / 5.0
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-extrabold">
                        {locale === "en" ? "Reputation criteria" : "Tiêu chí điểm uy tín"}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {locale === "en" ? "This score is recalculated from supplier data instead of being entered manually." : "Điểm này được tính lại từ dữ liệu NCC, không còn nhập tay mặc định."}
                      </p>
                    </div>
                    <div className="min-w-32">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${selectedReputation.level === "high" ? "bg-emerald-500" : selectedReputation.level === "medium" ? "bg-amber-400" : "bg-rose-500"}`}
                          style={{ width: `${Math.min(100, Math.round((selectedReputation.reputationScore / 90) * 100))}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-right font-bold text-slate-500 mt-1">
                        {selectedReputation.reputationScore}/90 - {levelLabel(selectedReputation.level)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {selectedReputation.criteria.map((criterion) => (
                      <div key={criterion.key} className="bg-slate-50 border border-slate-150 rounded-xl p-2.5">
                        <p className="text-[9px] font-extrabold text-slate-500 leading-tight">{criterion.label}</p>
                        <p className="text-xs font-black text-primary-dark mt-1">{criterion.score}/{criterion.maxScore}</p>
                        <p className="text-[8.5px] text-slate-400 mt-0.5 leading-tight">{criterion.note}</p>
                      </div>
                    ))}
                  </div>
                  {selectedReputation.riskFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedReputation.riskFlags.map((risk) => (
                        <span key={risk} className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5 font-bold">
                          {risk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Profiles cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Contact cards */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">{t("sourcingInfoTitle")}</h4>
                    <div className="space-y-2.5 text-xs text-slate-600">
                      <p className="flex items-center gap-2.5 font-medium">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-700">{selectedSupplier.email}</span>
                      </p>
                      <p className="flex items-center gap-2.5 font-medium">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-slate-700">{selectedSupplier.phone}</span>
                      </p>
                      <p className="flex items-start gap-2.5 font-medium">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed text-slate-500">{selectedSupplier.address || t("noOfficeAddressSet")}</span>
                      </p>
                    </div>
                  </div>

                  {/* Tags cards */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">{t("coreSourcingProducts")}</h4>
                      <div className="flex flex-wrap gap-1.5 mt-2.5 select-none">
                        {selectedSupplier.tags && selectedSupplier.tags.map((tag, i) => (
                          <span key={i} className="text-[10px] bg-amber-50 border border-amber-200 text-accent-dark font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5 text-accent-dark" /> {tag}
                          </span>
                        ))}
                        {(!selectedSupplier.tags || selectedSupplier.tags.length === 0) && (
                          <span className="text-slate-400 text-[10px] italic">{t("noCategoryTags")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Historical Pricing details */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-extrabold flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-accent-dark" /> {t("historicalPricingSectionTitle")}
                  </h4>
                  {selectedSupplier.historicalPricing ? (
                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed italic bg-white border border-slate-150 p-3.5 rounded-xl font-mono">
                      "{selectedSupplier.historicalPricing}"
                    </p>
                  ) : (
                    <div className="text-xs text-slate-400 italic p-4 bg-white rounded-xl border border-slate-150 text-center leading-normal font-medium">
                      {t("noHistoricalPricingRecorded")}
                      <p className="text-[9.5px] text-slate-405 mt-1">{t("historicalPricingTip")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* CRUD triggers below (if procurement / manager role) */}
              {hasAccessToModify && (
                <div className="pt-5 border-t border-slate-150 flex justify-end gap-3 items-center">
                  {deleteConfId === selectedSupplier.id ? (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-2 px-3 rounded-xl">
                      <span className="text-[11px] text-rose-700 font-bold">{t("confirmDeletePartner")}</span>
                      <button 
                        onClick={() => handleDeleteConfirmed(selectedSupplier.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg cursor-pointer transition-all"
                      >
                        {t("agreeBtn")}
                      </button>
                      <button 
                        onClick={() => setDeleteConfId(null)}
                        className="bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold py-1 px-2.5 rounded-lg cursor-pointer transition-all"
                      >
                        {t("cancelBtnShort")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setDeleteConfId(selectedSupplier.id)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold p-2.5 px-4 rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t("removePartnerBtn")}
                      </button>
                      <button
                        onClick={() => openEditForm(selectedSupplier)}
                        className="bg-[#1A1A1A] hover:bg-[#000000] text-white text-xs font-bold p-2.5 px-4 rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> {t("editProfileBtn")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-sans space-y-3 text-center">
              <Building2 className="w-12 h-12 text-slate-300 animate-pulse" />
              <div>
                <p className="text-slate-600 text-sm font-extrabold">{t("partnerProfileDetail")}</p>
                <p className="text-[11px] text-slate-400 max-w-sm mt-0.5">{t("selectPartnerToView")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
