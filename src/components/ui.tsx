import { Component, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

export function Btn({ variant = 'secondary', big, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  return <button type="button" className={['btn', `btn-${variant}`, big ? 'btn-big' : '', className ?? ''].join(' ')} {...rest} />;
}

export function Choice({ selected, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button type="button" className={'choice' + (selected ? ' choice-on' : '')} aria-pressed={selected} {...rest}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean; testId?: string }) {
  return (
    <label className={'toggle' + (disabled ? ' toggle-disabled' : '')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Notice({ kind = 'info', children, role }: { kind?: 'info' | 'warn' | 'safety'; children: ReactNode; role?: string }) {
  return (
    <div className={`notice notice-${kind}`} role={role}>
      {children}
    </div>
  );
}

export function Page({ title, children, onBack, backLabel = 'חזרה למסך הראשי' }: { title: string; children: ReactNode; onBack?: () => void; backLabel?: string }) {
  return (
    <main className="page" id="main">
      <header className="page-head">
        <h1 tabIndex={-1}>{title}</h1>
        {onBack && (
          <Btn variant="quiet" onClick={onBack}>
            {backLabel}
          </Btn>
        )}
      </header>
      {children}
    </main>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <main className="page" role="alert">
          <h1>משהו השתבש</h1>
          <p>אירעה תקלה במסך. הנתונים שכבר נשמרו נשארים במכשיר.</p>
          <Btn variant="primary" big onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>
            טעינה מחדש
          </Btn>
        </main>
      );
    }
    return this.props.children;
  }
}
