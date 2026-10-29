import type { UserRole } from "../types";

export function isAdminLike(role?: UserRole | string): boolean {
  return role === "admin" || role === "accountant";
}

export function canViewFinancials(role?: UserRole | string): boolean {
  return (
    role === "admin" ||
    role === "accountant" ||
    role === "admin_readonly"
  );
}

/** تعديل وحذف السجلات والملفات المرفقة */
export function canEditRecords(role?: UserRole | string): boolean {
  return isAdminLike(role);
}

export function canDeleteClients(role?: UserRole | string): boolean {
  return isAdminLike(role);
}

export function canAccessBackup(role?: UserRole | string): boolean {
  return isAdminLike(role);
}

export function canViewTrash(role?: UserRole | string): boolean {
  return role === "admin" || role === "accountant" || role === "admin_readonly";
}

export function canPermanentDeleteFromTrash(role?: UserRole | string): boolean {
  return isAdminLike(role);
}

export function isStaff(role?: UserRole | string): boolean {
  return role === "staff";
}
