import React, { useState, useEffect } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setError(event.error);
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      setError(event.reason);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  if (error) {
    let message = "Something went wrong.";
    
    try {
      if (error?.message) {
        const parsed = JSON.parse(error.message);
        if (parsed.error && parsed.operationType) {
          message = `Firestore Error (${parsed.operationType}): ${parsed.error}`;
        }
      }
    } catch (e) {
      message = error?.message || message;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="bg-surface border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Application Error</h2>
          <p className="text-muted mb-6">{message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-accent text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ErrorBoundary;
