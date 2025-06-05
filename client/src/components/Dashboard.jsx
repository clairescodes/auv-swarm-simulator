import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const StatCard = ({ title, value, subtitle, color = '#4ecdc4' }) => (
  <div className="stat-card">
    <div className="stat-header" style={{ borderLeftColor: color }}>
      <h3>{title}</h3>
    </div>
    <div className="stat-value">
      {value}
    </div>
    {subtitle && <div className="stat-subtitle">{subtitle}</div>}
  </div>
);

const Dashboard = ({ analytics }) => {
  const [chartData, setChartData] = useState({
    collisions: [],
    waypoints: [],
    timestamps: []
  });

  // Update chart data when analytics change
  useEffect(() => {
    const now = new Date().toLocaleTimeString();
    
    setChartData(prev => {
      const newData = {
        collisions: [...prev.collisions, analytics.total_collisions_avoided],
        waypoints: [...prev.waypoints, analytics.total_waypoints_completed],
        timestamps: [...prev.timestamps, now]
      };

      // Keep only last 20 data points
      if (newData.timestamps.length > 20) {
        newData.collisions.shift();
        newData.waypoints.shift();
        newData.timestamps.shift();
      }

      return newData;
    });
  }, [analytics]);

  const lineChartData = {
    labels: chartData.timestamps,
    datasets: [
      {
        label: 'Collisions Avoided',
        data: chartData.collisions,
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Waypoints Completed',
        data: chartData.waypoints,
        borderColor: '#4ecdc4',
        backgroundColor: 'rgba(78, 205, 196, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Performance Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const barChartData = {
    labels: ['Active', 'Completed Goals', 'Total'],
    datasets: [
      {
        label: 'AUVs',
        data: [
          analytics.active_auvs,
          analytics.auvs_reached_goal,
          analytics.total_auvs,
        ],
        backgroundColor: [
          'rgba(255, 107, 107, 0.8)',
          'rgba(78, 205, 196, 0.8)',
          'rgba(116, 192, 252, 0.8)',
        ],
        borderColor: [
          'rgba(255, 107, 107, 1)',
          'rgba(78, 205, 196, 1)',
          'rgba(116, 192, 252, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'AUV Status Distribution',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className="dashboard">
      <h2>Mission Analytics</h2>
      
      {/* Key Statistics */}
      <div className="stats-grid">
        <StatCard
          title="Total AUVs"
          value={analytics.total_auvs}
          subtitle={`${analytics.active_auvs} active`}
          color="#4ecdc4"
        />
        <StatCard
          title="Collisions Avoided"
          value={analytics.total_collisions_avoided}
          subtitle="Safety incidents prevented"
          color="#ff6b6b"
        />
        <StatCard
          title="Waypoints Completed"
          value={analytics.total_waypoints_completed}
          subtitle={`Avg: ${analytics.average_time_per_waypoint}s each`}
          color="#ffd93d"
        />
        <StatCard
          title="Goals Reached"
          value={analytics.auvs_reached_goal}
          subtitle={`${((analytics.auvs_reached_goal / analytics.total_auvs) * 100).toFixed(1)}% success rate`}
          color="#6bcf7f"
        />
        <StatCard
          title="Active Missions"
          value={analytics.active_missions}
          subtitle="Currently running"
          color="#a8e6cf"
        />
        <StatCard
          title="Simulation Uptime"
          value={formatUptime(analytics.simulation_uptime)}
          subtitle="Running time"
          color="#74c0fc"
        />
      </div>

      {/* Charts */}
      <div className="charts-container">
        <div className="chart-panel">
          <div className="chart-wrapper">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>
        
        <div className="chart-panel">
          <div className="chart-wrapper">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="detailed-stats">
        <h3>Performance Metrics</h3>
        <div className="metrics-grid">
          <div className="metric">
            <span className="metric-label">Efficiency Rate:</span>
            <span className="metric-value">
              {analytics.total_waypoints_completed > 0 
                ? ((analytics.total_waypoints_completed / (analytics.total_waypoints_completed + analytics.total_collisions_avoided)) * 100).toFixed(1)
                : 0}%
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Average Speed:</span>
            <span className="metric-value">
              {analytics.average_time_per_waypoint > 0 
                ? (10 / analytics.average_time_per_waypoint).toFixed(1) 
                : 0} units/s
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Active Ratio:</span>
            <span className="metric-value">
              {((analytics.active_auvs / analytics.total_auvs) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;