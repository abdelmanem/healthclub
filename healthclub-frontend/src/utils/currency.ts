/**
 * Currency formatting utility that uses system configuration
 */

import { useConfiguration } from '../contexts/ConfigurationContext';

/**
 * Format currency amount using system configuration
 * This is a hook that must be used within a React component
 */
export const useCurrencyFormatter = () => {
  const { getConfigValue } = useConfiguration();
  const locale = getConfigValue('locale', 'en-US');
  
  // Try multiple config keys to locate system currency settings
  const currencyCode =
    getConfigValue('system_currency_code',
      getConfigValue('system_currency',
        getConfigValue('default_currency',
          getConfigValue('currency_code',
            getConfigValue('currency', undefined)))));
  const currencySymbol =
    getConfigValue('system_currency_symbol',
      getConfigValue('currency_symbol',
        getConfigValue('currency.sign', '')));

  const formatCurrency = (amount: string | number): string => {
    const numericAmount = parseFloat(String(amount));
    if (Number.isNaN(numericAmount)) {
      // If we have a currency code, try to use it; otherwise use symbol
      if (currencyCode) {
        try {
          return new Intl.NumberFormat(locale, { 
            style: 'currency', 
            currency: String(currencyCode), 
            maximumFractionDigits: 2 
          }).format(0);
        } catch {
          // If currency code is invalid (like "LE"), use it as symbol
          return `${currencyCode || currencySymbol || ''}0.00`;
        }
      }
      return `${currencySymbol || ''}0.00`;
    }
    
    try {
      if (currencyCode) {
        // Try to use currency code with Intl.NumberFormat
        return new Intl.NumberFormat(locale, { 
          style: 'currency', 
          currency: String(currencyCode), 
          maximumFractionDigits: 2 
        }).format(numericAmount);
      }
    } catch {
      // If currency code is invalid (like "LE"), treat it as a symbol
      const symbol = currencyCode || currencySymbol || '';
      return `${symbol}${numericAmount.toFixed(2)}`;
    }
    
    // Fallback to symbol
    return `${currencySymbol || ''}${numericAmount.toFixed(2)}`;
  };

  return { formatCurrency, currencyCode, currencySymbol, locale };
};

/**
 * Standalone currency formatter function that accepts config values
 * Use this when you can't use the hook (e.g., in utility functions)
 */
export const formatCurrencyWithConfig = (
  amount: string | number,
  currencyCode?: string,
  currencySymbol?: string,
  locale: string = 'en-US'
): string => {
  const numericAmount = parseFloat(String(amount));
  if (Number.isNaN(numericAmount)) {
    // If we have a currency code, try to use it; otherwise use symbol
    if (currencyCode) {
      try {
        return new Intl.NumberFormat(locale, { 
          style: 'currency', 
          currency: String(currencyCode), 
          maximumFractionDigits: 2 
        }).format(0);
      } catch {
        // If currency code is invalid (like "LE"), use it as symbol
        return `${currencyCode || currencySymbol || ''}0.00`;
      }
    }
    return `${currencySymbol || ''}0.00`;
  }
  
  try {
    if (currencyCode) {
      // Try to use currency code with Intl.NumberFormat
      return new Intl.NumberFormat(locale, { 
        style: 'currency', 
        currency: String(currencyCode), 
        maximumFractionDigits: 2 
      }).format(numericAmount);
    }
  } catch {
    // If currency code is invalid (like "LE"), treat it as a symbol
    const symbol = currencyCode || currencySymbol || '';
    return `${symbol}${numericAmount.toFixed(2)}`;
  }
  
  // Fallback to symbol
  return `${currencySymbol || ''}${numericAmount.toFixed(2)}`;
};

