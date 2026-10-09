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

export interface IForgotPasswordSendOtpResponse {
  success: boolean
  message: string
}

export interface IForgotPasswordVerifyOtpResponse {
  success: boolean
  message: string
}

export interface IForgotPasswordResetResponse {
  success: boolean
  message: string
}