const Auv = require('./Auv');

class SimulationManager {
  constructor(numAuvs = 20) {
    this.auvs = [];
    this.missions = [];
    this.lastUpdateTime = Date.now();
    this.simulationStartTime = Date.now();
    this.broadcastCallback = null;
    this.updateInterval = 200; // ms
    this.simulationBounds = { minX: -50, maxX: 50, minY: -50, maxY: 50 };

    // Initialize AUVs with random positions
    for (let i = 0; i < numAuvs; i++) {
      const x = (Math.random() - 0.5) * 80; // -40 to 40
      const y = (Math.random() - 0.5) * 80; // -40 to 40
      const heading = Math.random() * 2 * Math.PI;
      const speed = 2 + Math.random() * 2; // 2-4 units/second
      
      const auv = new Auv(`auv-${i}`, x, y, heading, speed);
      
      // Give some AUVs initial random waypoints
      if (Math.random() > 0.5) {
        const numWaypoints = Math.floor(Math.random() * 3) + 2; // 2-4 waypoints
        for (let j = 0; j < numWaypoints; j++) {
          const wpX = (Math.random() - 0.5) * 80;
          const wpY = (Math.random() - 0.5) * 80;
          auv.addWaypoint(wpX, wpY);
        }
      }
      
      this.auvs.push(auv);
    }

    console.log(`Initialized ${numAuvs} AUVs`);
  }

  // Set callback for broadcasting updates
  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  // Start the simulation loop
  start() {
    console.log('Starting simulation...');
    this.simulationLoop = setInterval(() => {
      this.update();
    }, this.updateInterval);
  }

  // Stop the simulation
  stop() {
    if (this.simulationLoop) {
      clearInterval(this.simulationLoop);
      console.log('Simulation stopped');
    }
  }

  // Main update function
  update() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // convert to seconds
    
    // Update all AUVs
    this.auvs.forEach(auv => {
      auv.updatePosition(deltaTime, this.auvs);
      this.keepInBounds(auv);
    });

    this.lastUpdateTime = currentTime;

    // Broadcast state if callback is set
    if (this.broadcastCallback) {
      this.broadcastCallback(this.getState());
    }
  }

  // Keep AUVs within simulation bounds
  keepInBounds(auv) {
    const bounds = this.simulationBounds;
    const margin = 5;

    if (auv.x < bounds.minX + margin || auv.x > bounds.maxX - margin ||
        auv.y < bounds.minY + margin || auv.y > bounds.maxY - margin) {
      
      // Turn toward center
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      auv.heading = Math.atan2(centerY - auv.y, centerX - auv.x);
    }
  }

  // Create a new mission (polygon of waypoints)
  createMission(polygon) {
    const mission = {
      id: `mission-${Date.now()}`,
      polygon: polygon,
      createdAt: Date.now(),
      assignedAuvs: []
    };

    this.missions.push(mission);

    // Assign to available AUVs (those without current waypoints)
    const availableAuvs = this.auvs.filter(auv => !auv.getCurrentWaypoint());
    const numToAssign = Math.min(availableAuvs.length, Math.max(1, Math.floor(polygon.length / 2)));

    for (let i = 0; i < numToAssign; i++) {
      const auv = availableAuvs[i];
      auv.setWaypoints(polygon);
      mission.assignedAuvs.push(auv.id);
    }

    console.log(`Created mission ${mission.id}, assigned to ${numToAssign} AUVs`);
    return mission;
  }

  // Assign waypoint to specific AUV
  assignWaypointToAuv(auvId, waypoint) {
    const auv = this.auvs.find(a => a.id === auvId);
    if (auv) {
      auv.addWaypoint(waypoint.x, waypoint.y);
      return true;
    }
    return false;
  }

  // Get current simulation state
  getState() {
    return {
      timestamp: Date.now(),
      simulationTime: Date.now() - this.simulationStartTime,
      auv_states: this.auvs.map(auv => auv.getState()),
      missions: this.missions.map(m => ({
        id: m.id,
        polygon: m.polygon,
        assignedAuvs: m.assignedAuvs
      }))
    };
  }

  // Get analytics data
  getAnalytics() {
    const totalCollisions = this.auvs.reduce((sum, auv) => sum + auv.collisionsAvoided, 0);
    const totalWaypoints = this.auvs.reduce((sum, auv) => sum + auv.waypointsCompleted, 0);
    const auvs_reached_goal = this.auvs.filter(auv => auv.waypoints.length > 0 && !auv.getCurrentWaypoint()).length;
    const activeAuvs = this.auvs.filter(auv => auv.getCurrentWaypoint() !== null).length;

    // Calculate average time per waypoint (rough estimate)
    const avgTimePerWaypoint = totalWaypoints > 0 ? 
      (Date.now() - this.simulationStartTime) / totalWaypoints / 1000 : 0;

    return {
      total_collisions_avoided: totalCollisions,
      total_waypoints_completed: totalWaypoints,
      auvs_reached_goal: auvs_reached_goal,
      active_auvs: activeAuvs,
      total_auvs: this.auvs.length,
      average_time_per_waypoint: Math.round(avgTimePerWaypoint * 10) / 10,
      simulation_uptime: Math.round((Date.now() - this.simulationStartTime) / 1000),
      active_missions: this.missions.length
    };
  }

  // Get specific AUV
  getAuv(id) {
    return this.auvs.find(auv => auv.id === id);
  }

  // Reset simulation
  reset() {
    this.stop();
    this.auvs = [];
    this.missions = [];
    this.simulationStartTime = Date.now();
    this.lastUpdateTime = Date.now();
  }
}

module.exports = SimulationManager;