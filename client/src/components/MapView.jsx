import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom AUV icon
const createAuvIcon = (heading, hasWaypoint) => {
  const color = hasWaypoint ? '#ff6b6b' : '#4ecdc4';
  const rotation = (heading * 180) / Math.PI; // Convert radians to degrees
  
  return L.divIcon({
    html: `
      <div style="
        transform: rotate(${rotation}deg);
        width: 20px;
        height: 20px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 50%;
          right: -5px;
          transform: translateY(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid ${color};
          border-top: 4px solid transparent;
          border-bottom: 4px solid transparent;
        "></div>
      </div>
    `,
    className: 'auv-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Component for drawing polygons
const PolygonDrawer = ({ onPolygonComplete }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);

  useMapEvents({
    click: (e) => {
      if (isDrawing) {
        const newPoints = [...currentPoints, [e.latlng.lat, e.latlng.lng]];
        setCurrentPoints(newPoints);
      }
    },
  });

  const startDrawing = () => {
    setIsDrawing(true);
    setCurrentPoints([]);
  };

  const finishPolygon = () => {
    if (currentPoints.length >= 3) {
      onPolygonComplete(currentPoints.map(point => ({ x: point[1], y: point[0] })));
    }
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  return (
    <div className="polygon-drawer">
      {!isDrawing ? (
        <button onClick={startDrawing} className="draw-button">
          Draw Mission Area
        </button>
      ) : (
        <div className="drawing-controls">
          <p>Click to add points. Need at least 3 points.</p>
          <button 
            onClick={finishPolygon} 
            disabled={currentPoints.length < 3}
            className="finish-button"
          >
            Finish Polygon ({currentPoints.length} points)
          </button>
          <button onClick={cancelDrawing} className="cancel-button">
            Cancel
          </button>
        </div>
      )}
      {currentPoints.length > 0 && (
        <Polyline 
          positions={currentPoints} 
          color="#ff6b6b" 
          weight={3}
          dashArray="5, 5"
        />
      )}
    </div>
  );
};

const MapView = ({ auvs, missions, onCreateMission }) => {
  const [auvPaths, setAuvPaths] = useState({});
  const mapRef = useRef();

  // Update AUV paths for trail visualization
  useEffect(() => {
    setAuvPaths(prevPaths => {
      const newPaths = { ...prevPaths };
      
      auvs.forEach(auv => {
        if (!newPaths[auv.id]) {
          newPaths[auv.id] = [];
        }
        
        // Add current position to path
        newPaths[auv.id].push([auv.y, auv.x]); // Note: Leaflet uses [lat, lng]
        
        // Keep only last 50 positions
        if (newPaths[auv.id].length > 50) {
          newPaths[auv.id].shift();
        }
      });
      
      return newPaths;
    });
  }, [auvs]);

  const handlePolygonComplete = (polygon) => {
    onCreateMission(polygon);
  };

  return (
    <div className="map-container">
      <MapContainer
        center={[0, 0]} // Center of our simulation area
        zoom={3}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Render AUVs */}
        {auvs.map(auv => (
          <Marker
            key={auv.id}
            position={[auv.y, auv.x]} // Note: Leaflet uses [lat, lng]
            icon={createAuvIcon(auv.heading, auv.hasActiveWaypoint)}
          >
            <Popup>
              <div>
                <h4>{auv.id}</h4>
                <p>Position: ({auv.x.toFixed(1)}, {auv.y.toFixed(1)})</p>
                <p>Heading: {(auv.heading * 180 / Math.PI).toFixed(1)}°</p>
                <p>Speed: {auv.speed.toFixed(1)}</p>
                <p>Waypoints completed: {auv.waypointsCompleted}</p>
                <p>Collisions avoided: {auv.collisionsAvoided}</p>
                {auv.currentWaypoint && (
                  <p>Next waypoint: ({auv.currentWaypoint.x.toFixed(1)}, {auv.currentWaypoint.y.toFixed(1)})</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render AUV trails */}
        {Object.entries(auvPaths).map(([auvId, path]) => (
          path.length > 1 && (
            <Polyline
              key={`trail-${auvId}`}
              positions={path}
              color="#74c0fc"
              weight={2}
              opacity={0.6}
            />
          )
        ))}

        {/* Render mission polygons */}
        {missions.map(mission => (
          <Polyline
            key={mission.id}
            positions={mission.polygon.map(p => [p.y, p.x])}
            color="#ff6b6b"
            weight={3}
            fill={true}
            fillColor="#ff6b6b"
            fillOpacity={0.2}
          />
        ))}

        {/* Polygon drawing component */}
        <PolygonDrawer onPolygonComplete={handlePolygonComplete} />
      </MapContainer>

      <div className="map-controls">
        <div className="legend">
          <h4>Legend</h4>
          <div className="legend-item">
            <div className="legend-color" style={{backgroundColor: '#4ecdc4'}}></div>
            <span>AUV (no mission)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{backgroundColor: '#ff6b6b'}}></div>
            <span>AUV (with mission)</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{backgroundColor: '#74c0fc'}}></div>
            <span>AUV trail</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{backgroundColor: '#ff6b6b'}}></div>
            <span>Mission area</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;