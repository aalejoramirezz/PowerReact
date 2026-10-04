import type React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { errorMessage } from '../../api/http';

export const LoadingNote: React.FC<{ label?: string }> = ({ label = 'Executing VertiPaq DAX query...' }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
    <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
    <span>{label}</span>
  </div>
);

export const ErrorNote: React.FC<{ error: unknown }> = ({ error }) => (
  <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
    <span>{errorMessage(error)}</span>
  </div>
);

export const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="py-10 text-center text-xs text-slate-400">{children}</div>
);
