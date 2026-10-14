import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/auth-context';

import { App } from './app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>,
    );
    expect(baseElement).toBeTruthy();
  });

  it('should redirect to login page when not authenticated', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>,
    );
    expect(screen.getByText('Log in')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your loan portal account.')).toBeInTheDocument();
  });
});
