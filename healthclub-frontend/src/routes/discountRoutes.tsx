/**
 * Discount Routes Configuration
 * 
 * Defines routing for discount management pages
 */

import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { PermissionGate } from '../components/discounts';
import { DiscountManagement } from '../components/discounts/DiscountManagement';

export const DiscountRoutes: React.FC = () => {
  return (
    <Routes>
      <Route 
        path="/discounts" 
        element={
          <PermissionGate permission="canViewDiscounts">
            <DiscountManagement />
          </PermissionGate>
        } 
      />
      <Route 
        path="/discounts/management" 
        element={
          <PermissionGate permission="canViewDiscounts">
            <DiscountManagement />
          </PermissionGate>
        } 
      />
    </Routes>
  );
};
