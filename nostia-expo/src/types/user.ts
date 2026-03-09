export interface User {
  _id: string;
  name: string;
  username: string;
  email?: string;
  homeStatus?: 'open' | 'closed';
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}
