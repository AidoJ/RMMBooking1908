import React from 'react';
import { Avatar, Space, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface TherapistPhotoProps {
  therapistId: string;
  photoUrl?: string;
  name?: string;
  size?: number;
  showBio?: boolean;
  bio?: string;
}

// Handle both Base64 and regular URLs
const getDisplayImageUrl = (originalUrl: string): string => {
  if (!originalUrl) return '';
  
  // If it's already a base64 string, return as-is
  if (originalUrl.startsWith('data:image/')) {
    return originalUrl;
  }
  
  // If it's a regular URL, try to optimize it
  try {
    const url = new URL(originalUrl);
    
    // For Cloudinary URLs, add optimization
    if (url.hostname.includes('cloudinary.com')) {
      // Insert transformation parameters for Cloudinary
      const pathParts = url.pathname.split('/');
      const uploadIndex = pathParts.indexOf('upload');
      if (uploadIndex !== -1) {
        pathParts.splice(uploadIndex + 1, 0, 'w_240,h_240,c_fill,f_auto,q_auto');
        url.pathname = pathParts.join('/');
      }
    }
    
    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return originalUrl;
  }
};

export const TherapistPhoto: React.FC<TherapistPhotoProps> = ({
  photoUrl,
  name,
  size = 64,
  showBio = false,
  bio
}) => {
  const displayUrl = photoUrl ? getDisplayImageUrl(photoUrl) : undefined;

  return (
    <Space direction="vertical" align="center" style={{ textAlign: 'center' }}>
      <Avatar
        size={size}
        src={displayUrl}
        icon={<UserOutlined />}
        style={{ 
          border: photoUrl ? '2px solid #f0f0f0' : 'none',
          boxShadow: photoUrl ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
        }}
      />
      
      {name && (
        <Text strong style={{ fontSize: size > 80 ? '16px' : '14px' }}>
          {name}
        </Text>
      )}
      
      {showBio && bio && (
        <Text 
          type="secondary" 
          style={{ 
            fontSize: '12px',
            maxWidth: '200px',
            textAlign: 'center'
          }}
          ellipsis={{ tooltip: bio }}
        >
          {bio}
        </Text>
      )}
    </Space>
  );
};
