class Auv {
  constructor(id, x, y, heading = 0, speed = 1) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.heading = heading; // in radians
    this.speed = speed; // units per second
    this.waypoints = [];
    this.collisionsAvoided = 0;
    this.waypointsCompleted = 0;
    this.lastWaypointTime = Date.now();
    this.currentWaypointIndex = 0;
    this.safeDistance = 5; // minimum distance to other AUVs
  }

  // Add a waypoint to the mission
  addWaypoint(x, y) {
    this.waypoints.push({ x, y });
  }

  // Set multiple waypoints (for polygon missions)
  setWaypoints(waypoints) {
    this.waypoints = waypoints.map(wp => ({ x: wp.x || wp[0], y: wp.y || wp[1] }));
    this.currentWaypointIndex = 0;
  }

  // Get current target waypoint
  getCurrentWaypoint() {
    if (this.currentWaypointIndex < this.waypoints.length) {
      return this.waypoints[this.currentWaypointIndex];
    }
    return null;
  }

  // Calculate desired heading to current waypoint
  calculateDesiredHeading() {
    const waypoint = this.getCurrentWaypoint();
    if (!waypoint) return this.heading;

    const dx = waypoint.x - this.x;
    const dy = waypoint.y - this.y;
    return Math.atan2(dy, dx);
  }

  // Check if we've reached the current waypoint
  hasReachedCurrentWaypoint() {
    const waypoint = this.getCurrentWaypoint();
    if (!waypoint) return false;

    const distance = this.distanceTo(waypoint.x, waypoint.y);
    return distance < 2; // within 2 units of waypoint
  }

  // Move to next waypoint
  advanceToNextWaypoint() {
    this.currentWaypointIndex++;
    this.waypointsCompleted++;
    this.lastWaypointTime = Date.now();
  }

  // Calculate distance to another point or AUV
  distanceTo(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Check if another AUV is too close
  isTooClose(otherAuv) {
    return this.distanceTo(otherAuv.x, otherAuv.y) < this.safeDistance;
  }

  // Calculate avoidance heading when collision detected
  calculateAvoidanceHeading(otherAuv) {
    // Calculate vector from other AUV to this AUV
    const dx = this.x - otherAuv.x;
    const dy = this.y - otherAuv.y;
    const avoidanceAngle = Math.atan2(dy, dx);
    
    // Add some randomness to prevent deadlocks
    const randomOffset = (Math.random() - 0.5) * 0.5; // ±0.25 radians
    return avoidanceAngle + randomOffset;
  }

  // Update position based on current heading and speed
  updatePosition(deltaTime, otherAuvs = []) {
    // Check for waypoint completion
    if (this.hasReachedCurrentWaypoint()) {
      this.advanceToNextWaypoint();
    }

    // Calculate desired heading toward waypoint
    let desiredHeading = this.calculateDesiredHeading();

    // Check for collision avoidance
    let needsAvoidance = false;
    for (const other of otherAuvs) {
      if (other.id !== this.id && this.isTooClose(other)) {
        desiredHeading = this.calculateAvoidanceHeading(other);
        this.collisionsAvoided++;
        needsAvoidance = true;
        break; // Handle one collision at a time
      }
    }

    // Smoothly adjust heading (don't turn instantly)
    const maxTurnRate = 2.0; // radians per second
    const headingDiff = this.normalizeAngle(desiredHeading - this.heading);
    const maxTurn = maxTurnRate * deltaTime;
    
    if (Math.abs(headingDiff) > maxTurn) {
      this.heading += Math.sign(headingDiff) * maxTurn;
    } else {
      this.heading = desiredHeading;
    }

    this.heading = this.normalizeAngle(this.heading);

    // Reduce speed when avoiding collisions
    const currentSpeed = needsAvoidance ? this.speed * 0.5 : this.speed;

    // Update position
    this.x += Math.cos(this.heading) * currentSpeed * deltaTime;
    this.y += Math.sin(this.heading) * currentSpeed * deltaTime;
  }

  // Normalize angle to [-π, π]
  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  // Get public state for broadcasting
  getState() {
    return {
      id: this.id,
      x: Math.round(this.x * 100) / 100, // round to 2 decimal places
      y: Math.round(this.y * 100) / 100,
      heading: Math.round(this.heading * 100) / 100,
      speed: this.speed,
      currentWaypoint: this.getCurrentWaypoint(),
      waypointsCompleted: this.waypointsCompleted,
      collisionsAvoided: this.collisionsAvoided,
      hasActiveWaypoint: this.getCurrentWaypoint() !== null
    };
  }
}

module.exports = Auv;