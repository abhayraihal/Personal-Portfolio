import { Component } from 'react';
import type { ReactNode } from 'react';

// Keeps one broken zone from taking the whole scene down.
export class ErrorBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(`[${this.props.name}] failed to render`, error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
