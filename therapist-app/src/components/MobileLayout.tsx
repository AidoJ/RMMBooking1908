import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  BottomNavigation,
  BottomNavigationAction,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Box,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CheckCircle as CheckCircleIcon,
  AttachMoney as MoneyIcon,
  Description as InvoiceIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const MobileLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [bottomNavValue, setBottomNavValue] = useState(0);

  // Map routes to bottom navigation values
  const getNavValue = (pathname: string) => {
    switch (pathname) {
      case '/dashboard': return 0;
      case '/complete-job': return 1;
      case '/earnings': return 2;
      case '/invoice': return 3;
      case '/calendar': return 4;
      case '/profile': return 5;
      default: return 0;
    }
  };

  const handleBottomNavChange = (event: React.SyntheticEvent, newValue: number) => {
    setBottomNavValue(newValue);
    switch (newValue) {
      case 0: navigate('/dashboard'); break;
      case 1: navigate('/complete-job'); break;
      case 2: navigate('/earnings'); break;
      case 3: navigate('/invoice'); break;
      case 4: navigate('/calendar'); break;
      case 5: navigate('/profile'); break;
    }
  };

  // Update bottom nav when route changes
  React.useEffect(() => {
    setBottomNavValue(getNavValue(location.pathname));
  }, [location.pathname]);

  const bottomNavItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { label: 'Complete', icon: <CheckCircleIcon />, path: '/complete-job' },
    { label: 'Earnings', icon: <MoneyIcon />, path: '/earnings' },
    { label: 'Invoice', icon: <InvoiceIcon />, path: '/invoice' },
    { label: 'Calendar', icon: <CalendarIcon />, path: '/calendar' },
    { label: 'Profile', icon: <PersonIcon />, path: '/profile' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {user?.first_name ? `Hi ${user.first_name}!` : 'Therapist Portal'}
          </Typography>
          
          <IconButton color="inherit">
            <Badge badgeContent={3} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          overflow: 'auto',
          pb: isMobile ? 7 : 0, // Add bottom padding for mobile bottom nav
          px: 2,
          py: 2
        }}
      >
        <Outlet />
      </Box>

      {/* Bottom Navigation (Mobile only) */}
      {isMobile && (
        <BottomNavigation
          value={bottomNavValue}
          onChange={handleBottomNavChange}
          showLabels
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          {bottomNavItems.map((item, index) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
              sx={{
                minWidth: 'auto',
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem',
                },
              }}
            />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
};

export default MobileLayout;

