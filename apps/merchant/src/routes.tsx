import type { RouteObject } from 'react-router';
import { GuestOnly, RequireAuth } from './auth';
import { Layout } from './components/Layout';
import { EditListingPage } from './pages/EditListingPage';
import { LoginPage } from './pages/LoginPage';
import { MyListingsPage } from './pages/MyListingsPage';
import { NewListingPage } from './pages/NewListingPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <MyListingsPage /> },
          { path: 'listings/new', element: <NewListingPage /> },
          { path: 'listings/:id/edit', element: <EditListingPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
