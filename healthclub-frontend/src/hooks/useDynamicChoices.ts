import { useState, useEffect } from 'react';
import { configService } from '../services/config';

export const useDynamicChoices = (choiceType: 'membership_tiers' | 'gender_options' | 'business_rules' | 'commission_types' | 'training_types' | 'product_types' | 'notification_templates') => {
  const [choices, setChoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChoices();
  }, [choiceType]);

  const loadChoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let data: any[] = [];
      switch (choiceType) {
        case 'membership_tiers':
          data = await configService.getMembershipTiers();
          break;
        case 'gender_options':
          data = await configService.getGenderOptions();
          break;
        case 'business_rules':
          data = await configService.getBusinessRules();
          break;
        case 'commission_types':
          data = await configService.getCommissionTypes();
          break;
        case 'training_types':
          data = await configService.getTrainingTypes();
          break;
        case 'product_types':
          data = await configService.getProductTypes();
          break;
        case 'notification_templates':
          data = await configService.getNotificationTemplates();
          break;
      }
      
      setChoices(data.filter(item => item.is_active));
    } catch (err) {
      setError('Failed to load choices');
      console.error('Error loading choices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { choices, isLoading, error, refetch: loadChoices };
};
