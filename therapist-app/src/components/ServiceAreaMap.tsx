import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Radio,
  InputNumber,
  Button,
  Space,
  Typography,
  Alert,
  Row,
  Col,
  Switch,
  message
} from 'antd';
import {
  EnvironmentOutlined,
  RadiusSettingOutlined,
  EditOutlined,
  SaveOutlined,
  UndoOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface LatLng {
  lat: number;
  lng: number;
}

interface ServiceAreaMapProps {
  therapistId: string;
  currentRadius?: number;
  currentPolygon?: LatLng[];
  homeLat?: number;
  homeLng?: number;
  onSave: (type: 'radius' | 'polygon', radius?: number, polygon?: LatLng[]) => void;
}

export const ServiceAreaMap: React.FC<ServiceAreaMapProps> = ({
  therapistId,
  currentRadius = 25,
  currentPolygon = [],
  homeLat,
  homeLng,
  onSave
}) => {
  const [areaType, setAreaType] = useState<'radius' | 'polygon'>('radius');
  const [radius, setRadius] = useState(currentRadius);
  const [polygonPoints, setPolygonPoints] = useState<LatLng[]>(currentPolygon);
  const [isEditing, setIsEditing] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);

  // Load Google Maps
  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry`;
      script.async = true;
      script.onload = () => {
        setMapLoaded(true);
        initializeMap();
      };
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
      initializeMap();
    }
  }, []);

  const initializeMap = () => {
    if (!mapRef.current || !homeLat || !homeLng) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: homeLat, lng: homeLng },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    mapInstanceRef.current = map;

    // Add home marker
    new window.google.maps.Marker({
      position: { lat: homeLat, lng: homeLng },
      map: map,
      title: 'Your Home',
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
      }
    });

    // Initialize based on current area type
    if (areaType === 'radius') {
      drawRadiusCircle();
    } else if (areaType === 'polygon' && polygonPoints.length > 0) {
      drawPolygon();
    }
  };

  const drawRadiusCircle = () => {
    if (!mapInstanceRef.current || !homeLat || !homeLng) return;

    // Remove existing circle
    if (window.radiusCircle) {
      window.radiusCircle.setMap(null);
    }

    // Create new circle
    window.radiusCircle = new window.google.maps.Circle({
      strokeColor: '#1890ff',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#1890ff',
      fillOpacity: 0.2,
      map: mapInstanceRef.current,
      center: { lat: homeLat, lng: homeLng },
      radius: radius * 1000, // Convert km to meters
    });
  };

  const drawPolygon = () => {
    if (!mapInstanceRef.current || polygonPoints.length < 3) return;

    // Remove existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }

    // Create new polygon
    polygonRef.current = new window.google.maps.Polygon({
      paths: polygonPoints,
      strokeColor: '#1890ff',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#1890ff',
      fillOpacity: 0.2,
      map: mapInstanceRef.current,
      editable: isEditing,
      draggable: false,
    });

    // Add event listeners for editing
    if (isEditing) {
      polygonRef.current.addListener('set_at', handlePolygonEdit);
      polygonRef.current.addListener('insert_at', handlePolygonEdit);
    }
  };

  const handlePolygonEdit = () => {
    if (polygonRef.current) {
      const path = polygonRef.current.getPath();
      const points: LatLng[] = [];
      
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        points.push({
          lat: point.lat(),
          lng: point.lng()
        });
      }
      
      setPolygonPoints(points);
    }
  };

  const startPolygonDrawing = () => {
    if (!mapInstanceRef.current) return;

    setIsEditing(true);
    
    // Clear existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }

    // Initialize drawing manager
    const drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        strokeColor: '#1890ff',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#1890ff',
        fillOpacity: 0.2,
        editable: true,
        draggable: false,
      }
    });

    drawingManager.setMap(mapInstanceRef.current);

    // Listen for polygon completion
    window.google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon: any) => {
      const path = polygon.getPath();
      const points: LatLng[] = [];
      
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        points.push({
          lat: point.lat(),
          lng: point.lng()
        });
      }
      
      setPolygonPoints(points);
      polygonRef.current = polygon;
      drawingManager.setDrawingMode(null);
      setIsEditing(false);
      message.success('Service area created! You can now edit the shape by dragging the points.');
    });
  };

  const handleAreaTypeChange = (e: any) => {
    const newType = e.target.value;
    setAreaType(newType);
    
    if (newType === 'radius') {
      // Remove polygon, show radius
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      drawRadiusCircle();
    } else {
      // Remove radius, show polygon
      if (window.radiusCircle) {
        window.radiusCircle.setMap(null);
      }
      if (polygonPoints.length > 0) {
        drawPolygon();
      }
    }
  };

  const handleSave = () => {
    if (areaType === 'radius') {
      onSave('radius', radius);
    } else {
      if (polygonPoints.length < 3) {
        message.error('Please create a service area with at least 3 points');
        return;
      }
      onSave('polygon', undefined, polygonPoints);
    }
    message.success('Service area saved successfully!');
  };

  const calculateArea = () => {
    if (polygonPoints.length < 3) return 0;
    
    // Simple area calculation using shoelace formula
    let area = 0;
    for (let i = 0; i < polygonPoints.length; i++) {
      const j = (i + 1) % polygonPoints.length;
      area += polygonPoints[i].lng * polygonPoints[j].lat;
      area -= polygonPoints[j].lng * polygonPoints[i].lat;
    }
    return Math.abs(area) / 2;
  };

  return (
    <Card>
      <Title level={4}>Service Area</Title>
      
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Area Type Selection */}
            <div>
              <Text strong>Service Area Type:</Text>
              <Radio.Group 
                value={areaType} 
                onChange={handleAreaTypeChange}
                style={{ marginTop: 8, display: 'block' }}
              >
                <Radio value="radius">
                  <Space>
                    <RadiusSettingOutlined />
                    <Text>Simple Radius</Text>
                  </Space>
                </Radio>
                <Radio value="polygon">
                  <Space>
                    <EditOutlined />
                    <Text>Custom Area</Text>
                  </Space>
                </Radio>
              </Radio.Group>
            </div>

            {/* Radius Input */}
            {areaType === 'radius' && (
              <div>
                <Text strong>Service Radius:</Text>
                <InputNumber
                  value={radius}
                  onChange={(value) => setRadius(value || 25)}
                  min={1}
                  max={100}
                  addonAfter="km"
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>
            )}

            {/* Polygon Controls */}
            {areaType === 'polygon' && (
              <div>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={startPolygonDrawing}
                    disabled={isEditing}
                    block
                  >
                    {polygonPoints.length === 0 ? 'Draw Service Area' : 'Edit Service Area'}
                  </Button>
                  
                  {polygonPoints.length > 0 && (
                    <Alert
                      message={`Service area created with ${polygonPoints.length} points`}
                      description={`Approximate area: ${calculateArea().toFixed(2)} km²`}
                      type="info"
                      icon={<InfoCircleOutlined />}
                    />
                  )}
                </Space>
              </div>
            )}

            {/* Save Button */}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              block
              size="large"
            >
              Save Service Area
            </Button>
          </Space>
        </Col>

        <Col xs={24} md={12}>
          {/* Map Container */}
          <div
            ref={mapRef}
            style={{
              height: '400px',
              width: '100%',
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              marginTop: 16
            }}
          />
          
          {!mapLoaded && (
            <div style={{ 
              height: '400px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              marginTop: 16
            }}>
              <Text>Loading map...</Text>
            </div>
          )}
        </Col>
      </Row>
    </Card>
  );
};

