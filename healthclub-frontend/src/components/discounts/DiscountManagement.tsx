/**
 * Discount Management Dashboard
 * 
 * Main interface for managing the discount system including:
 * - Discount Types Management
 * - Applied Discounts View
 * - Approval Workflow
 * - Analytics & Reports
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Analytics as AnalyticsIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSnackbar } from '../common/useSnackbar';
import { discountService, DiscountType, ReservationDiscount } from '../../services/discounts';

// Import sub-components (to be created)
import { DiscountTypeManager } from './DiscountTypeManager';
import { AppliedDiscountsManager } from './AppliedDiscountsManager';
import { ApprovalWorkflow } from './ApprovalWorkflow';
import { DiscountAnalytics } from './DiscountAnalytics';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`discount-tabpanel-${index}`}
      aria-labelledby={`discount-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const DiscountManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalDiscountTypes: 0,
    activeDiscountTypes: 0,
    pendingApprovals: 0,
    totalAppliedDiscounts: 0,
    totalDiscountAmount: 0,
  });
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Load dashboard statistics
  const loadStats = async () => {
    setLoading(true);
    try {
      const [discountTypes, appliedDiscounts, pendingDiscounts] = await Promise.all([
        discountService.listDiscountTypes(),
        discountService.listReservationDiscounts({ status: 'applied' }),
        discountService.listReservationDiscounts({ status: 'pending' }),
      ]);

      const totalDiscountAmount = appliedDiscounts.reduce(
        (sum, discount) => sum + Number(discount.discount_amount),
        0
      );

      setStats({
        totalDiscountTypes: discountTypes.length,
        activeDiscountTypes: discountTypes.filter(dt => dt.is_active).length,
        pendingApprovals: pendingDiscounts.length,
        totalAppliedDiscounts: appliedDiscounts.length,
        totalDiscountAmount,
      });
    } catch (error) {
      console.error('Failed to load discount statistics:', error);
      showSnackbar('Failed to load statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleRefresh = () => {
    loadStats();
    showSnackbar('Statistics refreshed', 'success');
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 3,
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 1
      }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Discount Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage discount types, approve applications, and view analytics
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh Statistics">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SettingsIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : stats.totalDiscountTypes}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Total Discount Types
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : stats.activeDiscountTypes}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Active Types
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircleIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : stats.pendingApprovals}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Pending Approvals
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <DashboardIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : stats.totalAppliedDiscounts}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Applied Discounts
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AnalyticsIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : `$${stats.totalDiscountAmount.toFixed(2)}`}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Total Discount Amount
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pending Approvals Alert */}
      {stats.pendingApprovals > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setActiveTab(2)}
            >
              Review Now
            </Button>
          }
        >
          You have {stats.pendingApprovals} discount(s) pending approval
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            aria-label="discount management tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<SettingsIcon />} 
              label="Discount Types" 
              id="discount-tab-0"
              aria-controls="discount-tabpanel-0"
            />
            <Tab 
              icon={<DashboardIcon />} 
              label="Applied Discounts" 
              id="discount-tab-1"
              aria-controls="discount-tabpanel-1"
            />
            <Tab 
              icon={<CheckCircleIcon />} 
              label="Approvals" 
              id="discount-tab-2"
              aria-controls="discount-tabpanel-2"
            />
            <Tab 
              icon={<AnalyticsIcon />} 
              label="Analytics" 
              id="discount-tab-3"
              aria-controls="discount-tabpanel-3"
            />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <DiscountTypeManager onRefresh={loadStats} />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <AppliedDiscountsManager onRefresh={loadStats} />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <ApprovalWorkflow onRefresh={loadStats} />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <DiscountAnalytics />
        </TabPanel>
      </Paper>

      {SnackbarComponent}
    </Box>
  );
};
