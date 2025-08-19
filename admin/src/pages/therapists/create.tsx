import React from 'react';
import TherapistProfileManagement from './profile';

export const CreateTherapistPage: React.FC = () => {
  // Just use the same profile component - it handles create mode when no ID is provided
  return <TherapistProfileManagement />;
}
