// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api',
  TIMEOUT: 10000,
};

// Application Configuration
export const APP_CONFIG = {
  NAME: 'Health Club Management System',
  VERSION: '1.0.0',
  DESCRIPTION: 'Comprehensive health club management solution',
};

// User Roles
export const USER_ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  FRONT_OFFICE: 'Front Office',
  EMPLOYEE: 'Employee',
} as const;

// Permission Types
export const PERMISSIONS = {
  VIEW: 'view',
  ADD: 'add',
  CHANGE: 'change',
  DELETE: 'delete',
} as const;

// Model Names
export const MODELS = {
  GUESTS: 'guests',
  RESERVATIONS: 'reservations',
  SERVICES: 'services',
  EMPLOYEES: 'employees',
  INVOICES: 'invoices',
  CONFIG: 'config',
  ANALYTICS: 'analytics',
} as const;

// Reservation Status
export const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;

// Service Status
export const SERVICE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DISCONTINUED: 'discontinued',
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  GIFT_CARD: 'gift_card',
  PROMO_CODE: 'promo_code',
} as const;

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  API: 'yyyy-MM-dd',
  DATETIME: 'MMM dd, yyyy HH:mm',
  TIME: 'HH:mm',
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
} as const;
