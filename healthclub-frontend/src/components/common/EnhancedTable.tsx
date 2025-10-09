import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Fade,
  CircularProgress,
  Typography,
  Button,
  ButtonGroup
} from '@mui/material';
import {
  Search,
  FilterList,
  MoreVert,
  Edit,
  Delete,
  ContentCopy,
  History,
  Refresh,
  Download,
  Upload
} from '@mui/icons-material';

export interface TableColumn {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: any) => React.ReactNode;
  sortable?: boolean;
  searchable?: boolean;
}

export interface TableAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: (row: any) => void;
  disabled?: (row: any) => boolean;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

export interface EnhancedTableProps {
  columns: TableColumn[];
  data: any[];
  actions?: TableAction[];
  bulkActions?: TableAction[];
  onRefresh?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  showPagination?: boolean;
  pageSize?: number;
  stickyHeader?: boolean;
}

export const EnhancedTable: React.FC<EnhancedTableProps> = ({
  columns,
  data,
  actions = [],
  bulkActions = [],
  onRefresh,
  onExport,
  onImport,
  loading = false,
  emptyMessage = 'No data available',
  searchPlaceholder = 'Search...',
  showPagination = true,
  pageSize = 10,
  stickyHeader = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = data.filter(item => {
      // Status filter
      if (statusFilter !== 'all') {
        const isActive = item.is_active !== undefined ? item.is_active : true;
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;
      }

      // Search filter
      if (searchTerm) {
        const searchableColumns = columns.filter(col => col.searchable !== false);
        const searchableText = searchableColumns
          .map(col => {
            const value = item[col.id];
            return value ? String(value).toLowerCase() : '';
          })
          .join(' ');
        
        if (!searchableText.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    // Sort data
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, statusFilter, columns, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedData.map(item => item.id || item.key)));
    } else {
      setSelectedRows(new Set());
    }
  }, [paginatedData]);

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleContextMenu = useCallback((event: React.MouseEvent, rowId: string) => {
    event.preventDefault();
    setAnchorEl(prev => ({ ...prev, [rowId]: event.currentTarget as HTMLElement }));
  }, []);

  const handleCloseContextMenu = useCallback((rowId: string) => {
    setAnchorEl(prev => ({ ...prev, [rowId]: null }));
  }, []);

  const getRowId = useCallback((item: any) => item.id || item.key || JSON.stringify(item), []);

  const selectedData = useMemo(() => {
    return data.filter(item => selectedRows.has(getRowId(item)));
  }, [data, selectedRows, getRowId]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Toolbar */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Search */}
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />

          {/* Status Filter */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              label="Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>

          {/* Bulk Actions */}
          {selectedRows.size > 0 && bulkActions.length > 0 && (
            <ButtonGroup size="small" variant="outlined">
              {bulkActions.map(action => (
                <Tooltip key={action.id} title={action.label}>
                  <Button
                    onClick={() => action.onClick(selectedData)}
                    disabled={action.disabled?.(selectedData)}
                    color={action.color}
                  >
                    {action.icon}
                  </Button>
                </Tooltip>
              ))}
            </ButtonGroup>
          )}
        </Box>

        {/* Quick Actions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
          )}
          {onExport && (
            <Tooltip title="Export">
              <IconButton onClick={onExport}>
                <Download />
              </IconButton>
            </Tooltip>
          )}
          {onImport && (
            <Tooltip title="Import">
              <IconButton onClick={onImport}>
                <Upload />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          borderRadius: 2,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}
      >
        <Table stickyHeader={stickyHeader}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {bulkActions.length > 0 && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedRows.size > 0 && selectedRows.size < paginatedData.length}
                    checked={paginatedData.length > 0 && selectedRows.size === paginatedData.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sx={{
                    fontWeight: 600,
                    cursor: column.sortable ? 'pointer' : 'default',
                    '&:hover': column.sortable ? { bgcolor: 'grey.100' } : {}
                  }}
                  onClick={() => column.sortable && handleSort(column.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {column.label}
                    {column.sortable && sortField === column.id && (
                      <Box sx={{ fontSize: '0.8rem', color: 'primary.main' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Box>
                    )}
                  </Box>
                </TableCell>
              ))}
              {actions.length > 0 && (
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0) + (actions.length > 0 ? 1 : 0)}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0) + (actions.length > 0 ? 1 : 0)}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <Typography color="text.secondary">{emptyMessage}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row) => {
                const rowId = getRowId(row);
                const isSelected = selectedRows.has(rowId);
                
                return (
                  <TableRow
                    key={rowId}
                    hover
                    selected={isSelected}
                    onContextMenu={(e) => handleContextMenu(e, rowId)}
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      '&.Mui-selected': { bgcolor: 'primary.light' }
                    }}
                  >
                    {bulkActions.length > 0 && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => {
                      const value = row[column.id];
                      return (
                        <TableCell key={column.id} align={column.align}>
                          {column.format ? column.format(value) : value}
                        </TableCell>
                      );
                    })}
                    {actions.length > 0 && (
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => handleContextMenu(e, rowId)}
                          size="small"
                        >
                          <MoreVert />
                        </IconButton>
                        <Menu
                          anchorEl={anchorEl[rowId]}
                          open={Boolean(anchorEl[rowId])}
                          onClose={() => handleCloseContextMenu(rowId)}
                          TransitionComponent={Fade}
                        >
                          {actions.map((action) => (
                            <MenuItem
                              key={action.id}
                              onClick={() => {
                                action.onClick(row);
                                handleCloseContextMenu(rowId);
                              }}
                              disabled={action.disabled?.(row)}
                            >
                              <ListItemIcon>{action.icon}</ListItemIcon>
                              <ListItemText>{action.label}</ListItemText>
                            </MenuItem>
                          ))}
                        </Menu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_, page) => setCurrentPage(page)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};
