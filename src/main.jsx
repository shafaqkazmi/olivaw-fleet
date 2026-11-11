import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { createFleetApi } from './api/fleetApi.js';
import { FleetApiProvider } from './api/FleetApiContext.jsx';
import { router } from './routes.jsx';
import './styles.css';

// Started outside React so StrictMode's double effects cannot start it twice.
const api = createFleetApi();
api.start();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FleetApiProvider api={api}>
      <RouterProvider router={router} />
    </FleetApiProvider>
  </React.StrictMode>,
);
