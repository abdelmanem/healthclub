import React from 'react';
import { SpaLayout } from '../components/common/SpaLayout';
import { AppointmentSchedulingGrid } from '../components/reservation/AppointmentSchedulingGrid';

export const SpaScheduling: React.FC = () => {
  return (
    <SpaLayout hideTopBars>
      <AppointmentSchedulingGrid />
    </SpaLayout>
  );
};
