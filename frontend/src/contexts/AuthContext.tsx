import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = 'https://ev7csp39fc.execute-api.us-east-1.amazonaws.com/dev';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('AuthContext: Checking for existing token on mount');
    const token = localStorage.getItem('authToken');
    console.log('AuthContext: Found token:', !!token);
    
    if (token) {
      const userData = localStorage.getItem('userData');
      console.log('AuthContext: Found userData:', !!userData);
      
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          console.log('AuthContext: Setting user from localStorage:', parsedUser);
          setUser(parsedUser);
        } catch (e) {
          console.error('AuthContext: Error parsing userData:', e);
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
        }
      }
    }
    setIsLoading(false);
    console.log('AuthContext: Finished initialization');
  }, []);

  useEffect(() => {
    if (user && !isLoading) {
      console.log('AuthContext: User authenticated, redirecting to dashboard');
      if (window.location.pathname === '/auth') {
        window.location.href = '/';
      }
    }
  }, [user, isLoading]);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      console.log('Login response:', data);
      
      localStorage.setItem('authToken', data.accessToken);
      
      let userData: User;
      try {
        if (data.idToken) {
          const decodedToken: any = jwtDecode(data.idToken);
          console.log('Decoded JWT token:', decodedToken);
          
          userData = {
            id: decodedToken.sub || username,
            username: decodedToken['cognito:username'] || decodedToken.username || username,
            email: decodedToken.email || '',
            firstName: decodedToken.given_name || '',
            lastName: decodedToken.family_name || '',
          };
        } else {
          userData = {
            id: username,
            username,
            email: '',
            firstName: '',
            lastName: '',
          };
        }
      } catch (error) {
        console.error('Error decoding JWT token:', error);
        userData = {
          id: username,
          username,
          email: '',
          firstName: '',
          lastName: '',
        };
      }
      
      console.log('Setting user data:', userData);
      localStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);
      
      setTimeout(() => {
        console.log('Current user state:', userData);
        console.log('isAuthenticated should be:', !!userData);
        console.log('Current pathname:', window.location.pathname);
      }, 100);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      await login(userData.username, userData.password);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setUser(null);
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
