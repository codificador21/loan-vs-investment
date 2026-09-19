import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeAll(() => {
  (global as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

test('shows the comparison and a verdict for the default inputs', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: /Loan vs Investment Calculator/i })).toBeInTheDocument();
  expect(screen.getByText(/Repay in 5 years/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /puts you .* ahead/i })).toBeInTheDocument();
});
