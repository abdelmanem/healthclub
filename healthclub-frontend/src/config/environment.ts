// Environment configuration
export const config = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api',
  APP_NAME: 'Health Club Management',
  VERSION: '1.0.0',
  ENVIRONMENT: process.env.NODE_ENV || 'development',
};

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login/',
    REFRESH: '/auth/refresh/',
    USER: '/auth/user/',
  },
  GUESTS: '/guests/',
  RESERVATIONS: '/reservations/',
  SERVICES: '/services/',
  EMPLOYEES: '/employees/',
  CONFIG: {
    SYSTEM_CONFIG: '/config/system-configurations/',
    MEMBERSHIP_TIERS: '/config/membership-tiers/',
    GENDER_OPTIONS: '/config/gender-options/',
    BUSINESS_RULES: '/config/business-rules/',
  },
};
