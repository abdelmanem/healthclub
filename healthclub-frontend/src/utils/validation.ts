export const validateAmount = (
  value: string,
  min: number = 0.01,
  max?: number
): { valid: boolean; error?: string } => {
  const num = parseFloat(value);
  
  if (!value || value.trim() === '') {
    return { valid: false, error: 'Amount is required' };
  }
  
  if (isNaN(num)) {
    return { valid: false, error: 'Please enter a valid number' };
  }
  
  if (num < min) {
    return { valid: false, error: `Amount must be at least $${min.toFixed(2)}` };
  }
  
  if (max && num > max) {
    return { valid: false, error: `Amount cannot exceed $${max.toFixed(2)}` };
  }
  
  return { valid: true };
};

export const validateRequired = (
  value: string,
  fieldName: string = 'Field'
): { valid: boolean; error?: string } => {
  if (!value || value.trim() === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
};

export const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `$${num.toFixed(2)}`;
};
