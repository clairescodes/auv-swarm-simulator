const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const SimulationManager = require('./simulation/SimulationManager');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create simulation manager
const simulation = new SimulationManager(25); // Start with 25 AUVs

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients
const clients = new Set();

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected. Total clients:', clients.size + 1);
  clients.add(ws);

  // Send initial state to new client
  ws.send(JSON.stringify({
    type: 'initial_state',
    data: simulation.getState()
  }));

  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected. Total clients:', clients.size);
  });

  // Handle client errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Set up broadcast callback for simulation
simulation.setBroadcastCallback((state) => {
  const message = JSON.stringify({
    type: 'simulation_update',
    data: state
  });

  // Broadcast to all connected clients
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending to client:', error);
        clients.delete(client);
      }
    }
  });
});

// API Routes

// Get current simulation state
app.get('/api/status', (req, res) => {
  res.json(simulation.getState());
});

// Get analytics
app.get('/api/analytics', (req, res) => {
  res.json(simulation.getAnalytics());
});

// Create new mission (polygon)
app.post('/api/mission', (req, res) => {
  try {
    const { polygon } = req.body;
    
    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({ 
        error: 'Invalid polygon. Must be an array of at least 3 points.' 
      });
    }

    // Ensure polygon points have x,y properties
    const formattedPolygon = polygon.map(point => ({
      x: point.x || point[0] || point.lng,
      y: point.y || point[1] || point.lat
    }));

    const mission = simulation.createMission(formattedPolygon);
    
    res.json({ 
      success: true, 
      mission: mission,
      message: `Mission created and assigned to ${mission.assignedAuvs.length} AUVs`
    });
  } catch (error) {
    console.error('Error creating mission:', error);
    res.status(500).json({ error: 'Failed to create mission' });
  }
});

// Assign waypoint to specific AUV
app.put('/api/auv/:id/waypoint', (req, res) => {
  try {
    const { id } = req.params;
    const { waypoint } = req.body;

    if (!waypoint || typeof waypoint.x !== 'number' || typeof waypoint.y !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid waypoint. Must have x and y coordinates.' 
      });
    }

    const success = simulation.assignWaypointToAuv(id, waypoint);
    
    if (success) {
      res.json({ success: true, message: `Waypoint assigned to ${id}` });
    } else {
      res.status(404).json({ error: `AUV ${id} not found` });
    }
  } catch (error) {
    console.error('Error assigning waypoint:', error);
    res.status(500).json({ error: 'Failed to assign waypoint' });
  }
});

// Get specific AUV info
app.get('/api/auv/:id', (req, res) => {
  try {
    const { id } = req.params;
    const auv = simulation.getAuv(id);
    
    if (auv) {
      res.json(auv.getState());
    } else {
      res.status(404).json({ error: `AUV ${id} not found` });
    }
  } catch (error) {
    console.error('Error getting AUV:', error);
    res.status(500).json({ error: 'Failed to get AUV info' });
  }
});

// Reset simulation
app.post('/api/reset', (req, res) => {
  try {
    simulation.reset();
    // Recreate with new AUVs
    const numAuvs = req.body.numAuvs || 25;
    simulation.constructor(numAuvs);
    simulation.setBroadcastCallback((state) => {
      const message = JSON.stringify({
        type: 'simulation_update',
        data: state
      });
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
    
    res.json({ success: true, message: 'Simulation reset' });
  } catch (error) {
    console.error('Error resetting simulation:', error);
    res.status(500).json({ error: 'Failed to reset simulation' });
  }
});

// Start HTTP server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
  console.log(`WebSocket server running on port 8080`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});

// Start simulation
simulation.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  simulation.stop();
  wss.close();
  process.exit(0);
});

console.log('AUV Simulator Server Started');
console.log('- HTTP API: http://localhost:3001');
console.log('- WebSocket: ws://localhost:8080');
console.log('- Simulation running with', simulation.auvs.length, 'AUVs');