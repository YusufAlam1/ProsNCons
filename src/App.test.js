import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the empty pros and cons board', () => {
  render(<App />);
  expect(screen.getByText('PROS')).toBeInTheDocument();
  expect(screen.getByText('CONS')).toBeInTheDocument();
  // no hardcoded example decision — starts blank
  expect(screen.getByText('I am deciding')).toBeInTheDocument();
  expect(screen.getByText('AWAITS')).toBeInTheDocument();
});
