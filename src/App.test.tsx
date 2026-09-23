import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './test/renderApp.tsx'

describe('app shell', () => {
  it('opens on the Today tab', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('shows the four main tabs', async () => {
    renderApp('/')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    for (const name of ['Today', 'Routines', 'History', 'Progress']) {
      expect(nav).toContainElement(screen.getByRole('link', { name }))
    }
  })

  it('switches tabs and marks the current one', async () => {
    renderApp('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Progress' }))
    expect(screen.getByRole('heading', { name: 'Progress' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens settings from Today and goes back', async () => {
    renderApp('/today')
    await userEvent.click(await screen.findByRole('link', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('redirects unknown addresses to Today', async () => {
    renderApp('/does-not-exist')
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })
})
