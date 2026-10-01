"use client";

import { QRCodeCanvas } from "qrcode.react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { type BranchRecord, createMockBranch, loadMockBranches, saveMockBranches } from "./branchRepository";

type ModalType = "add" | "qr" | "details" | null;

type MerchantForm = {
  companyName: string;
  branchName: string;
};

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
  const [merchantForm, setMerchantForm] = useState<MerchantForm>({ companyName: "", branchName: "" });
  const [adminForm, setAdminForm] = useState({ companyName: "", branchName: "", phone: "" });
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrError, setQrError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [merchants, setMerchants] = useState<BranchRecord[]>(() => loadMockBranches());

  useEffect(() => {
    saveMockBranches(merchants);
  }, [merchants]);

  const existingMerchantOptions = useMemo(
    () => merchants.map((merchant) => `${merchant.name} | ${merchant.branch}`),
    [merchants],
  );

  const selectedCompanyBranchValue =
    adminForm.companyName && adminForm.branchName
      ? `${adminForm.companyName} | ${adminForm.branchName}`
      : "choose";

  const openAddAdminAccess = () => {
    setAdminError("");
    setActiveModal("add");
    if (merchants.length > 0) {
      const firstMerchant = merchants[0];
      setAdminForm({
        companyName: firstMerchant.name,
        branchName: firstMerchant.branch,
        phone: "",
      });
    } else {
      setAdminForm({ companyName: "", branchName: "", phone: "" });
    }
  };

  const openGenerateQr = () => {
    setQrError("");
    setQrGenerated(false);
    setLogoPreview("");
    setLogoFileName("");
    setMerchantForm({ companyName: "", branchName: "" });
    setActiveModal("qr");
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
  };

  const saveMerchant = () => {
    const cleanCompanyName = (merchantForm.companyName ?? "").trim();
    const cleanBranchName = (merchantForm.branchName ?? "").trim();

    if (!cleanCompanyName || !cleanBranchName) {
      setQrError("Please enter both the company name and branch name.");
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

    const nextMerchant = createMockBranch(
      { companyName: cleanCompanyName, branchName: cleanBranchName, logo: logoPreview },
      merchants,
    );

    setMerchants((current) => [nextMerchant, ...current]);
    setSelectedMerchant(nextMerchant);
    setQrGenerated(true);
    setQrError("");
  };

  const addAdminAccess = () => {
    const chosenCompany = (adminForm.companyName ?? "").trim();
    const chosenBranch = (adminForm.branchName ?? "").trim();
    const cleanPhone = (adminForm.phone ?? "").trim();

    if (!chosenCompany || !chosenBranch) {
      setAdminError("Please choose an existing company and branch.");
      return;
    }

    if (!cleanPhone) {
      setAdminError("Please enter a phone number for the admin access.");
      return;
    }

    const merchantIndex = merchants.findIndex(
      (merchant) =>
        merchant.name.toLowerCase() === chosenCompany.toLowerCase() &&
        merchant.branch.toLowerCase() === chosenBranch.toLowerCase(),
    );

    if (merchantIndex < 0) {
      setAdminError("That company and branch do not exist yet. Create the QR first.");
      return;
    }

    setMerchants((current) =>
      current.map((merchant, index) => {
        if (index !== merchantIndex) return merchant;

        const nextAdminList = [...(merchant.adminList || []), cleanPhone];

        return {
          ...merchant,
          admins: nextAdminList.length,
          phone: cleanPhone || merchant.phone,
          adminList: nextAdminList,
        };
      }),
    );

    setSelectedMerchant((current) =>
      current && current.name.toLowerCase() === chosenCompany.toLowerCase() && current.branch.toLowerCase() === chosenBranch.toLowerCase()
        ? {
            ...current,
            admins: (current.adminList?.length ?? current.admins) + 1,
            phone: cleanPhone || current.phone,
            adminList: [...(current.adminList || []), cleanPhone],
          }
        : current,
    );

    setAdminError("");
    closeModal();
  };

  const removeAdmin = (phoneToRemove: string) => {
    if (!selectedMerchant) return;

    const merchantIndex = merchants.findIndex(
      (merchant) =>
        merchant.name.toLowerCase() === selectedMerchant.name.toLowerCase() &&
        merchant.branch.toLowerCase() === selectedMerchant.branch.toLowerCase(),
    );

    if (merchantIndex < 0) return;

    setMerchants((current) =>
      current.map((merchant, index) => {
        if (index !== merchantIndex) return merchant;

        const nextAdminList = (merchant.adminList || []).filter((adminPhone) => adminPhone !== phoneToRemove);
        return {
          ...merchant,
          admins: nextAdminList.length,
          adminList: nextAdminList,
          phone: nextAdminList[0] || "",
        };
      }),
    );

    const nextAdminList = (selectedMerchant.adminList || []).filter((adminPhone) => adminPhone !== phoneToRemove);
    setSelectedMerchant({
      ...selectedMerchant,
      admins: nextAdminList.length,
      adminList: nextAdminList,
      phone: nextAdminList[0] || "",
    });
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

  return (
    <main className="min-h-screen bg-[#f3f2f1] px-4 pb-6 pt-[92px] text-[#2d2a28] md:ml-60 md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[42px] font-bold tracking-[-0.04em] text-[#1f1d1b]">Waiter Management</h1>
            <p className="mt-1 text-[18px] text-[#5a544e]">{merchants.length} merchants registered</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openAddAdminAccess}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[#d5d0cc] bg-[#f7f3f1] px-5 py-3 text-[17px] font-medium text-[#2d2a28] shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:bg-[#f0ecea]"
            >
              <span className="text-[19px] leading-none">＋</span>
              Add Admin Access
            </button>

            <button
              type="button"
              onClick={openGenerateQr}
              className="inline-flex items-center gap-2 rounded-[14px] bg-[#6b1b3d] px-5 py-3 text-[17px] font-semibold text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition hover:bg-[#58152f]"
            >
              <span className="text-[18px] leading-none">◫</span>
              Generate QR
            </button>
          </div>
        </div>

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
                          className="rounded-[12px] border border-[#f0c399] bg-[#fff3e8] px-4 py-2 text-[15px] font-medium text-[#d5782a] transition hover:bg-[#fbe8d4]"
                        >
                          Void QR
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
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[18px] border border-[#ded8d5] bg-[#f3f0ee] p-5 shadow-[0_20px_60px_rgba(10,10,12,0.18)]">
            {activeModal === "add" && (
              <>
                <h2 className="mb-7 text-[32px] font-bold tracking-[-0.04em] text-[#201e1d]">Add Admin Access</h2>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Company Name</label>
                    <select
                      value={selectedCompanyBranchValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!value || value === "choose") {
                          setAdminForm((current) => ({ ...current, companyName: "", branchName: "" }));
                          return;
                        }

                        const [companyName, branchName] = value.split(" | ");
                        setAdminForm((current) => ({ ...current, companyName: companyName || "", branchName: branchName || "" }));
                      }}
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    >
                      <option value="choose">Select a company</option>
                      {existingMerchantOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Branch Name</label>
                    <input
                      value={adminForm.branchName || ""}
                      readOnly
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Phone Number</label>
                    <input
                      value={adminForm.phone ?? ""}
                      onChange={(event) => setAdminForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="091212121212"
                      className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                    />
                  </div>
                </div>

                {adminError && <div className="mt-4 rounded-[10px] bg-[#f9e8e8] px-3 py-2 text-sm text-[#8a2d2d]">{adminError}</div>}

                <div className="mt-7 flex items-center gap-4">
                  <button type="button" onClick={closeModal} className="h-[54px] flex-1 rounded-[14px] border border-[#d7d1ce] bg-[#f7f3f1] text-[18px] font-semibold text-[#2d2a28]">
                    Cancel
                  </button>
                  <button type="button" onClick={addAdminAccess} className="h-[54px] flex-1 rounded-[14px] bg-[#6b1b3d] text-[18px] font-semibold text-white shadow-[0_2px_0_rgba(0,0,0,0.08)]">
                    Create
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
                        <input
                          value={merchantForm.companyName || ""}
                          onChange={(event) => setMerchantForm((current) => ({ ...current, companyName: event.target.value }))}
                          className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[16px] font-medium text-[#2f2b29]">Branch</label>
                        <input
                          value={merchantForm.branchName || ""}
                          onChange={(event) => setMerchantForm((current) => ({ ...current, branchName: event.target.value }))}
                          className="h-[54px] w-full rounded-[14px] border border-[#d8d1ce] bg-[#f5f2f1] px-4 text-[18px] text-[#2f2b29] outline-none"
                        />
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
                      <div className="mt-2 flex items-center gap-2 text-[15px] font-medium text-[#1d7a57]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#25a56b]" />
                        Active
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-4 text-[20px] font-semibold text-[#2d2a28]">QR Code</h3>
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
                  </div>

                  <div>
                    <h3 className="mb-4 text-[20px] font-semibold text-[#2d2a28]">Admins</h3>
                    <div className="space-y-3">
                      {(selectedMerchant.adminList?.length ? selectedMerchant.adminList : selectedMerchant.phone ? [selectedMerchant.phone] : []).map((adminPhone) => (
                        <div key={adminPhone} className="flex items-center justify-between rounded-[12px] border border-[#ded8d5] bg-[#f7f3f1] p-3">
                          <div>
                            <div className="text-[18px] font-medium text-[#2d2a28]">{selectedMerchant.name} · {selectedMerchant.branch}</div>
                            <div className="mt-1 text-[15px] text-[#5a544e]">{adminPhone}</div>
                          </div>
                          <button type="button" onClick={() => removeAdmin(adminPhone)} className="text-[15px] font-medium text-[#b05575]">
                            Remove
                          </button>
                        </div>
                      ))}

                      {(!selectedMerchant.adminList || selectedMerchant.adminList.length === 0) && !selectedMerchant.phone && (
                        <div className="rounded-[12px] border border-dashed border-[#d7d1ce] bg-[#f8f5f4] p-3 text-[15px] text-[#5a544e]">
                          No admins assigned yet.
                        </div>
                      )}
                    </div>
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

