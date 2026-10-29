import React, {
  useState,
  useMemo,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import debounce from "lodash.debounce";
import { useAuthStore } from "../stores/authStore";
import {
  canDelete,
  canAccessBackup,
  canViewTrash,
  canPermanentDeleteFromTrash,
} from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { toast } from "react-toastify";
import { getDashboardOwedPrincipal } from "../utils/clientModel";
import { api } from "../utils/api";
import { LOGO_SRC } from "../utils/assets";
import { CountUp } from "../components/CountUp";
import { RippleButton } from "../components/RippleButton";
import { AnimatedModal } from "../components/AnimatedModal";

const PAGE_SIZE = 20;

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td className="p-4">
            <div className="w-3/4 h-4 rounded shimmer" />
          </td>
          <td className="p-4">
            <div className="w-2/3 h-4 rounded shimmer" />
          </td>
          <td className="p-4">
            <div className="w-1/2 h-4 rounded shimmer" />
          </td>
          <td className="p-4">
            <div className="w-1/3 h-4 rounded shimmer" />
          </td>
          <td className="p-4">
            <div className="w-24 h-8 rounded shimmer" />
          </td>
        </tr>
      ))}
    </>
  );
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    clients,
    trash,
    deleteClient,
    loadData,
    saveData,
    restoreClient,
    permanentDeleteClient,
    isLoading,
    addClient,
  } = useDataStore();

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const searchBusy = searchTerm !== deferredSearch;

  const [darkMode, setDarkMode] = useState(false);
  const [page, setPage] = useState(1);
  const [showTrash, setShowTrash] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", plot: "", total: "" });
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const greetName = useMemo(() => {
    if (!user?.name) return user?.username ?? "";
    const i = user.name.indexOf("(");
    return (i === -1 ? user.name : user.name.slice(0, i)).trim();
  }, [user]);

  const debouncedSetSearch = useMemo(
    () =>
      debounce((term: string) => {
        setSearchTerm(term);
        setPage(1);
      }, 350),
    [],
  );

  useEffect(() => {
    return () => debouncedSetSearch.cancel();
  }, [debouncedSetSearch]);

  const handleLogout = () => {
    logout();
    navigate("/login");
    toast.info("تم تسجيل الخروج");
  };

  const handleDeleteClient = async (clientId: string) => {
    if (confirm("هل أنت متأكد من حذف هذا العميل؟")) {
      await deleteClient(clientId);
      toast.success("تم نقل العميل إلى سلة المهملات");
      await saveData();
    }
  };

  const filteredClients = useMemo(() => {
    const q = deferredSearch.trim();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.includes(q) || c.plot.includes(q) || (c.phone || "").includes(q),
    );
  }, [clients, deferredSearch]);

  const pageCount = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedClients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredClients.slice(start, start + PAGE_SIZE);
  }, [filteredClients, currentPage]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const downloadBackup = () => {
    const u = new URL(
      "api/backup",
      `${window.location.origin}${import.meta.env.BASE_URL}`,
    );
    window.location.href = u.href;
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !confirm(
        "تحذير: استعادة النسخة الاحتياطية ستحل محل البيانات الحالية. هل أنت متأكد؟",
      )
    ) {
      e.target.value = "";
      return;
    }
    try {
      const fd = new FormData();
      fd.append("backup", file);
      const { data } = await api.post("/api/restore", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.success) {
        toast.success("تمت الاستعادة بنجاح");
        await loadData();
      } else {
        toast.error(data.error || "فشلت الاستعادة");
      }
    } catch {
      toast.error("فشلت الاستعادة");
    } finally {
      e.target.value = "";
    }
  };

  const submitNewClient = async () => {
    const name = newClient.name.trim();
    const plot = newClient.plot.trim();
    const total = parseFloat(newClient.total);
    if (!name || !plot || !total) {
      toast.error("يرجى إدخال جميع البيانات");
      return;
    }
    await addClient({
      name,
      plot,
      totalContract: total,
      paid: total,
      phone: "",
      expenses: [],
      tips: [],
      payments: [],
      docs: [],
      pdfs: [],
      receipts: [],
    });
    toast.success("تم إنشاء العميل");
    setShowNewClient(false);
    setNewClient({ name: "", plot: "", total: "" });
  };

  const onSearchChange = useCallback(
    (v: string) => {
      setSearchInput(v);
      debouncedSetSearch(v);
    },
    [debouncedSetSearch],
  );

  const totalRemaining = useMemo(
    () => clients.reduce((sum, c) => sum + getDashboardOwedPrincipal(c), 0),
    [clients],
  );

  return (
    <div className={`min-h-screen ${darkMode ? "dark" : ""}`}>
      <div className="p-8 dash-bg">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-5 pb-6 mb-10 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <motion.img
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                src={LOGO_SRC}
                alt="Logo"
                className="object-contain w-16 h-16 rounded-lg logo-glow"
              />
              <div>
                <h1 className="text-4xl font-black text-dash-primary dark:text-white">
                  بوابة الدلتا للمقاولات
                </h1>
                <p className="mt-1 text-xl font-bold text-dash-accent">
                  أهلاً بك يا{" "}
                  <span className="px-2 py-1 text-white rounded bg-dash-primary">
                    {greetName}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <RippleButton
                type="button"
                onClick={toggleDarkMode}
                className="flex items-center justify-center text-2xl bg-gray-100 dark:bg-slate-700 w-14 h-14 rounded-2xl hover:bg-gray-200 dark:hover:bg-slate-600"
              >
                <i className={`fas ${darkMode ? "fa-sun" : "fa-moon"}`}></i>
              </RippleButton>

              {canAccessBackup(user?.role) && (
                <>
                  <RippleButton
                    type="button"
                    onClick={downloadBackup}
                    className="flex items-center gap-3 px-6 py-4 font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-2xl hover:bg-blue-100"
                  >
                    <i className="fas fa-file-archive"></i> نسخة احتياطية
                  </RippleButton>

                  <RippleButton
                    type="button"
                    onClick={() => restoreInputRef.current?.click()}
                    className="flex items-center gap-3 px-6 py-4 font-bold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 rounded-2xl hover:bg-green-100"
                  >
                    <i className="fas fa-file-import"></i> استعادة
                  </RippleButton>
                  <input
                    ref={restoreInputRef}
                    type="file"
                    className="hidden"
                    accept=".zip"
                    onChange={handleRestoreFile}
                  />
                </>
              )}

              {canViewTrash(user?.role) && (
                <RippleButton
                  type="button"
                  onClick={() => setShowTrash(true)}
                  className="flex items-center gap-3 px-6 py-4 font-bold text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-2xl hover:bg-red-100"
                >
                  <i className="fas fa-trash-can"></i> المهملات
                </RippleButton>
              )}

              <RippleButton
                type="button"
                onClick={() => setShowNewClient(true)}
                className="flex items-center gap-3 px-8 py-4 font-bold text-white bg-dash-accent rounded-2xl hover:bg-yellow-600"
              >
                + إنشاء عميل
              </RippleButton>

              <RippleButton
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-6 py-4 font-bold text-white bg-gray-400 dark:bg-gray-600 rounded-2xl hover:bg-gray-500"
              >
                <i className="fas fa-sign-out-alt"></i> خروج
              </RippleButton>
            </div>
          </div>

          <div className="relative max-w-2xl mx-auto mb-8 search-input-wrap">
            <i className="absolute z-10 text-gray-400 -translate-y-1/2 fas fa-search right-4 top-1/2"></i>
            {searchBusy && (
              <i className="absolute z-10 -translate-y-1/2 fas fa-spinner fa-spin left-4 top-1/2 text-dash-accent"></i>
            )}
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pr-12 mb-0 dash-input"
              placeholder="ابحث عن عميل، قطعة، أو رقم هاتف..."
            />
          </div>

          <div className="p-6 overflow-x-auto border border-gray-100 bg-gray-50 dark:bg-slate-900 rounded-3xl dark:border-slate-700 fade-in">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="p-4 font-bold text-gray-700 dark:text-gray-300">
                    اسم العميل
                  </th>
                  <th className="p-4 font-bold text-gray-700 dark:text-gray-300">
                    قطعة الأرض
                  </th>
                  <th className="p-4 font-bold text-gray-700 dark:text-gray-300">
                    المتبقي
                  </th>
                  <th className="p-4 font-bold text-gray-700 dark:text-gray-300">
                    الهاتف
                  </th>
                  <th className="p-4 font-bold text-gray-700 dark:text-gray-300">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeletonRows />
                ) : (
                  pagedClients.map((client, index) => {
                    const owed = getDashboardOwedPrincipal(client);
                    return (
                      <motion.tr
                        key={client.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.35 }}
                        className="border-b border-gray-100 dark:border-slate-700 table-row-hover"
                      >
                        <td className="p-4 font-bold dark:text-white">
                          {client.name}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">
                          {client.plot}
                        </td>
                        <td className="p-4 font-bold text-red-600 dark:text-red-400">
                          {owed.toLocaleString()} ج.م
                        </td>
                        <td
                          className="p-4 text-gray-600 dark:text-gray-300"
                          dir="ltr"
                        >
                          {client.phone || "---"}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/client/${client.id}`)}
                              className="px-4 py-2 text-xs font-bold text-blue-600 transition rounded-lg bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100"
                            >
                              <i className="fas fa-eye"></i> عرض
                            </button>
                            {canDelete(user?.role) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClient(client.id)}
                                className="px-3 py-2 text-xs font-bold text-red-600 transition rounded-lg bg-red-50 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {!isLoading && filteredClients.length === 0 && (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                <i className="mb-2 text-3xl fas fa-inbox"></i>
                <p className="font-bold">لا توجد نتائج مطابقة</p>
              </div>
            )}

            {!isLoading && filteredClients.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 font-bold bg-white border border-gray-200 rounded-xl dark:bg-slate-800 dark:border-slate-600 disabled:opacity-40"
                >
                  السابق
                </button>
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                  صفحة {currentPage} من {pageCount} — إجمالي{" "}
                  {filteredClients.length} عميل
                </span>
                <button
                  type="button"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="px-4 py-2 font-bold bg-white border border-gray-200 rounded-xl dark:bg-slate-800 dark:border-slate-600 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 mt-8 md:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 bg-white border-l-4 border-blue-500 shadow-sm dark:bg-slate-800 rounded-3xl stat-card"
            >
              <p className="font-bold text-gray-500 dark:text-gray-400">
                إجمالي العملاء
              </p>
              <p className="mt-2 text-4xl font-black text-blue-600 dark:text-blue-400">
                <CountUp end={clients.length} />
              </p>
              <p className="mt-4 text-sm font-bold text-gray-500 dark:text-gray-400">
                إجمالي المتبقي
              </p>
              <p className="mt-1 text-2xl font-black text-red-600 dark:text-red-400">
                <CountUp end={totalRemaining} suffix=" ج.م" />
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 bg-white border-l-4 border-red-500 shadow-sm dark:bg-slate-800 rounded-3xl stat-card"
            >
              <p className="font-bold text-gray-500 dark:text-gray-400">
                في سلة المهملات
              </p>
              <p className="mt-2 text-4xl font-black text-red-600 dark:text-red-400">
                <CountUp end={trash.length} />
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 bg-white border-l-4 border-green-500 shadow-sm dark:bg-slate-800 rounded-3xl stat-card"
            >
              <p className="font-bold text-gray-500 dark:text-gray-400">
                صلاحيتك
              </p>
              <p className="mt-2 text-2xl font-black text-green-600 dark:text-green-400">
                {user?.role}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatedModal
        open={showTrash}
        onClose={() => setShowTrash(false)}
        className="bg-white dark:bg-slate-800 p-8 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-slate-700"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black dark:text-white">سلة المهملات</h3>
          <button
            type="button"
            onClick={() => setShowTrash(false)}
            className="text-xl text-gray-400 hover:text-red-500"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        {trash.length === 0 ? (
          <p className="py-8 text-center text-gray-500">السلة فارغة</p>
        ) : (
          trash.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 p-4 mb-3 border border-gray-100 bg-gray-50 dark:bg-slate-700 rounded-xl dark:border-slate-600"
            >
              <span className="font-bold dark:text-white">
                {c.name} — {c.plot}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await restoreClient(c.id);
                    toast.success("تمت الاستعادة");
                    await saveData();
                  }}
                  className="px-4 py-2 font-bold text-green-600 rounded-lg bg-green-50"
                >
                  استعادة
                </button>
                {canPermanentDeleteFromTrash(user?.role) && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        confirm("حذف نهائي لهذا العميل وجميع ملفاته من النظام؟")
                      ) {
                        await permanentDeleteClient(c.id);
                        toast.success("تم الحذف النهائي");
                        await saveData();
                      }
                    }}
                    className="px-4 py-2 font-bold text-red-600 rounded-lg bg-red-50"
                  >
                    حذف نهائي
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </AnimatedModal>

      <AnimatedModal
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        className="w-full max-w-md p-8 bg-white border border-gray-100 shadow-2xl dark:bg-slate-800 rounded-3xl dark:border-slate-700"
      >
        <h3 className="mb-6 text-2xl font-black text-center dark:text-white">
          إضافة عميل جديد
        </h3>
        <input
          type="text"
          className="mb-2 dash-input"
          placeholder="اسم العميل"
          value={newClient.name}
          onChange={(e) =>
            setNewClient((s) => ({ ...s, name: e.target.value }))
          }
        />
        <input
          type="text"
          className="mb-2 dash-input"
          placeholder="اسم القطعة"
          value={newClient.plot}
          onChange={(e) =>
            setNewClient((s) => ({ ...s, plot: e.target.value }))
          }
        />
        <input
          type="number"
          className="mb-2 dash-input"
          placeholder="أصل مبلغ التعاقد (ج.م)"
          value={newClient.total}
          onChange={(e) =>
            setNewClient((s) => ({ ...s, total: e.target.value }))
          }
        />
        <button
          type="button"
          onClick={() => void submitNewClient()}
          className="mb-3 dash-btn"
        >
          حفظ
        </button>
        <button
          type="button"
          onClick={() => setShowNewClient(false)}
          className="w-full font-bold text-red-500"
        >
          إلغاء
        </button>
      </AnimatedModal>
    </div>
  );
};
