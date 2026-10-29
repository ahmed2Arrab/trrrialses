import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "../stores/authStore";
import { toast } from "react-toastify";
import { LOGO_SRC } from "../utils/assets";
import { LoginParticles } from "../components/LoginParticles";

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inputError, setInputError] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setInputError(false);

    if (!username || !password) {
      setInputError(true);
      toast.error("يرجى ملء جميع الحقول");
      return;
    }

    try {
      await login(username, password);
      const user = useAuthStore.getState().user;
      if (user) {
        toast.success(`مرحباً يا ${user.name}!`);
        navigate("/dashboard");
      }
    } catch {
      setInputError(true);
      toast.error("خطأ في تسجيل الدخول");
    }
  };

  return (
    <div className="login-bg flex justify-center items-center min-h-screen p-5">
      <LoginParticles />

      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 bg-white dark:bg-slate-800 p-12 rounded-[30px] shadow-2xl w-full max-w-md text-center border border-gray-100 dark:border-slate-700"
      >
        <motion.img
          src={LOGO_SRC}
          alt="Logo"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
          className="w-24 h-24 mx-auto mb-4 object-contain rounded-lg logo-glow"
        />
        <h2 className="text-[#2c3e50] dark:text-white font-black text-3xl mb-2">
          بوابة الدلتا
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          للمقاولات العامة
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <i className="fas fa-user absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setInputError(false);
              }}
              className={`dash-input pl-4 ${inputError && !username ? "input-error" : ""}`}
              placeholder="اسم المستخدم"
              disabled={isLoading}
            />
          </div>

          <div className="relative">
            <i className="fas fa-lock absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setInputError(false);
              }}
              className={`dash-input pl-4 ${inputError && !password ? "input-error" : ""}`}
              placeholder="كلمة السر"
              disabled={isLoading}
            />
          </div>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="dash-btn dash-btn-shimmer text-lg mt-6 flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> جاري الدخول...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i> دخول النظام
              </>
            )}
          </motion.button>
        </form>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg"
          >
            <p className="text-red-600 dark:text-red-400 font-bold text-sm">
              {error}
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
