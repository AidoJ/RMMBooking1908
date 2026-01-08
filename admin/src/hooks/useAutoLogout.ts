import { useEffect, useRef } from 'react';
import { useLogout } from '@refinedev/core';
import { App } from 'antd';

const IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
const WARNING_TIME = 55 * 60 * 1000; // 55 minutes - show warning
const CHECK_INTERVAL = 60 * 1000; // Check every minute

export const useAutoLogout = () => {
  const { mutate: logout } = useLogout();
  const { modal } = App.useApp();
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Update last activity time on user interaction
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      warningShownRef.current = false; // Reset warning if user becomes active again
    };

    // Listen for user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, true);
    });

    // Check for inactivity periodically
    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;

      // Show warning at 55 minutes
      if (timeSinceActivity >= WARNING_TIME && !warningShownRef.current) {
        warningShownRef.current = true;
        modal.warning({
          title: 'Session Timeout Warning',
          content: 'You will be logged out in 5 minutes due to inactivity. Move your mouse or click anywhere to stay logged in.',
          okText: 'Stay Logged In',
          onOk: () => {
            updateActivity();
          },
        });
      }

      // Logout at 60 minutes
      if (timeSinceActivity >= IDLE_TIMEOUT) {
        console.log('🕐 Auto-logout: 1 hour of inactivity');
        modal.info({
          title: 'Session Expired',
          content: 'You have been logged out due to 1 hour of inactivity.',
          okText: 'OK',
        });
        logout();
      }
    };

    // Start checking
    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL);

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity, true);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [logout, modal]);
};
