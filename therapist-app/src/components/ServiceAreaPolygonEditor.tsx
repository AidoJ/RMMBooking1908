import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Space, message, Alert, Spin } from 'antd';
import { DeleteOutlined, EditOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import geocodingService from '../services/geocodingService';

interface Coordinate {
  lat: number;
  lng: number;
}

interface ServiceAreaPolygonEditorProps {
  centerLat?: number;
  centerLng?: number;
  serviceRadiusKm?: number;
  existingPolygon?: Coordinate[];
  onPolygonChange: (polygon: Coordinate[] | null) => void;
}

const ServiceAreaPolygonEditor: React.FC<ServiceAreaPolygonEditorProps> = ({
  centerLat,
  centerLng,
  serviceRadiusKm = 10,
  existingPolygon,
  onPolygonChange
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [tempPath, setTempPath] = useState<Coordinate[]>([]);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && centerLat && centerLng) {
      updateMapCenter(centerLat, centerLng);
    }
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (existingPolygon && existingPolygon.length > 0 && mapInstanceRef.current) {
      loadExistingPolygon(existingPolygon);
    }
  }, [existingPolygon]);

  const initializeMap = async () => {
    try {
      setIsLoading(true);

      // Ensure Google Maps is loaded
      await (geocodingService as any).loadGoogleMaps();
      const google = (window as any).google;

      if (!mapRef.current || !google) {
        throw new Error('Google Maps not available');
      }

      // Default center (Sydney, Australia if no coordinates provided)
      const defaultCenter = {
        lat: centerLat || -33.8688,
        lng: centerLng || 151.2093
      };

      // Initialize map
      const map = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 13,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
          position: google.maps.ControlPosition.TOP_RIGHT
        },
        streetViewControl: false,
        fullscreenControl: true
      });

      mapInstanceRef.current = map;

      // Add center marker if coordinates provided
      if (centerLat && centerLng) {
        markerRef.current = new google.maps.Marker({
          position: { lat: centerLat, lng: centerLng },
          map: map,
          title: 'Home Address',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#007e8c',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8
          }
        });

        // Show radius circle as reference
        if (serviceRadiusKm && serviceRadiusKm > 0) {
          circleRef.current = new google.maps.Circle({
            map: map,
            center: { lat: centerLat, lng: centerLng },
            radius: serviceRadiusKm * 1000, // Convert km to meters
            fillColor: '#007e8c',
            fillOpacity: 0.1,
            strokeColor: '#007e8c',
            strokeOpacity: 0.3,
            strokeWeight: 1,
            clickable: false
          });
        }
      }

      // Load existing polygon if available
      if (existingPolygon && existingPolygon.length > 0) {
        loadExistingPolygon(existingPolygon);
      }

      setIsLoading(false);
    } catch (error: any) {
      console.error('Error initializing map:', error);
      message.error('Failed to load map');
      setIsLoading(false);
    }
  };

  const updateMapCenter = (lat: number, lng: number) => {
    const google = (window as any).google;
    if (!mapInstanceRef.current || !google) return;

    const newCenter = { lat, lng };
    mapInstanceRef.current.setCenter(newCenter);

    // Update center marker
    if (markerRef.current) {
      markerRef.current.setPosition(newCenter);
    } else {
      markerRef.current = new google.maps.Marker({
        position: newCenter,
        map: mapInstanceRef.current,
        title: 'Home Address',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#007e8c',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 8
        }
      });
    }

    // Update radius circle
    if (circleRef.current) {
      circleRef.current.setCenter(newCenter);
    } else if (serviceRadiusKm && serviceRadiusKm > 0) {
      circleRef.current = new google.maps.Circle({
        map: mapInstanceRef.current,
        center: newCenter,
        radius: serviceRadiusKm * 1000,
        fillColor: '#007e8c',
        fillOpacity: 0.1,
        strokeColor: '#007e8c',
        strokeOpacity: 0.3,
        strokeWeight: 1,
        clickable: false
      });
    }
  };

  const loadExistingPolygon = (coordinates: Coordinate[]) => {
    const google = (window as any).google;
    if (!mapInstanceRef.current || !google || coordinates.length < 3) return;

    // Remove existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }

    // Create polygon
    polygonRef.current = new google.maps.Polygon({
      paths: coordinates,
      strokeColor: '#007e8c',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#007e8c',
      fillOpacity: 0.35,
      editable: false,
      draggable: false
    });

    polygonRef.current.setMap(mapInstanceRef.current);
    setHasPolygon(true);

    // Fit map to polygon bounds
    const bounds = new google.maps.LatLngBounds();
    coordinates.forEach(coord => bounds.extend(coord));
    mapInstanceRef.current.fitBounds(bounds);
  };

  const startDrawing = () => {
    const google = (window as any).google;
    if (!mapInstanceRef.current || !google) return;

    // Remove existing polygon if any
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    setIsDrawing(true);
    setTempPath([]);
    setHasPolygon(false);

    // Create an empty MVCArray for the path
    const path = new google.maps.MVCArray();

    // Create new polygon with the empty path
    polygonRef.current = new google.maps.Polygon({
      path: path,
      strokeColor: '#007e8c',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#007e8c',
      fillOpacity: 0.35,
      editable: false,
      draggable: false,
      clickable: false  // Prevent polygon from intercepting clicks
    });

    polygonRef.current.setMap(mapInstanceRef.current);

    // Listen for clicks to add points
    const clickListener = google.maps.event.addListener(
      mapInstanceRef.current,
      'click',
      (event: any) => {
        if (!polygonRef.current) return;

        const polygonPath = polygonRef.current.getPath();
        if (polygonPath) {
          polygonPath.push(event.latLng);

          // Update temp path for validation
          const coords: Coordinate[] = [];
          polygonPath.getArray().forEach((latLng: any) => {
            coords.push({ lat: latLng.lat(), lng: latLng.lng() });
          });
          setTempPath(coords);
        }
      }
    );

    // Store listener reference for cleanup
    (polygonRef.current as any).clickListener = clickListener;

    message.info('Click on the map to draw your service area. Click "Save Polygon" when done.');
  };

  const savePolygon = () => {
    const google = (window as any).google;
    if (!polygonRef.current || !google) return;

    const path = polygonRef.current.getPath();
    const coordinates: Coordinate[] = [];

    path.getArray().forEach((latLng: any) => {
      coordinates.push({
        lat: latLng.lat(),
        lng: latLng.lng()
      });
    });

    // Validate polygon (must have at least 3 points)
    if (coordinates.length < 3) {
      message.error('Polygon must have at least 3 points');
      return;
    }

    // Close the polygon if not already closed
    if (coordinates.length > 0) {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first.lat !== last.lat || first.lng !== last.lng) {
        coordinates.push({ ...first });
      }
    }

    // Remove click listener
    if ((polygonRef.current as any).clickListener) {
      google.maps.event.removeListener((polygonRef.current as any).clickListener);
    }

    // Make polygon non-editable
    polygonRef.current.setEditable(false);

    setIsDrawing(false);
    setHasPolygon(true);
    setTempPath([]);
    onPolygonChange(coordinates);

    message.success(`Service area polygon saved with ${coordinates.length} points`);
  };

  const clearPolygon = () => {
    if (polygonRef.current) {
      const google = (window as any).google;

      // Remove click listener if drawing
      if ((polygonRef.current as any).clickListener) {
        google.maps.event.removeListener((polygonRef.current as any).clickListener);
      }

      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    setIsDrawing(false);
    setHasPolygon(false);
    setTempPath([]);
    onPolygonChange(null);
    message.info('Service area polygon cleared');
  };

  const editPolygon = () => {
    if (!polygonRef.current) return;

    const google = (window as any).google;
    polygonRef.current.setEditable(true);

    // Listen for path changes
    const path = polygonRef.current.getPath();
    google.maps.event.addListener(path, 'set_at', () => {
      updatePolygonFromPath();
    });
    google.maps.event.addListener(path, 'insert_at', () => {
      updatePolygonFromPath();
    });
    google.maps.event.addListener(path, 'remove_at', () => {
      updatePolygonFromPath();
    });

    setIsDrawing(true);
    message.info('Edit mode enabled. Drag points to adjust, then click "Save Polygon".');
  };

  const updatePolygonFromPath = () => {
    if (!polygonRef.current) return;

    const path = polygonRef.current.getPath();
    const coordinates: Coordinate[] = [];

    path.getArray().forEach((latLng: any) => {
      coordinates.push({
        lat: latLng.lat(),
        lng: latLng.lng()
      });
    });

    setTempPath(coordinates);
  };

  const undoLastPoint = () => {
    if (!polygonRef.current || !isDrawing) return;

    const path = polygonRef.current.getPath();
    if (path.getLength() > 0) {
      path.pop();

      // Update temp path
      const coords: Coordinate[] = [];
      path.getArray().forEach((latLng: any) => {
        coords.push({ lat: latLng.lat(), lng: latLng.lng() });
      });
      setTempPath(coords);

      message.info('Last point removed');
    }
  };

  return (
    <Card
      title="Service Area Polygon Editor"
      style={{ marginBottom: '24px' }}
      extra={
        <Space>
          {!isDrawing && !hasPolygon && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={startDrawing}
              style={{ background: '#007e8c', borderColor: '#007e8c' }}
              disabled={!centerLat || !centerLng}
            >
              Draw Polygon
            </Button>
          )}
          {isDrawing && (
            <>
              <Button
                icon={<UndoOutlined />}
                onClick={undoLastPoint}
                disabled={tempPath.length === 0}
              >
                Undo
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={savePolygon}
                style={{ background: '#00a99d', borderColor: '#00a99d' }}
                disabled={tempPath.length < 3}
              >
                Save Polygon
              </Button>
            </>
          )}
          {hasPolygon && !isDrawing && (
            <>
              <Button
                icon={<EditOutlined />}
                onClick={editPolygon}
              >
                Edit
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={clearPolygon}
              >
                Clear
              </Button>
            </>
          )}
        </Space>
      }
    >
      {!centerLat || !centerLng ? (
        <Alert
          message="Address Required"
          description="Please verify the home address in your profile first. The service area will be drawn around the verified location."
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      ) : (
        <Alert
          message="Define Custom Service Area"
          description={
            hasPolygon
              ? 'Custom service area defined. You can edit or clear the polygon above.'
              : isDrawing
              ? `Drawing polygon... Click on the map to add points (${tempPath.length} points so far). Need at least 3 points.`
              : 'Click "Draw Polygon" to define a custom service area. The blue circle shows the current radius for reference.'
          }
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <div style={{ position: 'relative', width: '100%', height: '500px' }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }}>
            <Spin size="large" />
          </div>
        )}
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            border: '1px solid #d9d9d9'
          }}
        />
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
        <strong>Tips:</strong>
        <ul style={{ marginTop: '8px', marginBottom: 0 }}>
          <li>The blue circle represents your current service radius ({serviceRadiusKm}km) as a reference</li>
          <li>Click on the map to add points and draw your custom service area boundary</li>
          <li>The polygon will automatically close when you save it</li>
          <li>You can edit the polygon later by clicking "Edit" and dragging the points</li>
        </ul>
      </div>
    </Card>
  );
};

export default ServiceAreaPolygonEditor;
