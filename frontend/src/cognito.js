import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'
import { setToken, clearAuth } from './api.js'

const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId:   import.meta.env.VITE_COGNITO_CLIENT_ID,
})

function claimsToUser(claims) {
  return {
    email:   claims.email   ?? '',
    name:    claims.name    ?? claims.email ?? '',
    sub:     claims.sub     ?? '',
    company: claims['custom:company'] ?? '',
    role:    'Investor',
  }
}

export function cognitoLogin(email, password) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email.toLowerCase(), Pool: pool })
    const auth = new AuthenticationDetails({ Username: email.toLowerCase(), Password: password })
    user.authenticateUser(auth, {
      onSuccess: session => {
        const idToken = session.getIdToken().getJwtToken()
        setToken(idToken)
        resolve({ idToken, user: claimsToUser(session.getIdToken().payload) })
      },
      onFailure: err => reject(new Error(
        err.code === 'UserNotConfirmedException' ? 'Please verify your email before signing in.'
          : err.code === 'NotAuthorizedException' ? 'Incorrect email or password.'
          : err.message || 'Sign in failed'
      )),
      newPasswordRequired: () => reject(new Error('Password reset required — contact support.')),
    })
  })
}

export function cognitoRegister(email, password, name) {
  return new Promise((resolve, reject) => {
    // Pool uses email alias — Username must NOT be email format; use a generated ID
    const username = `evh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const attrs = [
      new CognitoUserAttribute({ Name: 'email', Value: email.toLowerCase() }),
      new CognitoUserAttribute({ Name: 'name',  Value: name }),
    ]
    pool.signUp(username, password, attrs, null, (err, result) => {
      if (err) return reject(new Error(
        err.code === 'UsernameExistsException' ? 'An account with this email already exists.'
          : err.code === 'InvalidPasswordException' ? 'Password must be at least 8 characters with numbers and symbols.'
          : err.message || 'Registration failed'
      ))
      // Return username so components can pass it to cognitoConfirm
      resolve({ needsConfirmation: !result.userConfirmed, username })
    })
  })
}

export function cognitoConfirm(username, code) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: pool })
    user.confirmRegistration(code.trim(), true, (err, result) => {
      if (err) return reject(new Error(
        err.code === 'CodeMismatchException' ? 'Incorrect code — check your email and try again.'
          : err.code === 'ExpiredCodeException' ? 'Code expired — request a new one.'
          : err.message || 'Confirmation failed'
      ))
      resolve(result)
    })
  })
}

export function cognitoResendCode(username) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: pool })
    user.resendConfirmationCode((err, result) => {
      if (err) return reject(new Error(err.message || 'Failed to resend code'))
      resolve(result)
    })
  })
}

export function cognitoLogout() {
  const user = pool.getCurrentUser()
  if (user) user.signOut()
  clearAuth()
}

// Restores an existing session without re-login (replaces api.auth.me)
export function getStoredSession() {
  return new Promise((resolve, reject) => {
    const user = pool.getCurrentUser()
    if (!user) return reject(new Error('No session'))
    user.getSession((err, session) => {
      if (err || !session?.isValid()) return reject(err || new Error('Session invalid'))
      const idToken = session.getIdToken().getJwtToken()
      setToken(idToken)
      resolve(claimsToUser(session.getIdToken().payload))
    })
  })
}
