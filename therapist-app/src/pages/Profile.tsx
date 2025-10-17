import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

export const Profile: React.FC = () => {
  return (
    <div>
      <Title level={2}>My Profile</Title>
      <p>Profile management coming soon...</p>
    </div>
  );
};
