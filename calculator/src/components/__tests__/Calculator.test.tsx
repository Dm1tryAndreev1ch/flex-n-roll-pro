import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Calculator } from '../Calculator';

describe('Calculator Component', () => {
  it('renders successfully', () => {
    const { container } = render(<Calculator />);
    expect(container).toBeTruthy();
  });
});
