export interface IUser {
  _id: string
  email: string
  name: string
  role?: string
  creditBalance?: number
}

export interface ILoginCredentials {
  email: string
  password: string
}

export interface IRegisterData {
  email: string
  password: string
  name: string
}

// Auth response from API
export interface IAuthResponse {
  success: boolean
  token: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role?: string
  }
}