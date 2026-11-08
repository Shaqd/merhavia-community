import { AppHeader } from '@merhavia/ui';
import { useEffect, useState } from 'react';

type Health = { app: string; tables: { hub_users: number; bbq_events: number } };

export function App() {
  const [health, setHealth] = useState<Health | 'error' | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? (res.json() as Promise<Health>) : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(setHealth, () => setHealth('error'));
  }, []);

  return (
    <>
      <AppHeader title="על האש" />
      <main className="mx-auto max-w-xl p-4">
        <p>האתר בבנייה.</p>
        <p className="mt-2 text-sm text-stone-500">{statusText(health)}</p>
      </main>
    </>
  );
}

function statusText(health: Health | 'error' | null): string {
  if (health === null) return 'בודק חיבור למסד הנתונים…';
  if (health === 'error') return 'אין חיבור למסד הנתונים.';
  return `מחובר למסד הנתונים · ${health.tables.bbq_events} אירועים · ${health.tables.hub_users} משתמשים`;
}
