import { useEffect, useState } from 'react';
import { Sun } from 'lucide-react';

export default function App() {
  // 1. A piece of state: what the page currently shows about the API
  const [status, setStatus] = useState('checking...');

  // 2. Runs once when the page first loads
  useEffect(() => {
    fetch('/api/health')               // ask the backend (goes through the proxy)
      .then((res) => res.json())       // read the JSON answer
      .then((data) => setStatus(data.status || data.error))  // show "ok"
      .catch(() => setStatus('API not reachable')); // backend down or proxy wrong
  }, []);

  // 3. What appears on screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="rounded-xl bg-white p-8 shadow">
        <div className="flex items-center gap-2">
          <Sun className="text-amber-500" />
          <h1 className="text-2xl font-bold text-slate-800">TerraVolt</h1>
        </div>
        <p className="mt-2 text-slate-600">
          API: <span className={status === 'ok' ? 'text-green-600' : 'text-red-600'}>{status}</span>
        </p>
      </div>
    </div>
  );
}