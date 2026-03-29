import { useState } from 'react';
import FileUpload from '../components/FileUpload';

export default function Upload() {
  const [lastResult, setLastResult] = useState(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Awards Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV export from DLA. Rows are streamed directly into PostgreSQL.
        </p>
      </div>

      {/* Expected format callout */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">Expected CSV columns</p>
        <code className="text-xs block">
          CAGE Code, Company Name, Contract Number, Award Amount, Award Date, DLA Office, Description
        </code>
        <p className="mt-2 text-xs text-amber-700">
          Column names are flexible — the backend also accepts snake_case variants.
          Rows without a CAGE Code will be skipped.
        </p>
      </div>

      <FileUpload onUploadSuccess={(result) => setLastResult(result)} />

      {lastResult && (
        <div className="text-xs text-gray-400">
          Last upload: {lastResult.inserted?.toLocaleString()} rows inserted at{' '}
          {new Date().toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
