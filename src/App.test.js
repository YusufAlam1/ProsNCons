import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the pros and cons board', () => {
  render(<App />);
  expect(screen.getByText('PROS')).toBeInTheDocument();
  expect(screen.getByText('CONS')).toBeInTheDocument();
  // default example decision
  expect(screen.getByText('Homework will be done')).toBeInTheDocument();
});
