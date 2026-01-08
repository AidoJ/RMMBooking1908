import { useAutoLogout } from '../hooks/useAutoLogout';

interface AuthenticatedAppProps {
  children: React.ReactNode;
}

export const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({ children }) => {
  // Enable auto-logout after 1 hour of inactivity
  useAutoLogout();

  return <>{children}</>;
};
