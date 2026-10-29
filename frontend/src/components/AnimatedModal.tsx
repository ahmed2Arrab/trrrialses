import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedModalProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  open,
  onClose,
  children,
  className = "",
  overlayClassName = "",
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className={`fixed inset-0 z-[100] flex justify-center items-center p-4 modal-backdrop ${overlayClassName}`}
        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
        animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      >
        <motion.div
          className={className}
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
