import React from 'react';
import { ArrowLeft } from 'lucide-react';

/** Use browser history so Back also works with the existing hash-based routes. */
export const BackButton: React.FC = () => (
  <button
    type="button"
    className="gb-button gb-back-button"
    aria-label="Go back to the previous page"
    disabled={!window.history.length || window.history.length <= 1}
    onClick={() => window.history.back()}
  >
    <ArrowLeft size={15} /> Back
  </button>
);
