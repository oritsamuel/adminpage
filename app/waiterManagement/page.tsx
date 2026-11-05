"use client";

import { QRCodeCanvas } from "qrcode.react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { type AdminListItem, type AdminStatusMap, type BranchRecord, buildTippingUrl } from "./branchRepository";

type ModalType = "add" | "admin" | "qr" | "details" | null;

type MerchantForm = {
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
};

type AdminForm = {
  companyId: string;
  branchId: string;
  companyName: string;
  branchName: string;
  fullName: string;
  phone: string;
  remark: string;
};

type CompanyDetail = {
  id: number;
  companyCode?: number;
  branchCode?: number;
  companyName: string;
  branchName: string;
  status: boolean;
  admins: number;
  waiters: number;
};

type MerchantOption = {
  id: string;
  name: string;
};

type BranchOption = {
  id: string;
  name: string;
};

function getApiError(payload: unknown, fallback: string, status?: number) {
  if (!payload || typeof payload !== "object") {
    if (status === 401) return "The server-configured Hulubeje bearer token is invalid or expired.";
    if (status === 403) return "Your account is not authorized to manage waiter tips.";
    return fallback;
  }
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.errorMessages)) {
    const messages = record.errorMessages.filter((message): message is string => typeof message === "string");
    if (messages.length) return messages.join(" ");
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  if (status === 401) return "The server-configured Hulubeje bearer token is invalid or expired.";
  if (status === 403) return "Your account is not authorized to manage waiter tips.";
  return fallback;
}

function buildFrontEndTipUrl(companyId: number | string, branchId: number | string) {
  return buildTippingUrl(companyId, branchId);
}

function getPositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return undefined;
}

function resolveTipIds(company: Partial<CompanyDetail> & Record<string, unknown>) {
  const companyId =
    getPositiveNumber(company.companyCode)
    ?? getPositiveNumber(company.companyId)
    ?? getPositiveNumber(company.id)
    ?? getPositiveNumber(company.company_id)
    ?? undefined;
  const branchId =
    getPositiveNumber(company.branchCode)
    ?? getPositiveNumber(company.branchId)
    ?? getPositiveNumber(company.branch_id)
    ?? undefined;

  return {
    companyId,
    branchId,
  };
}

function mapCompanyDetail(value: unknown): BranchRecord {
  if (!value || typeof value !== "object") throw new Error("The company list contains an invalid item.");
  const company = value as Partial<CompanyDetail> & Record<string, unknown>;
  if (
    typeof company.companyName !== "string"
    || typeof company.branchName !== "string"
    || typeof company.status !== "boolean"
    || typeof company.admins !== "number"
    || typeof company.waiters !== "number"
  ) {
    throw new Error("The company list returned an unexpected response.");
  }

  const tipIds = resolveTipIds(company);
  const companyId = tipIds.companyId;
  const branchId = tipIds.branchId;

  return {
    companyId: companyId,
    companyCode: companyId,
    restaurantId: companyId ? String(companyId) : "",
    name: company.companyName,
    branchId: branchId ? String(branchId) : "",
    branchCode: branchId,
    branch: company.branchName,
    token: "",
    tippingUrl: companyId && branchId ? buildFrontEndTipUrl(companyId, branchId) : "",
    admins: company.admins,
    waiters: company.waiters,
    status: company.status ? "Active" : "Inactive",
    phone: "",
    adminList: [],
  };
}

function extractOptionList(payload: unknown, target: "merchant" | "branch") {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const candidateCollections: unknown[] = [
    payload,
    root?.data,
    root?.result,
    root?.items,
    root?.value,
    root?.data && typeof root.data === "object" ? (root.data as Record<string, unknown>).items : null,
    root?.data && typeof root.data === "object" ? (root.data as Record<string, unknown>).data : null,
  ];

  const list = candidateCollections.find(Array.isArray);
  if (!Array.isArray(list)) return [];

  return list.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const idCandidates = ["id", target === "merchant" ? "merchantId" : "branchId", "merchant_id", "branch_id"];
    const nameCandidates = [
      "name",
      target === "merchant" ? "merchantName" : "branchName",
      "companyName",
      "branchName",
      "title",
      "branch",
    ];
    const id = idCandidates.map((key) => item[key]).find((value): value is string | number => value !== undefined && value !== null && value !== "") ?? "";
    const name = nameCandidates.map((key) => item[key]).find((value): value is string | number => value !== undefined && value !== null && value !== "") ?? "";
    if (!id || !name) return [];
    return [{ id: String(id), name: String(name) }];
  });
}

function buildInitials(value: string | undefined) {
  const safeValue = (value ?? "").trim();
  return safeValue
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "M";
}

function extractAdminList(payload: unknown): AdminListItem[] {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const candidateCollections: unknown[] = [
    payload,
    root?.data,
    root?.result,
    root?.items,
    root?.value,
    root?.data && typeof root.data === "object" ? (root.data as Record<string, unknown>).items : null,
    root?.data && typeof root.data === "object" ? (root.data as Record<string, unknown>).data : null,
  ];

  const normalizedItems: unknown[] = [];
  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (value && typeof value === "object") {
      normalizedItems.push(value);
    }
  };

  candidateCollections.forEach(collect);
  if (!normalizedItems.length) return [];

  const entries = normalizedItems.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const item = entry as Record<string, unknown>;
    const name = [
      item.fullName,
      item.full_name,
      item.name,
      item.adminName,
      item.displayName,
      item.firstName,
      item.username,
    ].find((value): value is string => typeof value === "string" && value.trim() !== "")?.trim();

    const phone = [
      item.phone,
      item.phoneNumber,
      item.mobile,
      item.mobileNumber,
      item.number,
      item.cellPhone,
    ].find((value): value is string => typeof value === "string" && value.trim() !== "")?.trim();

    if (!name && !phone) return [];

    const adminId = [
      item.id,
      item.adminId,
      item.admin_id,
      item.userId,
      item.user_id,
    ].find((value): value is string | number => typeof value === "number" || (typeof value === "string" && value.trim() !== ""));

    const statusValue = [
      item.status,
      item.state,
      item.isActive,
      item.active,
    ].find((value) => value !== undefined && value !== null);

    const parsedStatus: AdminListItem["status"] =
      typeof statusValue === "boolean"
        ? (statusValue ? "Active" : "Terminated")
        : typeof statusValue === "string"
          ? (statusValue.toLowerCase() === "terminated" ? "Terminated" : "Active")
          : "Active";

    return [{
      id: typeof adminId === "number" ? adminId : (typeof adminId === "string" && adminId.trim() !== "" ? Number(adminId) : undefined),
      name: name || "Unknown admin",
      phone: phone || "",
      status: parsedStatus,
    }];
  });

  return entries.filter((entry, index, all) => all.findIndex((candidate) =>
    candidate.name === entry.name && candidate.phone === entry.phone
  ) === index);
}

function readPersistedAdminStatuses() {
  if (typeof window === "undefined") return {} as AdminStatusMap;

  try {
    const raw = window.localStorage.getItem("waiterManagementAdminStatuses");
    if (!raw) return {} as AdminStatusMap;
    const parsed = JSON.parse(raw) as Partial<AdminStatusMap>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value === "Active" || value === "Terminated"),
    ) as AdminStatusMap;
  } catch {
    return {} as AdminStatusMap;
  }
}

function writePersistedAdminStatuses(map: AdminStatusMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("waiterManagementAdminStatuses", JSON.stringify(map));
  } catch {
    // Ignore storage failures silently.
  }
}

function QrDisplay({ value, id, logo }: { value: string; id: string; logo?: string }) {
  return (
    <div className="rounded-[16px] bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
      <QRCodeCanvas
        id={id}
        value={value}
        size={220}
        includeMargin={true}
        marginSize={2}
        bgColor="#ffffff"
        fgColor="#111827"
        imageSettings={logo ? { src: logo, height: 36, width: 36, excavate: true } : undefined}
      />
    </div>
  );
}

export default function WaiterManagement() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<BranchRecord | null>(null);
  const [merchantForm, setMerchantForm] = useState<MerchantForm>({ companyId: "", companyName: "", branchId: "", branchName: "" });
  const [adminForm, setAdminForm] = useState<AdminForm>({
    companyId: "",
    branchId: "",
    companyName: "",
    branchName: "",
    fullName: "",
    phone: "",
    remark: "",
  });
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrError, setQrError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [merchants, setMerchants] = useState<BranchRecord[]>([]);
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(true);
  const [merchantLoadError, setMerchantLoadError] = useState("");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [merchantOptions, setMerchantOptions] = useState<MerchantOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [isLoadingMerchantOptions, setIsLoadingMerchantOptions] = useState(false);
  const [isLoadingBranchOptions, setIsLoadingBranchOptions] = useState(false);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [merchantOptionsError, setMerchantOptionsError] = useState("");
  const [persistedAdminStatuses, setPersistedAdminStatuses] = useState<AdminStatusMap>(() => readPersistedAdminStatuses());
  const [isCompanySearchOpen, setIsCompanySearchOpen] = useState(false);
  const [highlightedCompanyIndex, setHighlightedCompanyIndex] = useState(0);

  const activeCompanySearchValue = activeModal === "add" ? adminForm.companyName : merchantForm.companyName;

  const filteredCompanyOptions = useMemo(() => {
    const query = activeCompanySearchValue.trim().toLowerCase();
    if (!query) return merchantOptions;
    return merchantOptions.filter((merchant) => merchant.name.toLowerCase().includes(query));
  }, [activeCompanySearchValue, merchantOptions]);

  useEffect(() => {
    if (!isCompanySearchOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !target.closest("[data-company-search-root]")) {
        setIsCompanySearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isCompanySearchOpen]);

  const loadBranchOptions = useCallback(async (merchantId: string) => {
    if (!merchantId) {
      setBranchOptions([]);
      setAdminForm((current) => ({ ...current, branchId: "", branchName: "" }));
      return;
    }
    setIsLoadingBranchOptions(true);
    try {
      const response = await fetch(`/api/auth/merchants/${encodeURIComponent(merchantId)}/branches`, { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, "Unable to load branch options.", response.status));
      const nextOptions = extractOptionList(payload, "branch");
      setBranchOptions(nextOptions);
      const selectedBranch = nextOptions[0];
      setAdminForm((current) => ({
        ...current,
        companyId: merchantId,
        companyName: merchantOptions.find((option) => option.id === merchantId)?.name ?? current.companyName,
        branchId: current.branchId || selectedBranch?.id || "",
        branchName: selectedBranch?.name ?? "",
      }));
      setMerchantForm((current) => ({
        ...current,
        companyId: merchantId,
        companyName: merchantOptions.find((option) => option.id === merchantId)?.name ?? current.companyName,
        branchId: selectedBranch?.id ?? "",
        branchName: selectedBranch?.name ?? "",
      }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load branch options.";
      setMerchantOptionsError(message);
      setBranchOptions([]);
      setAdminForm((current) => ({ ...current, branchId: "", branchName: "" }));
    } finally {
      setIsLoadingBranchOptions(false);
    }
  }, [merchantOptions]);

  const loadMerchantOptions = useCallback(async () => {
    setIsLoadingMerchantOptions(true);
    setMerchantOptionsError("");
    try {
      const response = await fetch("/api/auth/merchants", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, "Unable to load company options.", response.status));
      const nextOptions = extractOptionList(payload, "merchant");
      setMerchantOptions(nextOptions);
      if (!nextOptions.length) {
        setBranchOptions([]);
        setAdminForm((current) => ({ ...current, companyId: "", branchId: "", companyName: "", branchName: "" }));
        setMerchantForm((current) => ({ ...current, companyId: "", companyName: "", branchId: "", branchName: "" }));
        return;
      }
      const firstMerchant = nextOptions[0];
      setAdminForm((current) => ({
        ...current,
        companyId: firstMerchant.id,
        companyName: firstMerchant.name,
        branchId: "",
        branchName: "",
      }));
      setMerchantForm((current) => ({
        ...current,
        companyId: firstMerchant.id,
        companyName: firstMerchant.name,
        branchId: "",
        branchName: "",
      }));
      await loadBranchOptions(firstMerchant.id);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load company options.";
      setMerchantOptionsError(message);
      setMerchantOptions([]);
      setBranchOptions([]);
      setAdminForm((current) => ({ ...current, companyId: "", branchId: "", companyName: "", branchName: "" }));
      setMerchantForm((current) => ({ ...current, companyId: "", companyName: "", branchId: "", branchName: "" }));
    } finally {
      setIsLoadingMerchantOptions(false);
    }
  }, [loadBranchOptions]);


  const loadMerchants = useCallback(async () => {
    setIsLoadingMerchants(true);
    setMerchantLoadError("");
    try {
      const response = await fetch("/api/waiter-tips/company", {
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, "Unable to load merchants.", response.status));
      if (!Array.isArray(payload)) throw new Error("The company list endpoint returned an unexpected response.");

      const fetchedMerchants = payload.map(mapCompanyDetail);
      setMerchants(fetchedMerchants);
    } catch (loadError) {
      setMerchants([]);
      setMerchantLoadError(loadError instanceof Error ? loadError.message : "Unable to load merchants.");
    } finally {
      setIsLoadingMerchants(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadMerchants(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadMerchants]);

  const openAddCompanyAccess = async () => {
    setAdminError("");
    setActiveModal("add");
    setAdminForm({
      companyId: "",
      branchId: "",
      companyName: "",
      branchName: "",
      fullName: "",
      phone: "",
      remark: "",
    });
    await loadMerchantOptions();
  };

  const openGenerateQr = async () => {
    setQrError("");
    setQrGenerated(false);
    setLogoPreview("");
    setLogoFileName("");
    setMerchantForm({ companyId: "", companyName: "", branchId: "", branchName: "" });
    setActiveModal("qr");
    await loadMerchantOptions();
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setQrError("Please choose an image file for the restaurant logo.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setQrError("Please choose a logo smaller than 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(String(reader.result));
      setLogoFileName(file.name);
      setQrError("");
    };
    reader.onerror = () => setQrError("Unable to read the selected logo.");
    reader.readAsDataURL(file);
  };

  const closeModal = () => {
    setActiveModal(null);
    setQrError("");
    setAdminError("");
    setQrGenerated(false);
    setLogoPreview("");
    setLogoFileName("");
    setMerchantForm({ companyId: "", companyName: "", branchId: "", branchName: "" });
    setIsCompanySearchOpen(false);
    setHighlightedCompanyIndex(0);
  };

  const handleCompanySearchSelect = async (merchant: MerchantOption) => {
    setAdminForm((current) => ({
      ...current,
      companyId: merchant.id,
      companyName: merchant.name,
      branchId: "",
      branchName: "",
    }));
    setIsCompanySearchOpen(false);
    setHighlightedCompanyIndex(0);
    await loadBranchOptions(merchant.id);
  };

  const handleQrCompanySearchSelect = async (merchant: MerchantOption) => {
    setMerchantForm((current) => ({
      ...current,
      companyId: merchant.id,
      companyName: merchant.name,
      branchId: "",
      branchName: "",
    }));
    setIsCompanySearchOpen(false);
    setHighlightedCompanyIndex(0);
    await loadBranchOptions(merchant.id);
  };

  const saveMerchant = async () => {
    const cleanCompanyName = (merchantForm.companyName ?? "").trim();
    const cleanBranchName = (merchantForm.branchName ?? "").trim();
    const selectedCompanyId = Number(merchantForm.companyId || "");
    const selectedBranchId = Number(merchantForm.branchId || "");

    if (!cleanCompanyName || !cleanBranchName) {
      setQrError("Please choose both the company and branch from the dropdowns.");
      return;
    }
    if (!Number.isFinite(selectedCompanyId) || selectedCompanyId <= 0) {
      setQrError("Please select a valid company before generating the QR code.");
      return;
    }
    if (!Number.isFinite(selectedBranchId) || selectedBranchId <= 0) {
      setQrError("Please select a valid branch before generating the QR code.");
      return;
    }

    const generatedUrl = buildFrontEndTipUrl(selectedCompanyId, selectedBranchId);
    const nextMerchant: BranchRecord = {
      companyId: selectedCompanyId,
      companyCode: selectedCompanyId,
      restaurantId: String(selectedCompanyId),
      name: cleanCompanyName,
      branchId: String(selectedBranchId),
      branchCode: selectedBranchId,
      branch: cleanBranchName,
      token: "",
      tippingUrl: generatedUrl,
      logo: logoPreview || undefined,
      admins: 0,
      waiters: 0,
      status: "Active",
      phone: "",
      adminList: [],
    };

    setSelectedMerchant(nextMerchant);
    setQrGenerated(true);
    setQrError("");
  };

  const addCompanyAccess = async () => {
    const companyCode = Number(adminForm.companyId);
    const branchCode = Number(adminForm.branchId);
    const cleanCompany = adminForm.companyName.trim();
    const cleanBranch = adminForm.branchName.trim();

    if (!cleanCompany || !cleanBranch) {
      setAdminError("Please choose both the company and branch from the dropdowns.");
      return;
    }

    if (!Number.isInteger(companyCode) || companyCode <= 0) {
      setAdminError("Please select a valid company ID from the backend before creating the branch.");
      return;
    }

    if (!Number.isInteger(branchCode) || branchCode <= 0) {
      setAdminError("Please select a valid branch ID from the backend before creating the branch.");
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const response = await fetch("/api/waiter-tips/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyCode,
          branchCode,
          companyName: cleanCompany,
          branchName: cleanBranch,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, "Unable to add company.", response.status));

      setAdminError("");
      closeModal();
      void loadMerchants();
    } catch (createError) {
      setAdminError(createError instanceof Error ? createError.message : "Unable to add company.");
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const addAdminRowAccess = async (merchant: BranchRecord) => {
    const companyKey = merchant.companyCode ?? merchant.companyId ?? Number(merchant.restaurantId);
    const fullName = adminForm.fullName.trim();
    const phone = adminForm.phone.trim();
    const remark = adminForm.remark.trim();

    if (!Number.isInteger(companyKey) || companyKey <= 0) {
      setAdminError("Please select a valid company before adding an admin.");
      return;
    }

    if (!fullName || !phone) {
      setAdminError("Please enter the admin's full name and phone number.");
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const response = await fetch(`/api/waiter-tips/companies/${companyKey}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, remark }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, "Unable to add admin.", response.status));

      setAdminError("");
      closeModal();
      const companyMatchKey = merchant.companyCode ?? merchant.companyId;
      if (companyMatchKey !== undefined) {
        setMerchants((current) => current.map((item) => {
          const itemKey = item.companyCode ?? item.companyId;
          if (itemKey !== companyMatchKey) return item;
          return {
            ...item,
            admins: item.admins + 1,
            phone: phone || item.phone,
            adminList: [...item.adminList, { name: fullName, phone, status: "Active" }],
          };
        }));
      }
      void loadMerchants();
    } catch (createError) {
      setAdminError(createError instanceof Error ? createError.message : "Unable to add admin.");
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleDownloadQr = (merchant: BranchRecord) => {
    const canvas = document.getElementById(`qr-${merchant.branchId}`) as HTMLCanvasElement | null;
    if (!canvas) return;

    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `${merchant.name}-${merchant.branch}-qr.png`;
    anchor.click();
  };

  const toggleAdminStatus = async (adminToToggle: { id?: number; name: string; phone: string; status: "Active" | "Terminated" }) => {
    const companyId = selectedMerchant?.companyCode ?? selectedMerchant?.companyId ?? Number(selectedMerchant?.restaurantId);
    if (!Number.isInteger(companyId) || companyId <= 0 || !adminToToggle.id) {
      setAdminError("This admin is missing a valid company or admin ID.");
      return;
    }

    const nextAction = adminToToggle.status === "Active" ? "terminate" : "activate";
    let lastError: string | null = null;

    for (const method of ["PUT", "POST"] as const) {
      try {
        const response = await fetch(`/api/waiter-tips/${companyId}/${adminToToggle.id}/${nextAction}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          lastError = getApiError(payload, `Unable to ${nextAction} admin.`, response.status);
          continue;
        }

        const nextStatus: "Active" | "Terminated" = adminToToggle.status === "Active" ? "Terminated" : "Active";

        setPersistedAdminStatuses((current) => {
          const nextMap = {
            ...current,
            [`${companyId}:${adminToToggle.id}`]: nextStatus,
          };
          writePersistedAdminStatuses(nextMap);
          return nextMap;
        });

        setSelectedMerchant((current) => {
          if (!current) return current;
          return {
            ...current,
            adminList: current.adminList.map((admin) => (
              admin.id === adminToToggle.id
                ? { ...admin, status: nextStatus }
                : admin
            )),
          };
        });

        setMerchants((current) => current.map((merchant) => {
          const merchantCompanyId = merchant.companyCode ?? merchant.companyId;
          if (merchantCompanyId !== companyId) return merchant;
          return {
            ...merchant,
            adminList: merchant.adminList.map((admin) => (
              admin.id === adminToToggle.id
                ? { ...admin, status: nextStatus }
                : admin
            )),
          };
        }));

        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : `Unable to ${nextAction} admin.`;
      }
    }

    setAdminError(lastError ?? `Unable to ${nextAction} admin.`);
  };

  const openDetails = async (merchant: BranchRecord) => {
    const companyKey = merchant.companyCode ?? merchant.companyId ?? Number(merchant.restaurantId);

    setSelectedMerchant({ ...merchant, adminList: merchant.adminList ?? [] });
    setIsLoadingAdmins(true);
    setActiveModal("details");

    if (!Number.isInteger(companyKey) || companyKey <= 0) {
      setIsLoadingAdmins(false);
      return;
    }

    try {
      const response = await fetch(`/api/waiter-tips/companies/${companyKey}/admins`, { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = getApiError(payload, "Unable to load admins.", response.status);
        setSelectedMerchant({ ...merchant, adminList: merchant.adminList ?? [] });
        setMerchantLoadError(message);
        return;
      }

      const nextAdmins = extractAdminList(payload).map((admin) => {
        const persistedKey = `${companyKey}:${admin.id ?? `${admin.name}:${admin.phone}`}`;
        return {
          ...admin,
          status: persistedAdminStatuses[persistedKey] ?? admin.status,
        };
      });
      setSelectedMerchant({ ...merchant, adminList: nextAdmins });
      setMerchants((current) => current.map((item) => {
        const itemKey = item.companyCode ?? item.companyId;
        if (itemKey !== companyKey) return item;
        return { ...item, adminList: nextAdmins, admins: Math.max(item.admins, nextAdmins.length) };
      }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load admins.";
      setMerchantLoadError(message);
      setSelectedMerchant({ ...merchant, adminList: merchant.adminList ?? [] });
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  const openAdminModal = (merchant: BranchRecord) => {
    setSelectedMerchant(merchant);
    setAdminError("");
    setActiveModal("admin");
    setAdminForm({
      companyId: merchant.companyId !== undefined ? String(merchant.companyId) : "",
      branchId: merchant.branchId ? String(merchant.branchId) : "",
      companyName: merchant.name,
      branchName: merchant.branch,
      fullName: "",
      phone: "",
      remark: "",
    });
  };

  return (
    <main className="min-h-screen bg-[#f3f2f1] px-4 pb-6 pt-[92px] text-[#2d2a28] md:ml-60 md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[42px] font-bold tracking-[-0.04em] text-[#1f1d1b]">Waiter Management</h1>
            <p className="mt-1 text-[18px] text-[#5a544e]">
              {isLoadingMerchants ? "Loading merchants..." : `${merchants.length} merchants registered`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void openAddCompanyAccess()}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] px-5 py-3 text-[17px] font-semibold text-[#2f2b29] shadow-[0_2px_0_rgba(0,0,0,0.04)] transition hover:bg-[#efeae8]"
            >
              <span className="text-[18px] leading-none">＋</span>
              Add Company
            </button>
            <button
              type="button"
              onClick={() => void openGenerateQr()}
              className="inline-flex items-center gap-2 rounded-[14px] bg-[#6b1b3d] px-5 py-3 text-[17px] font-semibold text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition hover:bg-[#58152f]"
            >
              <span className="text-[18px] leading-none">◫</span>
              Generate QR
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-4 text-sm text-[#6b625d]">
          <p>Company creation and QR generation now follow the latest waiter tips API contract.</p>
          {merchantLoadError && (
            <button type="button" onClick={() => void loadMerchants()} className="shrink-0 font-semibold text-[#6b1b3d] underline">
              Retry loading
            </button>
          )}
        </div>
        {merchantLoadError && (
          <p role="alert" className="mb-4 rounded-[10px] bg-[#f9e8e8] px-3 py-2 text-sm text-[#8a2d2d]">
            {merchantLoadError}
          </p>
        )}
        {merchantOptionsError && (
          <p role="alert" className="mb-4 rounded-[10px] bg-[#f9e8e8] px-3 py-2 text-sm text-[#8a2d2d]">
            {merchantOptionsError}
          </p>
        )}

        <div className="overflow-hidden rounded-[18px] border border-[#dcd5d1] bg-[#f8f6f5] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-[#f1efed] text-[13px] font-semibold uppercase tracking-[0.02em] text-[#57514d]">
                <tr>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-5 py-4">Branch</th>
                  <th className="px-5 py-4">Admins</th>
                  <th className="px-5 py-4">Waiters</th>
                  <th className="px-5 py-4">QR Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {isLoadingMerchants && merchants.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-[#6b625d]">Loading merchants…</td></tr>
                )}
                {!isLoadingMerchants && !merchantLoadError && merchants.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-[#6b625d]">No merchants were returned by the API.</td></tr>
                )}
                {merchants.map((merchant) => (
                  <tr key={`${merchant.name}-${merchant.branch}`} className="border-t border-[#e7e1de]">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#7e2449] text-[17px] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]">
                          {buildInitials(merchant.name)}
                        </div>
                        <span className="text-[18px] font-medium text-[#2e2b29]">{merchant.name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-5 text-[18px] text-[#3c3835]">{merchant.branch}</td>
                    <td className="px-5 py-5 text-[18px] text-[#3c3835]">{merchant.admins}</td>
                    <td className="px-5 py-5 text-[18px] text-[#3c3835]">{merchant.waiters}</td>
                    <td className="px-5 py-5">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[15px] font-medium ${merchant.status === "Active" ? "border-[#8ecdb1] bg-[#dff8ef] text-[#1d7a57]" : "border-[#d7d1ce] bg-[#eeeae8] text-[#625c58]"}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${merchant.status === "Active" ? "bg-[#25a56b]" : "bg-[#8e8782]"}`} />
                        {merchant.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void openDetails(merchant)}
                          className="rounded-[12px] border border-[#d7d1ce] bg-[#f7f3f1] px-4 py-2 text-[15px] font-medium text-[#3c3835] transition hover:bg-[#efebe9]"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdminModal(merchant)}
                          className="rounded-[12px] border border-[#f0c399] bg-[#fff3e8] px-4 py-2 text-[15px] font-medium text-[#d5782a] transition hover:bg-[#fbe8d4]"
                        >
                          Add Admin
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/20 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && activeModal !== "qr") closeModal();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[18px] border border-[#ded8d5] bg-[#f3f0ee] p-5 shadow-[0_20px_60px_rgba(10,10,12,0.18)]">
            {activeModal === "add" && (
              <>
                <div className="space-y-5 pt-1">
                  <div>
                    <h2 className="mb-7 text-[32px] font-bold tracking-[-0.04em] text-[#201e1d]">Add Company</h2>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Company Name</label>
                    <div data-company-search-root className="relative">
                      <input
                        value={adminForm.companyName}
                        onFocus={() => {
                          setIsCompanySearchOpen(true);
                          setHighlightedCompanyIndex(0);
                        }}
                        onChange={(event) => {
                          const typedCompanyName = event.target.value;
                          const exactMatch = merchantOptions.find((merchant) => merchant.name.toLowerCase() === typedCompanyName.trim().toLowerCase());

                          setAdminForm((current) => ({
                            ...current,
                            companyName: typedCompanyName,
                            companyId: exactMatch?.id ?? "",
                            branchId: exactMatch ? "" : "",
                            branchName: exactMatch ? "" : "",
                          }));

                          if (exactMatch) {
                            setIsCompanySearchOpen(false);
                            setHighlightedCompanyIndex(0);
                            void loadBranchOptions(exactMatch.id);
                            return;
                          }

                          setBranchOptions([]);
                          setIsCompanySearchOpen(true);
                          setHighlightedCompanyIndex(0);
                        }}
                        onKeyDown={(event) => {
                          if (!filteredCompanyOptions.length) return;

                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setHighlightedCompanyIndex((current) => (current + 1) % filteredCompanyOptions.length);
                            return;
                          }

                          if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setHighlightedCompanyIndex((current) => (current - 1 + filteredCompanyOptions.length) % filteredCompanyOptions.length);
                            return;
                          }

                          if (event.key === "Enter") {
                            const selectedCompany = filteredCompanyOptions[highlightedCompanyIndex];
                            if (selectedCompany) {
                              event.preventDefault();
                              void handleCompanySearchSelect(selectedCompany);
                            }
                          }
                        }}
                        placeholder={isLoadingMerchantOptions ? "Loading companies..." : "Type a company name"}
                        disabled={isLoadingMerchantOptions || !merchantOptions.length}
                        className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#efeeed] px-4 pr-12 text-[18px] text-[#2f2b29] outline-none transition focus:border-[#b3a7a1] disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      {adminForm.companyName && !isLoadingMerchantOptions && merchantOptions.length > 0 && (
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setAdminForm((current) => ({ ...current, companyId: "", companyName: "", branchId: "", branchName: "" }));
                            setBranchOptions([]);
                            setIsCompanySearchOpen(true);
                          }}
                          className="absolute inset-y-0 right-3 flex items-center text-[20px] text-[#6b625d] transition hover:text-[#2f2b29]"
                          aria-label="Clear company"
                        >
                          ×
                        </button>
                      )}

                      {isCompanySearchOpen && (
                        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-[14px] border border-[#d8d1ce] bg-[#f8f6f5] shadow-[0_12px_30px_rgba(15,12,13,0.12)]">
                          {filteredCompanyOptions.length > 0 ? (
                            filteredCompanyOptions.map((merchant, index) => (
                              <button
                                key={merchant.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => void handleCompanySearchSelect(merchant)}
                                className={`flex w-full items-center justify-between px-4 py-3 text-left text-[17px] transition ${
                                  index === highlightedCompanyIndex
                                    ? "bg-[#efe9e6] text-[#201e1d]"
                                    : "bg-[#f8f6f5] text-[#3b3634] hover:bg-[#f1efed]"
                                }`}
                              >
                                <span>{merchant.name}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-[16px] text-[#6b625d]">No companies found.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Branch</label>
                    <select
                      value={adminForm.branchId || "choose"}
                      onChange={(event) => {
                        const nextBranchId = event.target.value;
                        const nextBranchName = branchOptions.find((branch) => branch.id === nextBranchId)?.name ?? "";
                        setAdminForm((current) => ({
                          ...current,
                          branchId: nextBranchId === "choose" ? "" : nextBranchId,
                          branchName: nextBranchId === "choose" ? "" : nextBranchName,
                        }));
                      }}
                      disabled={isLoadingBranchOptions || !branchOptions.length}
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#efeeed] px-4 text-[18px] text-[#2f2b29] outline-none transition focus:border-[#b3a7a1] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="choose">{isLoadingBranchOptions ? "Loading branches..." : "Select a branch"}</option>
                      {branchOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {adminError && <div className="mt-4 rounded-[10px] bg-[#f9e8e8] px-3 py-2 text-sm text-[#8a2d2d]">{adminError}</div>}

                <div className="mt-7 flex items-center gap-4">
                  <button type="button" onClick={closeModal} className="h-[54px] flex-1 rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] text-[18px] font-semibold text-[#2d2a28]">
                    Cancel
                  </button>
                  <button type="button" onClick={addCompanyAccess} disabled={isCreatingAdmin} className="h-[54px] flex-1 rounded-[14px] bg-[#6b1b3d] text-[18px] font-semibold text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] disabled:cursor-wait disabled:opacity-60">
                    {isCreatingAdmin ? "Creating..." : "Create"}
                  </button>
                </div>
              </>
            )}

            {activeModal === "admin" && selectedMerchant && (
              <>
                <h2 className="mb-7 text-[32px] font-bold tracking-[-0.04em] text-[#201e1d]">Add Admin</h2>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Company</label>
                    <input
                      value={`${selectedMerchant.name} | ${selectedMerchant.branch}`}
                      readOnly
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Full Name</label>
                    <input
                      value={adminForm.fullName || ""}
                      onChange={(event) => setAdminForm((current) => ({ ...current, fullName: event.target.value }))}
                      placeholder="Orit Samuel"
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Phone</label>
                    <input
                      value={adminForm.phone || ""}
                      onChange={(event) => setAdminForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="+251911822542"
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Remark</label>
                    <input
                      value={adminForm.remark || ""}
                      onChange={(event) => setAdminForm((current) => ({ ...current, remark: event.target.value }))}
                      placeholder="Branch manager"
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    />
                  </div>
                </div>

                {adminError && <div className="mt-4 rounded-[10px] bg-[#f9e8e8] px-3 py-2 text-sm text-[#8a2d2d]">{adminError}</div>}

                <div className="mt-7 flex items-center gap-4">
                  <button type="button" onClick={closeModal} className="h-[54px] flex-1 rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] text-[18px] font-semibold text-[#2d2a28]">
                    Cancel
                  </button>
                  <button type="button" onClick={() => addAdminRowAccess(selectedMerchant)} disabled={isCreatingAdmin} className="h-[54px] flex-1 rounded-[14px] bg-[#6b1b3d] text-[18px] font-semibold text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] disabled:cursor-wait disabled:opacity-60">
                    {isCreatingAdmin ? "Creating..." : "Create"}
                  </button>
                </div>
              </>
            )}

            {activeModal === "details" && selectedMerchant && (
              <>
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] p-3">
                      <div className="text-[12px] uppercase tracking-[0.08em] text-[#5b554f]">Active Admins</div>
                      <div className="mt-2 text-[26px] font-semibold text-[#2a2725]">{selectedMerchant.admins}</div>
                    </div>
                    <div className="rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] p-3">
                      <div className="text-[12px] uppercase tracking-[0.08em] text-[#5b554f]">Total Waiters</div>
                      <div className="mt-2 text-[26px] font-semibold text-[#2a2725]">{selectedMerchant.waiters}</div>
                    </div>
                    <div className="rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] p-3">
                      <div className="text-[12px] uppercase tracking-[0.08em] text-[#5b554f]">QR Status</div>
                      <div className={`mt-2 flex items-center gap-2 text-[15px] font-medium ${selectedMerchant.status === "Active" ? "text-[#1d7a57]" : "text-[#625c58]"}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${selectedMerchant.status === "Active" ? "bg-[#25a56b]" : "bg-[#8e8782]"}`} />
                        {selectedMerchant.status}
                      </div>
                    </div>
                  </div>


                  <div>
                    <h3 className="mb-4 text-[20px] font-semibold text-[#2d2a28]">Admins</h3>
                    {isLoadingAdmins && (
                      <p className="mb-3 text-sm text-[#6b625d]">Loading admins…</p>
                    )}
                    {!isLoadingAdmins && selectedMerchant.admins > 0 && selectedMerchant.adminList.length === 0 && (
                      <p className="mb-3 text-sm text-[#6b625d]">No admins were returned by the company admins endpoint.</p>
                    )}

                    {!isLoadingAdmins && (
                      <div className="overflow-hidden rounded-[12px] border border-[#ded8d5] bg-[#f7f3f1]">
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-collapse text-left text-sm">
                            <thead className="bg-[#efeae8] text-[12px] uppercase tracking-[0.06em] text-[#5f5853]">
                              <tr>
                                <th className="px-3 py-3 font-semibold">Name</th>
                                <th className="px-3 py-3 font-semibold">Phone</th>
                                <th className="px-3 py-3 font-semibold">Status</th>
                                <th className="px-3 py-3 font-semibold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedMerchant.adminList.length > 0 ? (
                                selectedMerchant.adminList.map((admin) => (
                                  <tr key={`${admin.name}-${admin.phone || "no-phone"}`} className="border-t border-[#e4dfdd]">
                                    <td className="px-3 py-3 font-medium text-[#2d2a28]">{admin.name}</td>
                                    <td className="px-3 py-3 text-[#4d4744]">{admin.phone || "—"}</td>
                                    <td className="px-3 py-3">
                                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${admin.status === "Active" ? "bg-[#dff8ef] text-[#1d7a57]" : "bg-[#f4e6e6] text-[#8a2d2d]"}`}>
                                        {admin.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => void toggleAdminStatus(admin)}
                                        className={`rounded-[10px] px-3 py-2 text-[13px] font-semibold ${admin.status === "Active" ? "bg-[#f3e6e9] text-[#7a294d]" : "bg-[#e6f4ea] text-[#1e7b52]"}`}
                                      >
                                        {admin.status === "Active" ? "Terminate" : "Activate"}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="px-3 py-4 text-center text-[15px] text-[#5a544e]">
                                    No admins assigned yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <p className="mt-3 text-sm text-[#6b625d]">Admin removal is unavailable because no removal endpoint is documented.</p>
                  </div>
                </div>
              </>
            )}

            {activeModal === "qr" && (
              <>
                <h2 className="mb-7 text-[32px] font-bold tracking-[-0.04em] text-[#201e1d]">Generate QR Code</h2>

                {!qrGenerated ? (
                  <>
                    <div className="space-y-5">
                      <div>
                        <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Company Name</label>
                        <div data-company-search-root className="relative">
                          <input
                            value={merchantForm.companyName}
                            onFocus={() => {
                              setIsCompanySearchOpen(true);
                              setHighlightedCompanyIndex(0);
                            }}
                            onChange={(event) => {
                              const typedCompanyName = event.target.value;
                              const exactMatch = merchantOptions.find((merchant) => merchant.name.toLowerCase() === typedCompanyName.trim().toLowerCase());

                              setMerchantForm((current) => ({
                                ...current,
                                companyName: typedCompanyName,
                                companyId: exactMatch?.id ?? "",
                                branchId: "",
                                branchName: "",
                              }));

                              if (exactMatch) {
                                setIsCompanySearchOpen(false);
                                setHighlightedCompanyIndex(0);
                                void loadBranchOptions(exactMatch.id);
                                return;
                              }

                              setBranchOptions([]);
                              setIsCompanySearchOpen(true);
                              setHighlightedCompanyIndex(0);
                            }}
                            onKeyDown={(event) => {
                              if (!filteredCompanyOptions.length) return;

                              if (event.key === "ArrowDown") {
                                event.preventDefault();
                                setHighlightedCompanyIndex((current) => (current + 1) % filteredCompanyOptions.length);
                                return;
                              }

                              if (event.key === "ArrowUp") {
                                event.preventDefault();
                                setHighlightedCompanyIndex((current) => (current - 1 + filteredCompanyOptions.length) % filteredCompanyOptions.length);
                                return;
                              }

                              if (event.key === "Enter") {
                                const selectedCompany = filteredCompanyOptions[highlightedCompanyIndex];
                                if (selectedCompany) {
                                  event.preventDefault();
                                  void handleQrCompanySearchSelect(selectedCompany);
                                }
                              }
                            }}
                            placeholder={isLoadingMerchantOptions ? "Loading companies..." : "Type a company name"}
                            disabled={isLoadingMerchantOptions || !merchantOptions.length}
                            className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 pr-12 text-[18px] text-[#2f2b29] outline-none focus:border-[#b3a7a1] disabled:cursor-not-allowed disabled:opacity-60"
                          />

                          {merchantForm.companyName && !isLoadingMerchantOptions && merchantOptions.length > 0 && (
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setMerchantForm((current) => ({ ...current, companyId: "", companyName: "", branchId: "", branchName: "" }));
                                setBranchOptions([]);
                                setIsCompanySearchOpen(true);
                              }}
                              className="absolute inset-y-0 right-3 flex items-center text-[20px] text-[#6b625d] transition hover:text-[#2f2b29]"
                              aria-label="Clear company"
                            >
                              ×
                            </button>
                          )}

                          {isCompanySearchOpen && (
                            <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-[14px] border border-[#d8d1ce] bg-[#f8f6f5] shadow-[0_12px_30px_rgba(15,12,13,0.12)]">
                              {filteredCompanyOptions.length > 0 ? (
                                filteredCompanyOptions.map((merchant, index) => (
                                  <button
                                    key={merchant.id}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => void handleQrCompanySearchSelect(merchant)}
                                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-[17px] transition ${
                                      index === highlightedCompanyIndex
                                        ? "bg-[#efe9e6] text-[#201e1d]"
                                        : "bg-[#f8f6f5] text-[#3b3634] hover:bg-[#f1efed]"
                                    }`}
                                  >
                                    <span>{merchant.name}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-[16px] text-[#6b625d]">No companies found.</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Branch</label>
                        <select
                          value={merchantForm.branchId || "choose"}
                          onChange={(event) => {
                            const nextBranchId = event.target.value;
                            const nextBranchName = branchOptions.find((branch) => branch.id === nextBranchId)?.name ?? "";
                            setMerchantForm((current) => ({
                              ...current,
                              branchId: nextBranchId === "choose" ? "" : nextBranchId,
                              branchName: nextBranchId === "choose" ? "" : nextBranchName,
                            }));
                          }}
                          disabled={isLoadingBranchOptions || !branchOptions.length}
                          className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="choose">{isLoadingBranchOptions ? "Loading branches..." : "Select a branch"}</option>
                          {branchOptions.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Restaurant Logo</label>
                        <input id="restaurant-logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        <label htmlFor="restaurant-logo-upload" className="flex h-[82px] w-full cursor-pointer items-center justify-center gap-3 rounded-[14px] border-2 border-dashed border-[#d7d1ce] bg-[#f8f5f4] px-4 text-center text-[16px] text-[#4a433f]">
                          <span className="text-[22px]">◉</span>
                          {logoFileName || "Upload restaurant logo"}
                        </label>
                      </div>

                    </div>

                    {qrError && <div className="mt-4 rounded-[10px] bg-[#f9e8e8] px-3 py-2 text-sm text-[#8a2d2d]">{qrError}</div>}

                    <div className="mt-7 flex items-center gap-4">
                      <button type="button" onClick={closeModal} className="h-[54px] flex-1 rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] text-[18px] font-semibold text-[#2d2a28]">
                        Cancel
                      </button>
                      <button type="button" onClick={saveMerchant} className="h-[54px] flex-1 rounded-[14px] bg-[#6b1b3d] text-[18px] font-semibold text-white shadow-[0_2px_0_rgba(0,0,0,0.08)]">
                        Generate QR
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        {selectedMerchant && (
                          <QrDisplay value={selectedMerchant.tippingUrl} id={`qr-${selectedMerchant.branchId}`} logo={selectedMerchant.logo} />
                        )}
                      </div>

                      <div className="space-y-3 text-center">
                        <div className="mx-auto flex w-fit items-center justify-center gap-4 rounded-full border border-[#d6cecb] bg-[#f5f2f1] px-3 py-2 text-[17px] text-[#2d2a28]">
                          <span>QR</span>
                          <span>{selectedMerchant?.name || merchantForm.companyName}</span>
                        </div>

                        <div className="text-[18px] text-[#5a544e]">{selectedMerchant?.branch || merchantForm.branchName}</div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[14px] font-medium text-[#4d4944]">Link</div>
                        <input
                          readOnly
                          value={selectedMerchant?.tippingUrl ?? ""}
                          className="h-[46px] w-full rounded-[12px] border border-[#d8d1ce] bg-[#f5f2f1] px-3 text-[14px] text-[#2f2b29] outline-none"
                        />
                      </div>

                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => selectedMerchant && handleDownloadQr(selectedMerchant)}
                          className="inline-flex items-center gap-2 text-[18px] font-semibold text-[#b05575]"
                        >
                          <span>↓</span>
                          Download QR
                        </button>
                      </div>
                    </div>

                    <div className="mt-7 flex items-center gap-4">
                      <button type="button" onClick={closeModal} className="h-[54px] w-full rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] text-[18px] font-semibold text-[#2d2a28]">
                        Close
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </main>
  );
}
