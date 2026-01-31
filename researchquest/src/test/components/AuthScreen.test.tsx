import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AuthScreen } from '../../App'
import { mockSupabaseClient } from '../mocks/supabase'

describe('AuthScreen Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does NOT show "Use Test Login" button when env vars are missing', () => {
    // Ensure env vars are not set
    vi.stubEnv('VITE_TEST_EMAIL', '')
    vi.stubEnv('VITE_TEST_PASSWORD', '')

    render(<AuthScreen />)

    expect(screen.queryByText(/Use Test Login/i)).not.toBeInTheDocument()
  })

  it('shows "Use Test Login" button when env vars are present', () => {
    vi.stubEnv('VITE_TEST_EMAIL', 'test@example.com')
    vi.stubEnv('VITE_TEST_PASSWORD', 'password123')

    render(<AuthScreen />)

    expect(screen.getByText(/Use Test Login/i)).toBeInTheDocument()
  })

  it('uses configured credentials when test login is clicked', async () => {
    const testEmail = 'test@example.com'
    const testPassword = 'password123'

    vi.stubEnv('VITE_TEST_EMAIL', testEmail)
    vi.stubEnv('VITE_TEST_PASSWORD', testPassword)

    render(<AuthScreen />)

    const button = screen.getByText(/Use Test Login/i)
    fireEvent.click(button)

    await waitFor(() => {
        expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
            email: testEmail,
            password: testPassword
        })
    })
  })
})
