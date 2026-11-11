import { createHashRouter, Navigate } from 'react-router';
import App from './App.jsx';
import { FleetOverview } from './components/FleetOverview.jsx';
import { RobotDetail } from './components/RobotDetail.jsx';
import { paths } from './paths.js';

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <FleetOverview /> },
      { path: 'robot/:robotId', element: <RobotDetail /> },
      { path: '*', element: <Navigate to={paths.home()} replace /> },
    ],
  },
]);
