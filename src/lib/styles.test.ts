import { describe, expect, it } from 'vitest';
import { fadeDelay } from './styles';

describe('fadeDelay', () => {
  it('starts the first item with no delay', () => {
    expect(fadeDelay(0)).toBe('animation-delay: 0ms');
  });

  it('steps each item by the given amount', () => {
    expect(fadeDelay(3)).toBe('animation-delay: 150ms');
    expect(fadeDelay(2, 80)).toBe('animation-delay: 160ms');
  });

  it('caps long lists', () => {
    expect(fadeDelay(100)).toBe('animation-delay: 600ms');
    expect(fadeDelay(10, 100, 400)).toBe('animation-delay: 400ms');
  });

  it('treats negative or fractional positions safely', () => {
    expect(fadeDelay(-2)).toBe('animation-delay: 0ms');
    expect(fadeDelay(1.7)).toBe('animation-delay: 50ms');
  });
});
