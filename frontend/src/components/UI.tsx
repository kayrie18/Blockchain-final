import React from 'react';
import { cn } from '../lib/utils';

type BadgeProps = React.PropsWithChildren<{
  variant?: 'success' | 'warning' | 'error' | 'info' | 'brand';
  className?: string;
}>;


export const Badge: React.FC<BadgeProps> = ({ children, variant = 'info', className }) => {
  const variants: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    error: 'bg-rose-100 text-rose-700 border-rose-200',
    info: 'bg-brand-100 text-brand-700 border-brand-200',
    brand: 'bg-brand-100 text-brand-700 border-brand-200',
  };
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border inline-flex items-center", variants[variant], className)}>
      {children}
    </span>
  );
};

type CardProps = React.PropsWithChildren<{ className?: string, title?: string, subtitle?: string }>;
export const Card: React.FC<CardProps> = ({ children, className, title, subtitle }) => (
  <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", className)}>
    {(title || subtitle) && (
      <div className="px-6 py-4 border-b border-slate-100">
        {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export const Button = ({ children, variant = 'primary', className, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'brand' }) => {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-100 disabled:bg-slate-300',
    secondary: 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-600',
    outline: 'border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    brand: 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-100 disabled:bg-slate-300',
  };
  return (
    <button 
      className={cn("px-4 py-2 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:pointer-events-none", variants[variant], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
