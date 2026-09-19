import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('shows both plans and a verdict for the default inputs', () => {
  render(<App />);
  expect(screen.getByText(/Pay it off in 5 years/i)).toBeInTheDocument();
  expect(screen.getByText(/Stretch to 10 years and invest/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Plan B puts you about/i })).toBeInTheDocument();
});
