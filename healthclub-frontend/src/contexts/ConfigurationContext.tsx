import React, { createContext, useContext, useEffect, useState } from 'react';
import { configService } from '../services/config';

interface ConfigurationContextType {
  systemConfigs: { [key: string]: any };
  membershipTiers: any[];
  genderOptions: any[];
  businessRules: { [key: string]: any };
  commissionTypes: any[];
  trainingTypes: any[];
  productTypes: any[];
  notificationTemplates: any[];
  cancellationReasons: any[];
  isLoading: boolean;
  getConfigValue: (key: string, defaultValue?: any) => any;
  refreshConfigurations: () => Promise<void>;
}

const ConfigurationContext = createContext<ConfigurationContextType | undefined>(undefined);

export const ConfigurationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemConfigs, setSystemConfigs] = useState<{ [key: string]: any }>({});
  const [membershipTiers, setMembershipTiers] = useState<any[]>([]);
  const [genderOptions, setGenderOptions] = useState<any[]>([]);
  const [businessRules, setBusinessRules] = useState<{ [key: string]: any }>({});
  const [commissionTypes, setCommissionTypes] = useState<any[]>([]);
  const [trainingTypes, setTrainingTypes] = useState<any[]>([]);
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [notificationTemplates, setNotificationTemplates] = useState<any[]>([]);
  const [cancellationReasons, setCancellationReasons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only load when authenticated
    const token = localStorage.getItem('access_token');
    if (token) {
      loadAllConfigurations();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadAllConfigurations = async () => {
    try {
      const [configs, tiers, genders, rules, commissions, trainings, products, templates, reasons] = await Promise.all([
        configService.getSystemConfigs().catch(() => []),
        configService.getMembershipTiers().catch(() => []),
        configService.getGenderOptions().catch(() => []),
        configService.getBusinessRules().catch(() => []),
        configService.getCommissionTypes().catch(() => []),
        configService.getTrainingTypes().catch(() => []),
        configService.getProductTypes().catch(() => []),
        configService.getNotificationTemplates().catch(() => []),
        configService.getCancellationReasons().catch(() => [])
      ]);

      // Convert configs to key-value object
      const configObj: { [key: string]: any } = {};
      if (Array.isArray(configs)) {
        configs.forEach(config => {
          if (config.is_active) {
            configObj[config.key] = config.value;
          }
        });
      }

      // Convert business rules to key-value object
      const rulesObj: { [key: string]: any } = {};
      if (Array.isArray(rules)) {
        rules.forEach(rule => {
          if (rule.is_active) {
            rulesObj[rule.key] = rule.value;
          }
        });
      }

      // Ensure currency symbol exists; if missing but a currency code exists, derive and persist it
      try {
        const detectedCurrencyCode =
          configObj['system_currency_code'] ||
          configObj['system_currency'] ||
          configObj['default_currency'] ||
          configObj['currency_code'] ||
          configObj['currency'];
        const existingCurrencySymbol =
          configObj['system_currency_symbol'] ||
          configObj['currency_symbol'] ||
          configObj['currency.sign'];

        if (!existingCurrencySymbol && detectedCurrencyCode) {
          const localeGuess = (navigator?.language) || 'en-US';
          let derivedSymbol = '';
          try {
            const parts = new Intl.NumberFormat(localeGuess, { style: 'currency', currency: String(detectedCurrencyCode) }).formatToParts(0);
            derivedSymbol = (parts.find(p => p.type === 'currency')?.value) || '';
          } catch {}

          if (derivedSymbol) {
            try {
              const created = await configService.createSystemConfig({
                key: 'currency_symbol',
                value: derivedSymbol,
                description: 'Currency symbol auto-derived from currency code',
                data_type: 'string',
                is_active: true
              } as any);
              // Reflect immediately in local config map
              configObj['currency_symbol'] = created?.value || derivedSymbol;
            } catch (e) {
              // If backend creation fails, still set locally for session
              configObj['currency_symbol'] = derivedSymbol;
            }
          }
        }
      } catch {}

      setSystemConfigs(configObj);
      setMembershipTiers(Array.isArray(tiers) ? tiers.filter(tier => tier.is_active) : []);
      setGenderOptions(Array.isArray(genders) ? genders.filter(gender => gender.is_active) : []);
      setBusinessRules(rulesObj);
      setCommissionTypes(Array.isArray(commissions) ? commissions.filter(commission => commission.is_active) : []);
      setTrainingTypes(Array.isArray(trainings) ? trainings.filter(training => training.is_active) : []);
      setProductTypes(Array.isArray(products) ? products.filter(product => product.is_active) : []);
      setNotificationTemplates(Array.isArray(templates) ? templates.filter(template => template.is_active) : []);
      setCancellationReasons(Array.isArray(reasons) ? reasons.filter(reason => reason.is_active) : []);
      setIsLoading(false);
    } catch (error: any) {
      // Ignore unauthorized during unauthenticated states
      if (error?.response?.status !== 401) {
        console.error('Failed to load configurations:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getConfigValue = (key: string, defaultValue?: any): any => {
    return systemConfigs[key] || defaultValue;
  };

  const refreshConfigurations = async () => {
    await loadAllConfigurations();
  };

  return (
    <ConfigurationContext.Provider value={{
      systemConfigs,
      membershipTiers,
      genderOptions,
      businessRules,
      commissionTypes,
      trainingTypes,
      productTypes,
      notificationTemplates,
      cancellationReasons,
      isLoading,
      getConfigValue,
      refreshConfigurations
    }}>
      {children}
    </ConfigurationContext.Provider>
  );
};

export const useConfiguration = (): ConfigurationContextType => {
  const context = useContext(ConfigurationContext);
  if (context === undefined) {
    throw new Error('useConfiguration must be used within a ConfigurationProvider');
  }
  return context;
};
