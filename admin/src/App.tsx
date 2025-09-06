import { Dashboard } from "./pages/dashboard";
import { Authenticated, Refine, useGetIdentity } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  AuthPage,
  ErrorComponent,
  ThemedLayoutV2,
  ThemedSiderV2,
  useNotificationProvider,
} from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";

import routerBindings, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import { App as AntdApp } from "antd";
import { BrowserRouter, Outlet, Route, Routes, useParams } from "react-router";
import authProvider from "./authProvider";
import { Header } from "./components/header";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { UserIdentity, UserRole, isTherapist, isAdmin } from "./utils/roleUtils";
import { supabaseClient } from "./utility";

// Import the booking management components
import { EnhancedBookingList } from "./pages/bookings/list";
import { CalendarBookingManagement } from "./pages/bookings/calendar";
import { BookingShow } from "./pages/bookings/show";
import { BookingEdit } from "./pages/bookings/edit";
import TherapistProfileManagement from "./pages/therapists/profile";

// Import the service management components
import ServiceList from "./pages/services/list";
import ServiceCreate from "./pages/services/create";
import ServiceEdit from "./pages/services/edit";
import ServiceShow from "./pages/services/show";

// Import the therapist management components
import TherapistList from "./pages/therapists/list";
import TherapistShow from "./pages/therapists/show";
import TherapistEdit from "./pages/therapists/edit";
import TherapistCreate from "./pages/therapists/create";

// Import the customer management components
import CustomerList from "./pages/customers/list";
import CustomerShow from "./pages/customers/show";
import CustomerEdit from "./pages/customers/edit";
import CustomerCreate from "./pages/customers/create";

// Import the system settings component
import SystemSettings from "./pages/system-settings";

// Import the quotes management component
import { QuotesList } from "./pages/quotes";

// Import the discount codes management components
import { DiscountCodesList, DiscountCodesCreate, DiscountCodesEdit, DiscountCodesShow } from "./pages/discount-codes";

// Import the gift cards management components
import { GiftCardsList, GiftCardsCreate, GiftCardsEdit, GiftCardsShow } from "./pages/gift-cards";

// Import the therapist payments management component
import { TherapistPaymentsList } from "./pages/therapist-payments/list";

// Import the therapist earnings component
import { TherapistEarnings } from "./pages/therapist-earnings";

// Wrapper component to get the ID from route params
const BookingShowWrapper = () => {
  const { id } = useParams();
  return <BookingShow id={id || ''} />;
};

// Service components are now imported above

// Import RoleGuard for inline components
import { RoleGuard } from './components/RoleGuard';

// Super Admin only pages
const UserManagement = () => (
  <RoleGuard requiredRole="admin">
    <div style={{padding: 24}}><h1>User Management</h1><p>Manage admin users and therapist accounts</p></div>
  </RoleGuard>
);
const ActivityLogs = () => (
  <RoleGuard requiredRole="admin">
    <div style={{padding: 24}}><h1>Activity Logs</h1><p>System activity monitoring will go here</p></div>
  </RoleGuard>
);
const Reports = () => (
  <RoleGuard requiredRole="admin">
    <div style={{padding: 24}}><h1>Business Reports</h1><p>Analytics and business reports will go here</p></div>
  </RoleGuard>
);


const AppContent: React.FC = () => {
  return (
    <Refine
      dataProvider={dataProvider(supabaseClient)}
      liveProvider={liveProvider(supabaseClient)}
      authProvider={authProvider}
      routerProvider={routerBindings}
      notificationProvider={useNotificationProvider}
      resources={[
        {
          name: "dashboard",
          list: "/",
          meta: {
            label: "Dashboard",
            icon: "🏠",
          },
        },
        {
          name: "bookings",
          list: "/bookings",
          show: "/bookings/show/:id",
          edit: "/bookings/edit/:id",
          meta: {
            canDelete: true,
            label: "Bookings",
            icon: "📋",
          },
        },
        {
          name: "calendar",
          list: "/calendar",
          meta: {
            label: "Calendar",
            icon: "📅",
          },
        },
        {
          name: "quotes",
          list: "/quotes",
          meta: {
            label: "Quotes",
            icon: "💰",
          },
        },
        {
          name: "discount_codes",
          list: "/discount-codes",
          create: "/discount-codes/create",
          edit: "/discount-codes/edit/:id",
          show: "/discount-codes/show/:id",
          meta: {
            canDelete: true,
            label: "Discount Codes",
            icon: "🏷️",
          },
        },
        {
          name: "gift_cards",
          list: "/gift-cards",
          create: "/gift-cards/create",
          edit: "/gift-cards/edit/:id",
          show: "/gift-cards/show/:id",
          meta: {
            canDelete: true,
            label: "Gift Cards",
            icon: "🎁",
          },
        },
        {
          name: "therapist_payments",
          list: "/therapist-payments",
          meta: {
            label: "Therapist Payments",
            icon: "💰",
          },
        },
        {
          name: "therapist_profiles",
          list: "/therapists",
          show: "/therapists/show/:id",
          edit: "/therapists/edit/:id",
          create: "/therapists/create",
          meta: {
            canDelete: true,
            label: "Therapists",
            icon: "👨‍⚕️",
          },
        },
        {
          name: "my-profile",
          list: "/my-profile",
          meta: {
            label: "My Profile",
            icon: "👤",
          },
        },
        {
          name: "my-earnings",
          list: "/my-earnings",
          meta: {
            label: "My Earnings",
            icon: "💰",
          },
        },
        {
          name: "customers",
          list: "/customers",
          create: "/customers/create",
          show: "/customers/show/:id",
          edit: "/customers/edit/:id",
          meta: {
            canDelete: true,
            label: "Customers",
            icon: "👥",
          },
        },
        {
          name: "services",
          list: "/services",
          show: "/services/show/:id",
          edit: "/services/edit/:id",
          create: "/services/create",
          meta: {
            canDelete: true,
            label: "Services",
            icon: "💆‍♀️",
          },
        },
        {
          name: "reports",
          list: "/reports",
          meta: {
            label: "Reports",
            icon: "📊",
          },
        },
        {
          name: "system-settings",
          list: "/system-settings",
          meta: {
            label: "System Settings",
            icon: "⚙️",
          },
        },
        {
          name: "user-management",
          list: "/user-management",
          meta: {
            label: "User Management",
            icon: "👤",
          },
        },
        {
          name: "activity-logs",
          list: "/activity-logs",
          meta: {
            label: "Activity Logs",
            icon: "📝",
          },
        },
      ]}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
        useNewQueryKeys: true,
        projectId: "rejuvenators-platform",
      }}
    >
      <Routes>
        <Route
          element={
            <Authenticated
              key="authenticated-inner"
              fallback={<CatchAllNavigate to="/login" />}
            >
              <ThemedLayoutV2
                Header={() => <Header sticky />}
                Sider={(props) => <ThemedSiderV2 {...props} fixed />}
              >
                <Outlet />
              </ThemedLayoutV2>
            </Authenticated>
          }
        >
          <Route
            index
            element={<NavigateToResource resource="dashboard" />}
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bookings" element={<EnhancedBookingList />} />
          <Route path="/bookings/show/:id" element={<BookingShowWrapper />} />
          <Route path="/bookings/edit/:id" element={<BookingEdit />} />
          <Route path="/calendar" element={<CalendarBookingManagement />} />
          <Route path="/quotes" element={<QuotesList />} />
          <Route path="/discount-codes" element={<DiscountCodesList />} />
          <Route path="/discount-codes/create" element={<DiscountCodesCreate />} />
          <Route path="/discount-codes/edit/:id" element={<DiscountCodesEdit />} />
          <Route path="/discount-codes/show/:id" element={<DiscountCodesShow />} />
          <Route path="/gift-cards" element={<GiftCardsList />} />
          <Route path="/gift-cards/create" element={<GiftCardsCreate />} />
          <Route path="/gift-cards/edit/:id" element={<GiftCardsEdit />} />
          <Route path="/gift-cards/show/:id" element={<GiftCardsShow />} />
          <Route path="/therapist-payments" element={<TherapistPaymentsList />} />
          <Route path="/therapists" element={<TherapistList />} />
          <Route path="/therapists/show/:id" element={<TherapistShow />} />
          <Route path="/therapists/edit/:id" element={<TherapistEdit />} />
          <Route path="/therapists/create" element={<TherapistCreate />} />
          <Route path="/my-profile" element={<TherapistProfileManagement />} />
          <Route path="/my-earnings" element={<TherapistEarnings />} />
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/show/:id" element={<CustomerShow />} />
          <Route path="/customers/edit/:id" element={<CustomerEdit />} />
          <Route path="/customers/create" element={<CustomerCreate />} />
          <Route path="/services" element={<ServiceList />} />
          <Route path="/services/show/:id" element={<ServiceShow />} />
          <Route path="/services/edit/:id" element={<ServiceEdit />} />
          <Route path="/services/create" element={<ServiceCreate />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/system-settings" element={<SystemSettings />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/activity-logs" element={<ActivityLogs />} />
        </Route>
        <Route
          element={
            <Authenticated key="authenticated-outer" fallback={<Outlet />}>
              <NavigateToResource />
            </Authenticated>
          }
        >
          <Route path="/login" element={<AuthPage type="login" />} />
        </Route>
        <Route
          element={
            <Authenticated key="authenticated-catch-all">
              <ThemedLayoutV2
                Header={() => <Header sticky />}
                Sider={(props) => <ThemedSiderV2 {...props} fixed />}
              >
                <Outlet />
              </ThemedLayoutV2>
            </Authenticated>
          }
        >
          <Route path="*" element={<ErrorComponent />} />
        </Route>
      </Routes>
    </Refine>
  );
};

function App() {
  return (
    <BrowserRouter basename="/admin">
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <AntdApp>
            <DevtoolsProvider>
              <AppContent />
              <DevtoolsPanel />
            </DevtoolsProvider>
          </AntdApp>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
