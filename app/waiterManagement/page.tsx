"use client";

import { QRCodeCanvas } from "qrcode.react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { type BranchRecord, loadMockBranches, saveMockBranches } from "./branchRepository";

type ModalType = "add" | "admin" | "qr" | "details" | null;

type MerchantForm = {
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
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
  const baseUrl = (process.env.NEXT_PUBLIC_TIP_FRONTEND_URL ?? "https://waiter-tip.hulubeje.com").replace(/\/$/, "");
  const url = new URL("/tip", baseUrl);
  url.searchParams.set("companyId", String(companyId));
  url.searchParams.set("branchId", String(branchId));
  return url.toString();
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
    getPositiveNumber(company.companyId)
    ?? getPositiveNumber(company.companyCode)
    ?? getPositiveNumber(company.company_id)
    ?? getPositiveNumber(company.id);
  const branchId =
    getPositiveNumber(company.branchId)
    ?? getPositiveNumber(company.branchCode)
    ?? getPositiveNumber(company.branch_id)
    ?? getPositiveNumber(company.id);

  return {
    companyId: companyId ?? 0,
    branchId: branchId ?? 0,
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

  const numericId = typeof company.id === "number" ? company.id : Number(company.id ?? "");
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error("The company list returned an unexpected response.");
  }

  const tipIds = resolveTipIds(company);
  const safeCompanyId = tipIds.companyId > 0 ? tipIds.companyId : numericId;
  const safeBranchId = tipIds.branchId > 0 ? tipIds.branchId : numericId;

  return {
    companyId: numericId,
    restaurantId: String(safeCompanyId),
    name: company.companyName,
    branchId: String(safeBranchId),
    branch: company.branchName,
    token: "",
    tippingUrl: buildFrontEndTipUrl(safeCompanyId, safeBranchId),
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

function QrDisplay({ value, id, logo }: { value: string; id: string; logo?: string }) {
  return (
    <div className="rounded-[16px] bg-[#f1efee] p-3">
      <QRCodeCanvas
        id={id}
        value={value}
        size={120}
        includeMargin={true}
        imageSettings={logo ? { src: logo, height: 28, width: 28, excavate: true } : undefined}
      />
    </div>
  );
}

export default function WaiterManagement() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<BranchRecord | null>(null);
  const [merchantForm, setMerchantForm] = useState<MerchantForm>({ companyId: "", companyName: "", branchId: "", branchName: "" });
  const [adminForm, setAdminForm] = useState({
    companyId: "",
    companyCode: "",
    branchCode: "",
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
  const [merchantOptionsError, setMerchantOptionsError] = useState("");

  const generateCompanyCode = useCallback(() => {
    const maxCode = 999999;
    const minCode = 1000;
    return String(Math.floor(Math.random() * (maxCode - minCode + 1)) + minCode);
  }, []);

  const loadBranchOptions = useCallback(async (merchantId: string) => {
    if (!merchantId) {
      setBranchOptions([]);
      setAdminForm((current) => ({ ...current, branchCode: generateCompanyCode(), branchName: "" }));
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
        companyCode: current.companyCode || generateCompanyCode(),
        companyName: merchantOptions.find((option) => option.id === merchantId)?.name ?? current.companyName,
        branchCode: current.branchCode || generateCompanyCode(),
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
      setAdminForm((current) => ({ ...current, branchCode: generateCompanyCode(), branchName: "" }));
    } finally {
      setIsLoadingBranchOptions(false);
    }
  }, [generateCompanyCode, merchantOptions]);

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
        setAdminForm((current) => ({ ...current, companyId: "", companyCode: generateCompanyCode(), companyName: "", branchCode: generateCompanyCode(), branchName: "" }));
        setMerchantForm((current) => ({ ...current, companyId: "", companyName: "", branchId: "", branchName: "" }));
        return;
      }
      const firstMerchant = nextOptions[0];
      setAdminForm((current) => ({
        ...current,
        companyId: firstMerchant.id,
        companyCode: current.companyCode || generateCompanyCode(),
        companyName: firstMerchant.name,
        branchCode: current.branchCode || generateCompanyCode(),
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
      setAdminForm((current) => ({ ...current, companyId: "", companyCode: generateCompanyCode(), companyName: "", branchCode: generateCompanyCode(), branchName: "" }));
      setMerchantForm((current) => ({ ...current, companyId: "", companyName: "", branchId: "", branchName: "" }));
    } finally {
      setIsLoadingMerchantOptions(false);
    }
  }, [generateCompanyCode, loadBranchOptions]);


  const loadMerchants = useCallback(async () => {
    setIsLoadingMerchants(true);
    setMerchantLoadError("");
    try {
      const persistedMerchants = loadMockBranches();
      if (persistedMerchants.length) {
        setMerchants(persistedMerchants);
      }

      const response = await fetch("/api/waiter-tips/company", {
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, "Unable to load merchants.", response.status));
      if (!Array.isArray(payload)) throw new Error("The company list endpoint returned an unexpected response.");

      const fetchedMerchants = payload.map(mapCompanyDetail);
      const mergedMerchants = [...fetchedMerchants, ...persistedMerchants].reduce<BranchRecord[]>((accumulator, merchant) => {
        const key = `${merchant.companyId ?? merchant.restaurantId}-${merchant.branchId}`;
        if (!accumulator.some((item) => `${item.companyId ?? item.restaurantId}-${item.branchId}` === key)) {
          accumulator.push(merchant);
        }
        return accumulator;
      }, []);

      setMerchants(mergedMerchants);
      saveMockBranches(mergedMerchants);
    } catch (loadError) {
      const persistedMerchants = loadMockBranches();
      if (persistedMerchants.length) {
        setMerchants(persistedMerchants);
      }
      setMerchantLoadError(loadError instanceof Error ? loadError.message : "Unable to load merchants.");
    } finally {
      setIsLoadingMerchants(false);
    }
  }, []);

  useEffect(() => {
    const persistedMerchants = loadMockBranches();
    if (persistedMerchants.length) {
      setMerchants(persistedMerchants);
    }

    const timeoutId = window.setTimeout(() => void loadMerchants(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadMerchants]);

  const existingMerchantOptions = useMemo(
    () => merchants.filter((merchant) => merchant.companyId !== undefined),
    [merchants],
  );

  const openAddAdminAccess = async () => {
    setAdminError("");
    setActiveModal("add");
    setAdminForm({
      companyId: "",
      companyCode: generateCompanyCode(),
      branchCode: generateCompanyCode(),
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
    if (!logoPreview) {
      setQrError("Please upload a restaurant logo before generating the QR code.");
      return;
    }

    const duplicateBranch = merchants.some(
      (merchant) => merchant.name.toLocaleLowerCase() === cleanCompanyName.toLocaleLowerCase()
        && merchant.branch.toLocaleLowerCase() === cleanBranchName.toLocaleLowerCase(),
    );
    if (duplicateBranch) {
      setQrError("This restaurant branch already exists.");
      return;
    }

    try {
      const response = await fetch("/api/waiter-tips/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyCode: selectedCompanyId,
          branchCode: selectedBranchId,
          companyName: cleanCompanyName,
          branchName: cleanBranchName,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getApiError(payload, "Unable to create the merchant company.", response.status));
      }

      const createdCompany = payload && typeof payload === "object" ? payload as Partial<CompanyDetail> & Record<string, unknown> : null;
      if (!createdCompany || typeof createdCompany.companyName !== "string" || typeof createdCompany.branchName !== "string") {
        throw new Error("The company creation endpoint returned an unexpected response.");
      }

      const nextMerchant = mapCompanyDetail({
        ...createdCompany,
        companyId: selectedCompanyId,
        companyCode: selectedCompanyId,
        branchId: selectedBranchId,
        branchCode: selectedBranchId,
      });
      nextMerchant.logo = logoPreview;
      nextMerchant.tippingUrl = buildFrontEndTipUrl(selectedCompanyId, selectedBranchId);

      setMerchants((current) => {
        const merged = [nextMerchant, ...current];
        saveMockBranches(merged);
        return merged;
      });
      setSelectedMerchant(nextMerchant);
      setQrGenerated(true);
      setQrError("");
    } catch (createError) {
      const fallback = createError instanceof Error ? createError.message : "Unable to create the merchant company.";
      setQrError(fallback);
    }
  };

  const addCompanyAccess = async () => {
    const companyCode = Number(adminForm.companyCode);
    const branchCode = Number(adminForm.branchCode);
    const cleanCompany = adminForm.companyName.trim();
    const cleanBranch = adminForm.branchName.trim();

    if (!cleanCompany || !cleanBranch) {
      setAdminError("Please choose both the company and branch from the dropdowns.");
      return;
    }

    if (!Number.isInteger(companyCode) || companyCode <= 0) {
      setAdminError("Company code is missing or invalid. Please generate a new code.");
      return;
    }

    if (!Number.isInteger(branchCode) || branchCode <= 0) {
      setAdminError("Branch code is missing or invalid. Please generate a new code.");
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
    const companyId = merchant.companyId ?? Number(merchant.restaurantId);
    const fullName = adminForm.fullName.trim();
    const phone = adminForm.phone.trim();
    const remark = adminForm.remark.trim();

    if (!Number.isInteger(companyId) || companyId <= 0) {
      setAdminError("Please select a valid company before adding an admin.");
      return;
    }

    if (!fullName || !phone) {
      setAdminError("Please enter the admin's full name and phone number.");
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const response = await fetch(`/api/waiter-tips/companies/${companyId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, remark }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, "Unable to add admin.", response.status));

      setAdminError("");
      closeModal();
      if (merchant.companyId !== undefined) {
        setMerchants((current) => current.map((item) => {
          if (item.companyId !== merchant.companyId) return item;
          return {
            ...item,
            admins: item.admins + 1,
            phone: phone || item.phone,
            adminList: [...item.adminList, phone],
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

  const openDetails = (merchant: BranchRecord) => {
    setSelectedMerchant(merchant);
    setActiveModal("details");
  };

  const openAdminModal = (merchant: BranchRecord) => {
    setSelectedMerchant(merchant);
    setAdminError("");
    setActiveModal("admin");
    setAdminForm({
      companyId: merchant.companyId !== undefined ? String(merchant.companyId) : "",
      companyCode: "",
      branchCode: "",
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
                          onClick={() => openDetails(merchant)}
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
                <h2 className="mb-7 text-[32px] font-bold tracking-[-0.04em] text-[#201e1d]">Add Company</h2>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Company Name</label>
                    <select
                      value={adminForm.companyId || "choose"}
                      onChange={async (event) => {
                        const nextMerchantId = event.target.value;
                        if (!nextMerchantId || nextMerchantId === "choose") {
                          setAdminForm((current) => ({ ...current, companyId: "", companyCode: generateCompanyCode(), companyName: "", branchCode: generateCompanyCode(), branchName: "" }));
                          setBranchOptions([]);
                          return;
                        }
                        const companyName = merchantOptions.find((merchant) => merchant.id === nextMerchantId)?.name ?? "";
                        setAdminForm((current) => ({ ...current, companyId: nextMerchantId, companyCode: current.companyCode || generateCompanyCode(), companyName, branchCode: current.branchCode || generateCompanyCode(), branchName: "" }));
                        await loadBranchOptions(nextMerchantId);
                      }}
                      disabled={isLoadingMerchantOptions || !merchantOptions.length}
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="choose">{isLoadingMerchantOptions ? "Loading companies..." : "Select a company"}</option>
                      {merchantOptions.map((merchant) => (
                        <option key={merchant.id} value={merchant.id}>{merchant.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Branch Name</label>
                    <select
                      value={adminForm.branchName || "choose"}
                      onChange={(event) => setAdminForm((current) => ({
                        ...current,
                        branchCode: current.branchCode || generateCompanyCode(),
                        branchName: event.target.value === "choose" ? "" : event.target.value,
                      }))}
                      disabled={isLoadingBranchOptions || !branchOptions.length}
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="choose">{isLoadingBranchOptions ? "Loading branches..." : "Select a branch"}</option>
                      {branchOptions.map((branch) => (
                        <option key={branch.id} value={branch.name}>{branch.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Company Code</label>
                    <input
                      value={adminForm.companyCode || ""}
                      readOnly
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Branch Code</label>
                    <input
                      value={adminForm.branchCode || ""}
                      readOnly
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    />
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

            {activeModal === "qr" && (
              <>
                <h2 className="mb-7 text-[32px] font-bold tracking-[-0.04em] text-[#201e1d]">Generate QR Code</h2>

                {!qrGenerated ? (
                  <>
                    <div className="space-y-5">
                      <div>
                        <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Company Name</label>
                        <select
                          value={merchantForm.companyId || "choose"}
                          onChange={async (event) => {
                            const nextCompanyId = event.target.value;
                            if (!nextCompanyId || nextCompanyId === "choose") {
                              setMerchantForm((current) => ({ ...current, companyId: "", companyName: "", branchId: "", branchName: "" }));
                              setBranchOptions([]);
                              return;
                            }
                            const nextCompanyName = merchantOptions.find((merchant) => merchant.id === nextCompanyId)?.name ?? "";
                            setMerchantForm((current) => ({
                              ...current,
                              companyId: nextCompanyId,
                              companyName: nextCompanyName,
                              branchId: "",
                              branchName: "",
                            }));
                            await loadBranchOptions(nextCompanyId);
                          }}
                          disabled={isLoadingMerchantOptions || !merchantOptions.length}
                          className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="choose">{isLoadingMerchantOptions ? "Loading companies..." : "Select a company"}</option>
                          {merchantOptions.map((merchant) => (
                            <option key={merchant.id} value={merchant.id}>{merchant.name}</option>
                          ))}
                        </select>
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
                      <button type="button" onClick={closeModal} className="h-[54px] flex-1 rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] text-[18px] font-semibold text-[#2d2a28]">
                        Cancel
                      </button>
                      <button type="button" onClick={closeModal} className="h-[54px] flex-1 rounded-[14px] bg-[#1d7a57] text-[18px] font-semibold text-white shadow-[0_2px_0_rgba(0,0,0,0.08)]">
                        Save Merchant
                      </button>
                    </div>
                  </>
                )}
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
                    <h3 className="mb-4 text-[20px] font-semibold text-[#2d2a28]">QR Code</h3>
                    {selectedMerchant.tippingUrl ? (
                      <>
                        <div className="flex justify-center">
                          <QRCodeCanvas
                            id={`qr-${selectedMerchant.branchId}`}
                            value={selectedMerchant.tippingUrl}
                            size={120}
                            includeMargin={true}
                            imageSettings={selectedMerchant.logo ? { src: selectedMerchant.logo, height: 28, width: 28, excavate: true } : undefined}
                          />
                        </div>

                        <div className="mt-4 text-center text-[15px] text-[#4d4944]">{selectedMerchant.name} | {selectedMerchant.branch}</div>

                        <div className="mt-4 space-y-2">
                          <label htmlFor="branch-tipping-url" className="block text-[14px] font-medium text-[#4d4944]">Tipping URL</label>
                          <input
                            id="branch-tipping-url"
                            readOnly
                            value={selectedMerchant.tippingUrl}
                            className="h-[46px] w-full rounded-[12px] border border-[#d8d1ce] bg-[#f5f2f1] px-3 text-[14px] text-[#2f2b29] outline-none"
                          />
                        </div>

                        <div className="mt-5 flex justify-center">
                          <button type="button" onClick={() => handleDownloadQr(selectedMerchant)} className="inline-flex items-center gap-2 text-[18px] font-semibold text-[#b05575]">
                            <span>↓</span>
                            Download QR
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="rounded-[12px] border border-dashed border-[#d7d1ce] bg-[#f8f5f4] p-3 text-center text-[15px] text-[#5a544e]">
                        QR details are not returned by the current company API.
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-4 text-[20px] font-semibold text-[#2d2a28]">Admins</h3>
                    {selectedMerchant.admins > 0 && selectedMerchant.adminList.length === 0 && (
                      <p className="mb-3 text-sm text-[#6b625d]">The company list API provides the admin count, but not the admins’ phone numbers.</p>
                    )}
                    <div className="space-y-3">
                      {selectedMerchant.adminList.map((adminPhone) => (
                        <div key={adminPhone} className="flex items-center justify-between rounded-[12px] border border-[#ded8d5] bg-[#f7f3f1] p-3">
                          <div>
                            <div className="text-[18px] font-medium text-[#2d2a28]">{selectedMerchant.name} · {selectedMerchant.branch}</div>
                            <div className="mt-1 text-[15px] text-[#5a544e]">{adminPhone}</div>
                          </div>
                        </div>
                      ))}

                      {selectedMerchant.adminList.length === 0 && selectedMerchant.admins === 0 && (
                        <div className="rounded-[12px] border border-dashed border-[#d7d1ce] bg-[#f8f5f4] p-3 text-[15px] text-[#5a544e]">
                          No admins assigned yet.
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-[#6b625d]">Admin removal is unavailable because no removal endpoint is documented.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
