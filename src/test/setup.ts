import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

class TestResizeObserver {
  observe(): void { /* Layout is outside JSDOM's scope. */ }
  unobserve(): void { /* Layout is outside JSDOM's scope. */ }
  disconnect(): void { /* Layout is outside JSDOM's scope. */ }
}

globalThis.ResizeObserver = TestResizeObserver
