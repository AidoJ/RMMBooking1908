import { Dashboard } from "./pages/dashboard";
import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  AuthPage,
  ErrorComponent,
  useNotificationProvider,
} from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";

// Import the new mobile-first Admin Layout
import { AdminLayout } from "./components/AdminLayout";

import routerBindings, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { liveProvider } from "@refinedev/supabase";
import dataProvider from "./dataProvider";
import { App as AntdApp } from "antd";
import { BrowserRouter, Outlet, Route, Routes, useParams } from "react-router";
import authProvider from "./authProvider";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { realSupabaseClient } from "./utility/supabaseClient";

// Import the booking management components
import { EnhancedBookingList } from "./pages/bookings/list";
import { CalendarBookingManagement } from "./pages/bookings/calendar";
import { BookingShow } from "./pages/bookings/show";
import { BookingEdit } from "./pages/bookings/edit";
import { BookingEditNew } from "./pages/bookings/edit-new";
import { BookingEditPlatform } from "./pages/bookings/edit-platform";

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

// Import the services uplift rates component
import ServicesUpliftRates from "./pages/services-uplift-rates";

// Import the quotes management components
import { QuotesList, QuoteShow, QuoteEdit, EnhancedQuoteEdit } from "./pages/quotes";

// Import the discount codes management components
import { DiscountCodesList, DiscountCodesCreate, DiscountCodesEdit, DiscountCodesShow } from "./pages/discount-codes";

// Import the gift cards management components
import { GiftCardsList, GiftCardsCreate, GiftCardsEdit, GiftCardsShow } from "./pages/gift-cards";

// Import the therapist payments management components
import TherapistPayments from "./pages/therapist-payments";

// Import the user management components
import { UserManagementList } from "./pages/user-management";

// Wrapper component to get the ID from route params
const BookingShowWrapper = () => {
  const { id } = useParams();
  return <BookingShow id={id || ''} />;
};

// Service components are now imported above

// Super Admin only pages
const ActivityLogs = () => <div style={{padding: 24}}><h1>Activity Logs</h1><p>System activity monitoring will go here</p></div>;
const Reports = () => <div style={{padding: 24}}><h1>Business Reports</h1><p>Analytics and business reports will go here</p></div>;

function App() {
  return (
    <BrowserRouter basename="/admin">
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <AntdApp>
            <DevtoolsProvider>
              <Refine
                dataProvider={dataProvider}
                liveProvider={liveProvider(realSupabaseClient)}
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
                    name: "quotes",
                    list: "/quotes",
                    show: "/quotes/show/:id",
                    edit: "/quotes/edit/:id",
                    meta: {
                      canDelete: true,
                      label: "Quotes",
                      icon: "💰",
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
                    name: "services-uplift-rates",
                    list: "/services-uplift-rates",
                    meta: {
                      label: "Services Uplift Rates",
                      icon: "💲",
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
                    name: "therapist-payments",
                    list: "/therapist-payments",
                    meta: {
                      label: "Therapist Payments",
                      icon: "💵",
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
                  projectId: "KzRnmo-KKZ8aE-7jCGlj",
                }}
              >
                <Routes>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-inner"
                        fallback={<CatchAllNavigate to="/login" />}
                      >
                        <AdminLayout>
                          <Outlet />
                        </AdminLayout>
                      </Authenticated>
                    }
                  >
                    {/* Dashboard */}
                    <Route index element={<Dashboard />} />
                    
                    {/* Booking Management */}
                    <Route path="/bookings">
                      <Route index element={<EnhancedBookingList />} />
                      <Route path="calendar" element={<CalendarBookingManagement />} />
                      <Route path="edit/:id" element={<BookingEdit />} />
                      <Route path="edit-new/:id" element={<BookingEditNew />} />
                      <Route path="edit-platform/:id" element={<BookingEditPlatform />} />
                      <Route path="show/:id" element={<BookingShowWrapper />} />
                    </Route>
                    
                    {/* Quote Management */}
                    <Route path="/quotes">
                      <Route index element={<QuotesList />} />
                      <Route path="show/:id" element={<QuoteShow />} />
                      <Route path="edit/:id" element={<EnhancedQuoteEdit />} />
                    </Route>
                    
                    {/* Discount Codes Management */}
                    <Route path="/discount-codes">
                      <Route index element={<DiscountCodesList />} />
                      <Route path="create" element={<DiscountCodesCreate />} />
                      <Route path="edit/:id" element={<DiscountCodesEdit />} />
                      <Route path="show/:id" element={<DiscountCodesShow />} />
                    </Route>
                    
                    {/* Gift Cards Management */}
                    <Route path="/gift-cards">
                      <Route index element={<GiftCardsList />} />
                      <Route path="create" element={<GiftCardsCreate />} />
                      <Route path="edit/:id" element={<GiftCardsEdit />} />
                      <Route path="show/:id" element={<GiftCardsShow />} />
                    </Route>
                    
                    
                    {/* Calendar */}
                    <Route path="/calendar" element={<CalendarBookingManagement />} />
                    
                    {/* Therapist Management (Admin) */}
                    <Route path="/therapists">
                      <Route index element={<TherapistList />} />
                      <Route path="create" element={<TherapistCreate />} />
                      <Route path="edit/:id" element={<TherapistEdit />} />
                      <Route path="show/:id" element={<TherapistShow />} />
                    </Route>

                    {/* Customer Management */}
                    <Route path="/customers">
                      <Route index element={<CustomerList />} />
                      <Route path="create" element={<CustomerCreate />} />
                      <Route path="edit/:id" element={<CustomerEdit />} />
                      <Route path="show/:id" element={<CustomerShow />} />
                    </Route>
                    
                    {/* Service Management */}
                    <Route path="/services">
                      <Route index element={<ServiceList />} />
                      <Route path="create" element={<ServiceCreate />} />
                      <Route path="edit/:id" element={<ServiceEdit />} />
                      <Route path="show/:id" element={<ServiceShow />} />
                    </Route>

                    {/* Services Uplift Rates */}
                    <Route path="/services-uplift-rates" element={<ServicesUpliftRates />} />

                    {/* Therapist Payments */}
                    <Route path="/therapist-payments" element={<TherapistPayments />} />

                    {/* Reports */}
                    <Route path="/reports" element={<Reports />} />
                    
                    {/* System Settings (Super Admin Only) */}
                    <Route path="/system-settings" element={<SystemSettings />} />
                    
                    {/* User Management (Super Admin Only) */}
                    <Route path="/user-management" element={<UserManagementList />} />
                    
                    {/* Activity Logs (Super Admin Only) */}
                    <Route path="/activity-logs" element={<ActivityLogs />} />
                    
                    <Route path="*" element={<ErrorComponent />} />
                  </Route>
                  
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-outer"
                        fallback={<Outlet />}
                      >
                        <NavigateToResource />
                      </Authenticated>
                    }
                  >
                    <Route
                      path="/login"
                      element={
                        <AuthPage
                          type="login"
                          title="Rejuvenators Admin Panel"
                          formProps={{
                            initialValues: {
                              email: "admin@rejuvenators.com",
                              password: "admin123",
                            },
                          }}
                        />
                      }
                    />
                  </Route>
                </Routes>

                <RefineKbar />
                <UnsavedChangesNotifier />
                <DocumentTitleHandler />
              </Refine>
              <DevtoolsPanel />
            </DevtoolsProvider>
          </AntdApp>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
