/**
 * Discount Analytics
 * 
 * Analytics dashboard with:
 * - Discount usage statistics
 * - Employee performance metrics
 * - Revenue impact analysis
 * - Guest discount history
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSnackbar } from '../common/useSnackbar';
import { discountService, ReservationDiscount, DiscountType } from '../../services/discounts';
import { useCurrencyFormatter } from '../../utils/currency';

export const DiscountAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState({
    totalDiscounts: 0,
    totalDiscountAmount: 0,
    averageDiscountAmount: 0,
    mostUsedDiscountType: '',
    topEmployee: '',
    recentActivity: [] as ReservationDiscount[],
  });
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('30'); // days
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { formatCurrency, locale } = useCurrencyFormatter();

  // Load analytics data
  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [appliedDiscounts, discountTypesData] = await Promise.all([
        discountService.listReservationDiscounts({ 
          status: 'applied',
          // Add date filtering based on dateRange
        }),
        discountService.listDiscountTypes(),
      ]);

      setDiscountTypes(discountTypesData);

      // Calculate analytics
      const totalDiscounts = appliedDiscounts.length;
      const totalDiscountAmount = appliedDiscounts.reduce(
        (sum, discount) => sum + Number(discount.discount_amount),
        0
      );
      const averageDiscountAmount = totalDiscounts > 0 ? totalDiscountAmount / totalDiscounts : 0;

      // Find most used discount type
      const discountTypeCounts = appliedDiscounts.reduce((acc, discount) => {
        const typeName = discount.discount_type.name;
        acc[typeName] = (acc[typeName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostUsedDiscountType = Object.entries(discountTypeCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

      // Find top employee
      const employeeCounts = appliedDiscounts.reduce((acc, discount) => {
        const employeeName = discount.applied_by_name || 'Unknown';
        acc[employeeName] = (acc[employeeName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topEmployee = Object.entries(employeeCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

      // Get recent activity (last 10)
      const recentActivity = appliedDiscounts
        .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
        .slice(0, 10);

      setAnalytics({
        totalDiscounts,
        totalDiscountAmount,
        averageDiscountAmount,
        mostUsedDiscountType,
        topEmployee,
        recentActivity,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
      showSnackbar('Failed to load analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const handleExport = () => {
    // This would implement CSV/PDF export functionality
    showSnackbar('Export functionality coming soon', 'info');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale || 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDiscountTypeStats = () => {
    const stats = discountTypes.map(type => {
      const usage = analytics.recentActivity.filter(d => d.discount_type.id === type.id).length;
      const amount = analytics.recentActivity
        .filter(d => d.discount_type.id === type.id)
        .reduce((sum, d) => sum + Number(d.discount_amount), 0);
      
      return {
        name: type.name,
        code: type.code,
        usage,
        amount,
        method: type.discount_method,
      };
    }).sort((a, b) => b.usage - a.usage);

    return stats;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Discount Analytics
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
              <MenuItem value="365">Last year</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadAnalytics}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AssessmentIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : analytics.totalDiscounts}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Total Discounts Applied
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <MoneyIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : formatCurrency(analytics.totalDiscountAmount)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Total Discount Amount
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : formatCurrency(analytics.averageDiscountAmount)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Average Discount
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PeopleIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {loading ? <CircularProgress size={20} /> : analytics.topEmployee}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Top Employee
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Discount Type Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Discount Type Usage
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Discount Type</TableCell>
                      <TableCell align="right">Usage</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getDiscountTypeStats().map((stat) => (
                      <TableRow key={stat.code}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {stat.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {stat.code} • {stat.method.replace('_', ' ')}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Chip label={stat.usage} size="small" color="primary" />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(stat.amount)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress />
                </Box>
              ) : analytics.recentActivity.length === 0 ? (
                <Alert severity="info">No recent activity</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Guest</TableCell>
                        <TableCell>Discount</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.recentActivity.map((discount) => (
                        <TableRow key={discount.id}>
                          <TableCell>
                            <Typography variant="body2">
                              {discount.reservation_guest_name || 'Unknown'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {discount.discount_type.name}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="success.main">
                              -{formatCurrency(Number(discount.discount_amount))}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {formatDate(discount.applied_at)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Summary Stats */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Summary Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="primary">
                      {analytics.totalDiscounts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Discounts
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="success.main">
                      {formatCurrency(analytics.totalDiscountAmount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Savings
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="info.main">
                      {analytics.mostUsedDiscountType}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Most Popular
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="warning.main">
                      {analytics.topEmployee}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Top Performer
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {SnackbarComponent}
    </Box>
  );
};
