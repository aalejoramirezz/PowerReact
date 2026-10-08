import 'react';

/**
 * React 18 does not know the `inert` attribute (React 19 does, as a boolean). Unknown lowercase
 * attributes are passed through to the DOM, so `inert=""` works; this teaches the types about it.
 * Spread it conditionally: `{...(closed ? { inert: '' } : {})}` (an absent attribute = not inert).
 */
declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: '' | undefined;
  }
}
