import React from 'react';
export const AccessDenied: React.FC<{ onReturn: () => void }> = ({ onReturn }) => <section className="gb-access-denied" role="alert"><h1>Access denied</h1><p>Your account does not have permission to open this page.</p><button className="gb-button gb-primary" onClick={onReturn}>Return to permitted workspace</button></section>;
