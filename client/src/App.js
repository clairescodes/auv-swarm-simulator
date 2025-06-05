import React, { useState, useEffect, useRef } from 'react';
import MapView from './components/MapView';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [auvs, setAuvs] = useState([]);
  const [missions, setMissions] = useState([]);
  const [analytics, setAnalytics] = useState({
    total_collisions_avoided: 0,
    total_waypoints_completed: 0,
    auvs_reached_goal: 0,
    active_auvs: 0,
    total_auvs: 0,
    average_time_per_waypoint: 0,
    simulation_uptime: 0,
    active_missions: 0
  });
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [showDashboard, setShowDashboard] = useState(true);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // WebSocket connection management
  const connectWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onopen = () => {
        console.log('Connected to simulation server');
        setConnectionStatus('Connected');
        wsRef.current = ws;
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'simulation_update' || message.type === 'initial_state') {
            const { auv_states, missions: serverMissions } = message.data;
            setAuvs(auv_states || []);
            setMissions(serverMissions || []);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setConnectionStatus('Disconnected');
        wsRef.current = null;
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          setConnectionStatus('Reconnecting...');
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Connection Error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('Connection Failed');
    }
  };

  // Fetch analytics periodically
  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  // Initialize connection and analytics polling
  useEffect(() => {
    connectWebSocket();
    
    // Poll analytics every 2 seconds
    const analyticsInterval = setInterval(fetchAnalytics, 2000);
    
    // Initial analytics fetch
    fetchAnalytics();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(analyticsInterval);
    };
  }, []);

  // Handle mission creation
  const handleCreateMission = async (polygon) => {
    try {
      const response = await fetch('/api/mission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ polygon }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Mission created:', result.message);
        
        // Show success notification
        setConnectionStatus(`Mission created! Assigned to ${result.mission.assignedAuvs.length} AUVs`);
        setTimeout(() => setConnectionStatus('Connected'), 3000);
      } else {
        const error = await response.json();
        console.error('Failed to create mission:', error);
        alert('Failed to create mission: ' + error.error);
      }
    } catch (error) {
      console.error('Error creating mission:', error);
      alert('Error creating mission. Please check your connection.');
    }
  };

  // Handle simulation reset
  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset the simulation? This will clear all AUVs and missions.')) {
      return;
    }

    try {
      const response = await fetch('/api/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('Simulation reset successfully');
        setConnectionStatus('Simulation Reset');
        setTimeout(() => setConnectionStatus('Connected'), 2000);
      } else {
        console.error('Failed to reset simulation');
        alert('Failed to reset simulation');
      }
    } catch (error) {
      console.error('Error resetting simulation:', error);
      alert('Error resetting simulation');
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>AUV Swarm Simulator</h1>
        <div className="header-controls">
          <div className="connection-status">
            <span className={`status-indicator ${connectionStatus === 'Connected' ? 'connected' : 'disconnected'}`}>
              ●
            </span>
            {connectionStatus}
          </div>
          <button 
            className="toggle-button"
            onClick={() => setShowDashboard(!showDashboard)}
          >
            {showDashboard ? 'Hide' : 'Show'} Dashboard
          </button>
          <button 
            className="reset-button"
            onClick={handleReset}
          >
            Reset Simulation
          </button>
        </div>
      </header>

      <main className={`app-main ${showDashboard ? 'with-dashboard' : 'map-only'}`}>
        <div className="map-section">
          <MapView 
            auvs={auvs}
            missions={missions}
            onCreateMission={handleCreateMission}
          />
        </div>
        
        {showDashboard && (
          <div className="dashboard-section">
            <Dashboard analytics={analytics} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-stats">
          <span>{auvs.length} AUVs Active</span>
          <span>{missions.length} Missions</span>
          <span>{analytics.total_collisions_avoided} Collisions Avoided</span>
          <span>{analytics.total_waypoints_completed} Waypoints Completed</span>
        </div>
      </footer>
    </div>
  );
}

export default App;