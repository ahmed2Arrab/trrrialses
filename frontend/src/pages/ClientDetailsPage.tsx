import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
// احذف السطر ده
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  useAuthStore,
  canEdit,
  canViewFinancials,
  isStaff,
} from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { toast } from "react-toastify";
import type { Client, Document, Expense, Payment, Tip } from "../types";
import {
  getClientPaidDisplay,
  getExpensesTotal,
  getTipsTotal,
} from "../utils/clientModel";
import { api } from "../utils/api";
import { downloadHtmlNodeAsPdf } from "../utils/pdfGenerator";
import { CountUp } from "../components/CountUp";
import { ScrollReveal } from "../components/ScrollReveal";
import { ToastContainer } from "react-toastify";
import { RippleButton } from "../components/RippleButton";

type EditField = "phone" | "totalContract" | "paid" | null;
type SubModal =
  | { kind: "exp" }
  | { kind: "tip" }
  | { kind: "newMoney" }
  | { kind: "doc"; editIndex: number | null }
  | null;

export const ClientDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const { user } = useAuthStore();
  const {
    clients,
    updateClient,
    uploadClientFile,
    deleteClientFile,
    isLoading,
  } = useDataStore();

  const client = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  if (!client) {
    if (isLoading || clients.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-screen dash-bg">
          <div className="space-y-4 text-center">
            <div className="inline-block w-10 h-10 border-4 border-yellow-500 rounded-full border-t-transparent animate-spin" />
            <p className="font-bold text-gray-700 dark:text-white">
              جاري التحميل...
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 dash-bg">
        <p className="text-lg font-bold text-dash-primary dark:text-white">
          العميل غير موجود
        </p>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="max-w-xs dash-btn"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [subModal, setSubModal] = useState<SubModal>(null);
  const [pdfPreview, setPdfPreview] = useState<{
    title: string;
    filename: string;
  } | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfContentType, setPdfContentType] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const statementRef = useRef<HTMLDivElement>(null);

  const staff = isStaff(user?.role);
  const canFin = canViewFinancials(user?.role);
  const canEditUi = canEdit(user?.role);
  const canEditContact = canEditUi;

  const paidDisplay = client ? getClientPaidDisplay(client) : 0;
  const tipsTotal = client ? getTipsTotal(client) : 0;
  const expensesTotal = client ? getExpensesTotal(client) : 0;

  const openEdit = (field: Exclude<EditField, null>) => {
    if (!client) return;
    if (field === "phone" && !canEditContact) return;
    if ((field === "totalContract" || field === "paid") && !canEditUi) return;
    setEditField(field);
    if (field === "phone") setEditValue(client.phone || "");
    else if (field === "totalContract")
      setEditValue(String(client.totalContract ?? client.paid ?? 0));
    else setEditValue(String(client.paid ?? 0));
  };

  const saveEdit = async () => {
    if (!client || !editField) return;
    try {
      if (editField === "phone") {
        await updateClient(client.id, { phone: editValue.trim() });
        toast.success("تم الحفظ بنجاح");
      } else if (editField === "totalContract") {
        const n = parseFloat(editValue);
        if (Number.isNaN(n)) throw new Error("رقم غير صالح");
        await updateClient(client.id, { totalContract: n });
        toast.success("تم الحفظ بنجاح");
      } else if (editField === "paid") {
        const n = parseFloat(editValue);
        if (Number.isNaN(n)) throw new Error("رقم غير صالح");
        await updateClient(client.id, { paid: n });
        toast.success("تم الحفظ بنجاح");
      }
      setEditField(null);
    } catch {
      toast.error("تعذر الحفظ");
    }
  };

  const saveDoc = async (idx: number | null, doc: Document) => {
    if (!client) return;
    const docs = [...(client.docs || [])];
    if (idx === null) docs.push(doc);
    else docs[idx] = doc;
    await updateClient(client.id, { docs });
    toast.success(idx === null ? "تمت الإضافة" : "تم التعديل");
    setSubModal(null);
  };

  const saveSubExpense = async (e: Expense) => {
    if (!client) return;
    await updateClient(client.id, {
      expenses: [...(client.expenses || []), e],
    });
    toast.success("تم تسجيل المصروف");
    setSubModal(null);
  };

  const saveSubTip = async (t: Tip) => {
    if (!client) return;
    await updateClient(client.id, {
      tips: [...(client.tips || []), t],
    });
    toast.success("تم التسجيل");
    setSubModal(null);
  };

  const saveSubPayment = async (p: Payment) => {
    if (!client) return;
    await updateClient(client.id, {
      payments: [...(client.payments || []), p],
    });
    toast.success("تم التسجيل");
    setSubModal(null);
  };

  const previewFile = useCallback(async (filename: string, title: string) => {
    setPdfPreview({ title, filename });
    setPdfLoading(true);
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      const { data } = await api.post("/api/pdf-data", { filename });
      if (!data.success) throw new Error(data.error);
      const binary = atob(data.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      setPdfContentType(data.contentType as string);
      setPdfBlobUrl(url);
    } catch {
      toast.error("خطأ في التحميل");
      setPdfPreview(null);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const closePdfPreview = () => {
    setPdfPreview(null);
    setPdfContentType(null);
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const downloadFile = (path: string, originalName: string) => {
    const u = new URL(path, window.location.origin);
    const a = document.createElement("a");
    a.href = u.href;
    a.download = originalName;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const generateStatement = async () => {
    if (!statementRef.current || !client) return;
    try {
      await downloadHtmlNodeAsPdf(
        statementRef.current,
        `كشف_حساب_${client.name.replace(/\s+/g, "_")}.pdf`,
      );
      toast.success("تم إنشاء ملف PDF");
    } catch {
      toast.error("فشل إنشاء الملف");
    }
  };

  return (
    <div className="relative flex h-screen overflow-hidden text-gray-800 bg-brand-bg dark:bg-slate-900 dark:text-gray-100">
      <motion.button
        type="button"
        onClick={() => navigate("/dashboard")}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="absolute z-50 flex items-center gap-2 px-5 py-2 font-bold text-white border shadow-lg top-4 left-4 bg-brand-dark dark:bg-slate-800 rounded-xl hover:bg-black dark:border-slate-600"
      >
        <i className="fas fa-arrow-right"></i> العودة
      </motion.button>

      <aside className="z-10 flex flex-col bg-white border-l border-gray-200 shadow-xl w-80 dark:bg-slate-800 dark:border-slate-700 mt-14 md:mt-0">
        <div className="p-6 text-center border-b-4 sidebar-gradient-header border-brand-gold">
          <h2 className="text-xl font-black text-white">{client.name}</h2>
          <p className="mt-1 text-sm font-bold text-brand-gold">
            قطعة: {client.plot}
          </p>
        </div>
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          <div>
            <p className="mb-1 text-xs font-bold text-gray-400">رقم الجوال</p>
            <div
              className={`flex items-center gap-3 bg-gray-50 dark:bg-slate-700 p-3 rounded-xl border border-gray-100 dark:border-slate-600 shadow-sm ${
                canEditContact ? "editable-item cursor-pointer" : ""
              }`}
              onClick={() => canEditContact && openEdit("phone")}
            >
              <i className="fas fa-phone text-brand-gold"></i>
              <span id="clientPhoneText" className="font-bold">
                {client.phone || "اضغط للإضافة"}
              </span>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-gray-400">
              أصل مبلغ التعاقد
            </p>
            <div
              className={`flex items-center gap-3 bg-gray-50 dark:bg-slate-700 p-3 rounded-xl border border-gray-100 dark:border-slate-600 shadow-sm ${
                canEditUi ? "editable-item cursor-pointer" : ""
              }`}
              onClick={() => canEditUi && openEdit("totalContract")}
            >
              <i className="fas fa-money-bill text-brand-gold"></i>
              <span className="font-bold">
                {(client.totalContract ?? client.paid).toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex-1 p-8 overflow-y-auto mt-14 md:mt-0">
        <ScrollReveal>
          <header className="flex flex-wrap items-center justify-between gap-4 p-6 mb-8 bg-white border border-gray-100 shadow-sm dark:bg-slate-800 rounded-3xl dark:border-slate-700">
            <div>
              <h1 className="text-3xl font-black text-brand-dark dark:text-white">
                لوحة تحكم العميل
              </h1>
              <p className="mt-1 font-semibold text-gray-500 dark:text-gray-400">
                إدارة الشؤون المالية والمستندات
              </p>
            </div>
            {canFin && (
              <RippleButton
                type="button"
                onClick={() => void generateStatement()}
                className="flex items-center gap-2 px-6 py-3 font-black text-white shadow-lg bg-brand-gold rounded-2xl hover:bg-yellow-600"
              >
                <i className="fas fa-file-invoice-dollar"></i> معاينة كشف الحساب
              </RippleButton>
            )}
          </header>
        </ScrollReveal>

        {canFin && (
          <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2">
            <ScrollReveal delay={0.1}>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border-b-8 border-green-500 flex flex-col justify-between min-h-[14rem]">
                <div>
                  <p className="mb-1 text-sm font-bold text-gray-400">
                    إجمالي ما دفعه العميل
                  </p>
                  <h3 className="text-4xl font-black text-green-600 dark:text-green-400">
                    <CountUp end={paidDisplay} suffix=" ج.م" />
                  </h3>
                </div>
                {canEditUi && (
                  <motion.button
                    type="button"
                    onClick={() => openEdit("paid")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center w-full gap-2 py-3 mt-4 font-bold text-gray-600 bg-gray-50 dark:bg-slate-700 dark:text-gray-300 rounded-xl hover:bg-green-500 dark:hover:bg-green-600 hover:text-white"
                  >
                    <i className="fas fa-pen"></i> تحديث المبلغ
                  </motion.button>
                )}
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border-b-8 border-red-500 min-h-[14rem] flex flex-col justify-between">
                <div>
                  <p className="mb-1 text-sm font-bold text-gray-400">
                    المتبقي على العميل (دين)
                  </p>
                  <h3 className="text-4xl font-black text-red-600 dark:text-red-400">
                    <CountUp end={tipsTotal} suffix=" ج.م" />
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-2">
                    * تشمل (أصل المبلغ المتبقي + الإكراميات)
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        )}

        {canFin && (
          <div className="grid grid-cols-1 gap-6 mb-6 xl:grid-cols-2">
            <ScrollReveal delay={0.05}>
              <div className="flex flex-col p-6 bg-white border border-gray-100 shadow-sm dark:bg-slate-800 rounded-3xl dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="flex items-center gap-2 text-xl font-black text-brand-dark dark:text-white">
                    <i className="fas fa-receipt text-brand-gold"></i> المصروفات
                    (تخصم من الأصل)
                  </h3>
                  {canEditUi && (
                    <button
                      type="button"
                      onClick={() => setSubModal({ kind: "exp" })}
                      className="px-3 py-1 text-sm font-bold text-gray-600 transition rounded-lg bg-gray-50 dark:bg-slate-700 dark:text-gray-200 hover:bg-gray-200"
                    >
                      إضافة +
                    </button>
                  )}
                </div>
                <div className="pr-1 overflow-y-auto max-h-64">
                  <table className="w-full text-sm text-right">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="p-3 font-bold">البيان</th>
                        <th className="p-3 font-bold">التاريخ</th>
                        <th className="p-3 font-bold">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(client.expenses || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="p-4 text-center text-gray-400"
                          >
                            لا توجد مصروفات
                          </td>
                        </tr>
                      ) : (
                        (client.expenses || []).map((e, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-100 dark:border-slate-700"
                          >
                            <td className="p-3 font-bold">{e.reason}</td>
                            <td className="p-3 text-xs text-gray-500">
                              {e.date}
                            </td>
                            <td className="p-3 font-bold text-red-500">
                              -{e.amount} ج.م
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="flex flex-col p-6 bg-white border border-gray-100 shadow-sm dark:bg-slate-800 rounded-3xl dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="flex items-center gap-2 text-xl font-black text-brand-dark dark:text-white">
                    <i className="fas fa-hand-holding-heart text-brand-gold"></i>
                    إكراميات المصالح (تضاف للدين)
                  </h3>
                  {canEditUi && (
                    <button
                      type="button"
                      onClick={() => setSubModal({ kind: "tip" })}
                      className="px-3 py-1 text-sm font-bold text-orange-600 transition rounded-lg bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100"
                    >
                      إضافة +
                    </button>
                  )}
                </div>
                <div className="pr-1 overflow-y-auto max-h-64">
                  <table className="w-full text-sm text-right">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="p-3 font-bold">المصلحة</th>
                        <th className="p-3 font-bold">من سدد؟</th>
                        <th className="p-3 font-bold">التاريخ</th>
                        <th className="p-3 font-bold">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(client.tips || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-4 text-center text-gray-400"
                          >
                            لا توجد إكراميات
                          </td>
                        </tr>
                      ) : (
                        (client.tips || []).map((t, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-100 dark:border-slate-700"
                          >
                            <td className="p-3 font-bold">{t.reason}</td>
                            <td className="p-3 text-xs text-gray-500">
                              {t.payer}
                            </td>
                            <td className="p-3 text-xs text-gray-500">
                              {t.date}
                            </td>
                            <td className="p-3 font-bold text-orange-600">
                              +{t.amount} ج.م
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <div className="flex flex-col p-6 bg-white border border-gray-100 shadow-sm dark:bg-slate-800 rounded-3xl dark:border-slate-700 xl:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="flex items-center gap-2 text-xl font-black text-brand-dark dark:text-white">
                    <i className="text-orange-500 fas fa-hand-holding-heart"></i>
                    مدخلات العميل الى المكتب
                  </h3>
                  {canEditUi && (
                    <button
                      type="button"
                      onClick={() => setSubModal({ kind: "newMoney" })}
                      className="px-3 py-1 text-sm font-bold text-orange-600 transition rounded-lg bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100"
                    >
                      إضافة +
                    </button>
                  )}
                </div>
                <div className="pr-1 overflow-y-auto max-h-64">
                  <table className="w-full text-sm text-right">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="p-3 font-bold">من استلم؟</th>
                        <th className="p-3 font-bold">التاريخ</th>
                        <th className="p-3 font-bold">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(client.payments || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="p-4 text-center text-gray-400"
                          >
                            لا توجد مدفوعات مسجلة
                          </td>
                        </tr>
                      ) : (
                        (client.payments || []).map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-gray-100 dark:border-slate-700"
                          >
                            <td className="p-3 font-bold">{p.receiver}</td>
                            <td className="p-3 text-xs text-gray-500">
                              {p.date}
                            </td>
                            <td className="p-3 font-bold text-green-600">
                              +{Number(p.amount).toLocaleString()} ج.م
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollReveal>
          </div>
        )}

        {true && (
          <div className="p-6 mb-6 bg-white border border-gray-100 shadow-sm dark:bg-slate-800 rounded-3xl dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <h3 className="flex items-center gap-2 text-xl font-black text-brand-dark dark:text-white">
                <i className="text-blue-500 fas fa-file-export"></i> تتبع حركة
                الورق
              </h3>
              {(canEditUi || staff) && (
                <button
                  type="button"
                  onClick={() => setSubModal({ kind: "doc", editIndex: null })}
                  className="px-3 py-1 text-sm font-bold text-blue-600 transition rounded-lg bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100"
                >
                  إضافة حركة +
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-64">
              <table className="w-full text-sm text-right">
                <thead className="sticky top-0 bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th className="p-3 font-bold">المستلم</th>
                    <th className="p-3 font-bold">الورقة</th>
                    <th className="p-3 font-bold">الغرض</th>
                    <th className="p-3 font-bold">المكان</th>
                    <th className="p-3 font-bold">التاريخ</th>
                    <th className="p-3 font-bold">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {(client.docs || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-400">
                        لا توجد حركات ورق
                      </td>
                    </tr>
                  ) : (
                    (client.docs || []).map((d, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        <td className="p-3 font-bold">{d.person}</td>
                        <td className="p-3">{d.name}</td>
                        <td className="p-3 text-gray-600">{d.purpose}</td>
                        <td className="p-3 font-bold">{d.place}</td>
                        <td className="p-3 text-xs text-gray-500">{d.date}</td>
                        <td className="p-3">
                          {(canEditUi || staff) && (
                            <button
                              type="button"
                              onClick={() =>
                                setSubModal({ kind: "doc", editIndex: i })
                              }
                              className="px-3 py-1 font-bold text-blue-600 transition rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100"
                            >
                              <i className="fas fa-pen"></i> تعديل
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <FileSection
            title="أرشيف ملفات"
            iconClass="fa-file-zipper text-[rgb(227,61,12)]"
            files={client.pdfs || []}
            accept=".pdf,.dwg,.jpg,.jpeg,.png"
            onUpload={async (file) => {
              await uploadClientFile(client.id, file, "pdfs");
              toast.success("تم الرفع");
            }}
            onPreview={(f) => void previewFile(f.filename, f.originalName)}
            onDownload={(f) => downloadFile(f.path, f.originalName)}
            onDelete={
              canEditUi
                ? async (f) => {
                    if (confirm("حذف هذا الملف؟")) {
                      await deleteClientFile(client.id, f.filename, "pdfs");
                      toast.success("تم الحذف");
                    }
                  }
                : undefined
            }
          />
          <FileSection
            title="أرشيف الإيصالات"
            iconClass="fa-file-invoice-dollar text-green-600"
            files={client.receipts || []}
            accept=".pdf,.jpg,.jpeg,.png"
            onUpload={async (file) => {
              await uploadClientFile(client.id, file, "receipts");
              toast.success("تم الرفع");
            }}
            onPreview={(f) => void previewFile(f.filename, f.originalName)}
            onDownload={(f) => downloadFile(f.path, f.originalName)}
            onDelete={
              canEditUi
                ? async (f) => {
                    if (confirm("حذف هذا الإيصال؟")) {
                      await deleteClientFile(client.id, f.filename, "receipts");
                      toast.success("تم الحذف");
                    }
                  }
                : undefined
            }
          />
        </div>
      </main>

      {editField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] slide-in-right p-4">
          <div className="w-full max-w-sm p-8 bg-white border-t-4 shadow-2xl dark:bg-slate-800 rounded-3xl border-brand-gold">
            <h3 className="mb-6 text-2xl font-black text-center dark:text-white">
              تعديل
            </h3>
            <input
              type={editField === "phone" ? "text" : "number"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="dash-input"
            />
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="flex-1 py-3 font-black text-white transition bg-green-500 rounded-xl hover:bg-green-600"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setEditField(null)}
                className="flex-1 py-3 font-black text-white transition bg-gray-400 rounded-xl hover:bg-gray-500"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {subModal && (
        <SubModalHost
          sub={subModal}
          client={client}
          onClose={() => setSubModal(null)}
          onSaveDoc={saveDoc}
          onSaveExp={saveSubExpense}
          onSaveTip={saveSubTip}
          onSavePay={saveSubPayment}
        />
      )}

      {pdfPreview && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex flex-col p-4">
          <div className="flex items-center justify-between mb-2 text-white">
            <h3 className="font-bold">{pdfPreview.title}</h3>
            <button
              type="button"
              onClick={closePdfPreview}
              className="text-2xl hover:text-red-400"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="flex-1 overflow-hidden rounded-lg bg-slate-900">
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
                <i className="text-blue-400 fas fa-circle-notch fa-spin fa-3x" />
                <p>جاري التحميل...</p>
              </div>
            ) : pdfBlobUrl ? (
              pdfContentType?.startsWith("image/") ? (
                <div className="flex items-start justify-center h-full p-4 overflow-auto bg-slate-800">
                  <img
                    src={pdfBlobUrl}
                    alt={pdfPreview.title}
                    className="h-auto max-w-full rounded-lg"
                  />
                </div>
              ) : (
                <iframe
                  title="preview"
                  src={pdfBlobUrl}
                  className="w-full h-full bg-white border-0"
                />
              )
            ) : null}
          </div>
        </div>
      )}

      <div className="fixed -left-[9999px] top-0 w-[210mm] bg-white text-black p-6 text-right font-sans text-sm leading-relaxed">
        <div
          ref={statementRef}
          dir="rtl"
          style={{ fontFamily: "Cairo,sans-serif" }}
        >
          <h1 className="mb-2 text-2xl font-black text-center">
            كشف حساب عميل
          </h1>
          <p className="mb-4 text-center text-gray-600">
            بوابة الدلتا للمقاولات — {new Date().toLocaleDateString("ar-EG")}
          </p>
          <table className="w-full mb-4 border-collapse">
            <tbody>
              <tr>
                <td className="p-2 font-bold border">اسم العميل</td>
                <td className="p-2 border">{client.name}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold border">القطعة / العنوان</td>
                <td className="p-2 border">{client.plot}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold border">رقم الجوال</td>
                <td className="p-2 border" dir="ltr">
                  {client.phone || "—"}
                </td>
              </tr>
              <tr>
                <td className="p-2 font-bold border">أصل مبلغ التعاقد</td>
                <td className="p-2 border">
                  {(client.totalContract ?? client.paid).toLocaleString()} ج.م
                </td>
              </tr>
            </tbody>
          </table>

          <h2 className="mb-2 text-lg font-black">المصروفات (تخصم من الأصل)</h2>
          <table className="w-full mb-4 text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border">البيان</th>
                <th className="p-1 border">التاريخ</th>
                <th className="p-1 border">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {(client.expenses || []).map((e, i) => (
                <tr key={i}>
                  <td className="p-1 border">{e.reason}</td>
                  <td className="p-1 border">{e.date}</td>
                  <td className="p-1 border">{e.amount} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-4">
            <strong>إجمالي المصروفات:</strong> {expensesTotal.toLocaleString()}{" "}
            ج.م
          </p>

          <h2 className="mb-2 text-lg font-black">الإكراميات (دين)</h2>
          <table className="w-full mb-4 text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border">المصلحة</th>
                <th className="p-1 border">من سدد؟</th>
                <th className="p-1 border">التاريخ</th>
                <th className="p-1 border">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {(client.tips || []).map((t, i) => (
                <tr key={i}>
                  <td className="p-1 border">{t.reason}</td>
                  <td className="p-1 border">{t.payer}</td>
                  <td className="p-1 border">{t.date}</td>
                  <td className="p-1 border">{t.amount} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-4">
            <strong>إجمالي الإكراميات:</strong> {tipsTotal.toLocaleString()} ج.م
          </p>

          <h2 className="mb-2 text-lg font-black">مدفوعات للمكتب</h2>
          <table className="w-full mb-4 text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border">من استلم؟</th>
                <th className="p-1 border">التاريخ</th>
                <th className="p-1 border">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {(client.payments || []).map((p) => (
                <tr key={p.id}>
                  <td className="p-1 border">{p.receiver}</td>
                  <td className="p-1 border">{p.date}</td>
                  <td className="p-1 border">{p.amount} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="mb-2 text-lg font-black">حركة الورق</h2>
          <table className="w-full mb-4 text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border">المستلم</th>
                <th className="p-1 border">الورقة</th>
                <th className="p-1 border">الغرض</th>
                <th className="p-1 border">المكان</th>
                <th className="p-1 border">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(client.docs || []).map((d, i) => (
                <tr key={i}>
                  <td className="p-1 border">{d.person}</td>
                  <td className="p-1 border">{d.name}</td>
                  <td className="p-1 border">{d.purpose}</td>
                  <td className="p-1 border">{d.place}</td>
                  <td className="p-1 border">{d.date}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="p-4 mt-6 space-y-2 border border-gray-200 rounded-lg bg-gray-50">
            <p>
              <strong>إجمالي ما دفعه العميل (بعد المصروفات):</strong>{" "}
              {paidDisplay.toLocaleString()} ج.م
            </p>
            <p>
              <strong>إجمالي الإكراميات (دين على العميل):</strong>{" "}
              {tipsTotal.toLocaleString()} ج.م
            </p>
            <p className="text-lg font-black">
              <strong>صافي وضع الحساب حسب السجلات:</strong> المدفوع الصافي{" "}
              {paidDisplay.toLocaleString()} ج.م — الدين (إكراميات){" "}
              {tipsTotal.toLocaleString()} ج.م
            </p>
          </div>
        </div>
      </div>

      <ToastContainer position="bottom-right" autoClose={3000} rtl />
    </div>
  );
};

function FileSection({
  title,
  iconClass,
  files,
  accept,
  onUpload,
  onPreview,
  onDownload,
  onDelete,
}: {
  title: string;
  iconClass: string;
  files: {
    filename: string;
    originalName: string;
    date: string;
    path: string;
  }[];
  accept: string;
  onUpload: (f: File) => Promise<void>;
  onPreview: (f: (typeof files)[0]) => void;
  onDownload: (f: (typeof files)[0]) => void;
  onDelete?: (f: (typeof files)[0]) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="p-6 bg-white border border-gray-100 shadow-sm dark:bg-slate-800 rounded-3xl dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h3 className="flex items-center gap-2 text-xl font-black text-brand-dark dark:text-white">
          <i className={`fa-solid ${iconClass}`}></i> {title}
        </h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 font-bold text-red-600 transition bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-xl hover:bg-red-100"
        >
          <i className="fas fa-upload"></i> رفع ملف
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              await onUpload(f);
              e.target.value = "";
            }
          }}
        />
      </div>
      <div className="overflow-y-auto max-h-64">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="p-3 font-bold">الملف</th>
              <th className="p-3 font-bold">التاريخ</th>
              <th className="p-3 font-bold text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="p-6 font-bold text-center text-gray-400"
                >
                  لا توجد ملفات
                </td>
              </tr>
            ) : (
              files.map((p) => (
                <tr
                  key={p.filename}
                  className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  <td className="p-3 font-bold">{p.originalName}</td>
                  <td className="p-3 text-xs text-gray-500">{p.date}</td>
                  <td className="p-3 text-center">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onPreview(p)}
                        className="px-3 py-1 text-xs font-bold text-blue-600 rounded-lg bg-blue-50 dark:bg-blue-900/30"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownload(p)}
                        className="px-3 py-1 text-xs font-bold text-green-600 rounded-lg bg-green-50 dark:bg-green-900/30"
                      >
                        <i className="fas fa-download"></i>
                      </button>
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => void onDelete(p)}
                          className="px-3 py-1 text-xs font-bold text-red-600 rounded-lg bg-red-50 dark:bg-red-900/30"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubModalHost({
  sub,
  client,
  onClose,
  onSaveDoc,
  onSaveExp,
  onSaveTip,
  onSavePay,
}: {
  sub: NonNullable<SubModal>;
  client: Client;
  onClose: () => void;
  onSaveDoc: (idx: number | null, doc: Document) => void;
  onSaveExp: (e: Expense) => void;
  onSaveTip: (t: Tip) => void;
  onSavePay: (p: Payment) => void;
}) {
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  const [v3, setV3] = useState("");
  const [v4, setV4] = useState("");
  const [d1, setD1] = useState("");

  useEffect(() => {
    if (sub?.kind === "doc" && sub.editIndex !== null) {
      const d = (client.docs || [])[sub.editIndex];
      if (d) {
        setV1(d.person);
        setV2(d.name);
        setV3(d.purpose);
        setV4(d.place);
        setD1(d.date || "");
      }
    } else {
      setV1("");
      setV2("");
      setV3("");
      setV4("");
      setD1("");
    }
  }, [sub, client.docs]);

  if (!sub) return null;

  const border =
    sub.kind === "exp"
      ? "border-red-500"
      : sub.kind === "tip" || sub.kind === "newMoney"
        ? "border-orange-500"
        : "border-blue-500";

  return (
    <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
      <div
        className={`bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md text-right relative border-t-4 ${border}`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute text-gray-400 top-4 left-4 hover:text-red-500"
        >
          <i className="text-xl fas fa-times"></i>
        </button>

        {sub.kind === "exp" && (
          <>
            <h3 className="mb-6 text-2xl font-black text-center dark:text-white">
              إضافة مصروف
            </h3>
            <input
              className="dash-input"
              placeholder="البيان"
              value={v1}
              onChange={(e) => setV1(e.target.value)}
            />
            <input
              type="number"
              className="dash-input"
              placeholder="المبلغ"
              value={v2}
              onChange={(e) => setV2(e.target.value)}
            />
            <input
              type="date"
              className="dash-input"
              value={d1}
              onChange={(e) => setD1(e.target.value)}
            />
            <button
              type="button"
              className="w-full py-3 font-black text-white bg-red-500 rounded-xl"
              onClick={() => {
                if (!v1 || !v2) return toast.error("أكمل البيانات");
                onSaveExp({
                  reason: v1,
                  amount: parseFloat(v2),
                  date: d1 || new Date().toLocaleDateString("ar-EG"),
                });
              }}
            >
              تسجيل وحفظ
            </button>
          </>
        )}

        {sub.kind === "tip" && (
          <>
            <h3 className="mb-6 text-2xl font-black text-center dark:text-white">
              إضافة إكرامية
            </h3>
            <input
              className="dash-input"
              placeholder="المصلحة"
              value={v1}
              onChange={(e) => setV1(e.target.value)}
            />
            <input
              className="dash-input"
              placeholder="من سدد؟"
              value={v2}
              onChange={(e) => setV2(e.target.value)}
            />
            <input
              type="number"
              className="dash-input"
              placeholder="المبلغ"
              value={v3}
              onChange={(e) => setV3(e.target.value)}
            />
            <input
              type="date"
              className="dash-input"
              value={d1}
              onChange={(e) => setD1(e.target.value)}
            />
            <button
              type="button"
              className="w-full py-3 font-black text-white bg-orange-500 rounded-xl"
              onClick={() => {
                if (!v1 || !v3) return toast.error("أكمل البيانات");
                onSaveTip({
                  reason: v1,
                  payer: v2,
                  amount: parseFloat(v3),
                  date: d1 || new Date().toLocaleDateString("ar-EG"),
                });
              }}
            >
              تسجيل وحفظ
            </button>
          </>
        )}

        {sub.kind === "newMoney" && (
          <>
            <h3 className="mb-6 text-2xl font-black text-center dark:text-white">
              إضافة مبلغ جديد
            </h3>
            <input
              className="dash-input"
              placeholder="من استلم؟"
              value={v2}
              onChange={(e) => setV2(e.target.value)}
            />
            <input
              type="number"
              className="dash-input"
              placeholder="المبلغ"
              value={v3}
              onChange={(e) => setV3(e.target.value)}
            />
            <input
              type="date"
              className="dash-input"
              value={d1}
              onChange={(e) => setD1(e.target.value)}
            />
            <button
              type="button"
              className="w-full py-3 font-black text-white bg-orange-500 rounded-xl"
              onClick={() => {
                if (!v2 || !v3) return toast.error("أكمل البيانات");
                onSavePay({
                  id: Date.now().toString(),
                  receiver: v2,
                  amount: parseFloat(v3),
                  date: d1 || new Date().toLocaleDateString("ar-EG"),
                });
              }}
            >
              تسجيل وحفظ
            </button>
          </>
        )}

        {sub.kind === "doc" && (
          <>
            <h3 className="mb-6 text-2xl font-black text-center dark:text-white">
              {sub.editIndex === null ? "حركة مستند" : "تعديل مستند"}
            </h3>
            <input
              className="dash-input"
              placeholder="المستلم"
              value={v1}
              onChange={(e) => setV1(e.target.value)}
            />
            <input
              className="dash-input"
              placeholder="اسم الورقة"
              value={v2}
              onChange={(e) => setV2(e.target.value)}
            />
            <input
              className="dash-input"
              placeholder="الغرض"
              value={v3}
              onChange={(e) => setV3(e.target.value)}
            />
            <input
              className="dash-input"
              placeholder="المكان"
              value={v4}
              onChange={(e) => setV4(e.target.value)}
            />
            <input
              type="date"
              className="dash-input"
              value={d1}
              onChange={(e) => setD1(e.target.value)}
            />
            <button
              type="button"
              className="w-full py-3 font-black text-white bg-blue-600 rounded-xl"
              onClick={() => {
                if (!v1 || !v2) return toast.error("أكمل الحقول المطلوبة");
                onSaveDoc(sub.editIndex, {
                  person: v1,
                  name: v2,
                  purpose: v3,
                  place: v4,
                  date: d1 || new Date().toLocaleDateString("ar-EG"),
                });
              }}
            >
              {sub.editIndex === null ? "تسجيل وحفظ" : "حفظ التعديلات"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
