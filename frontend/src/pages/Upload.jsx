import { useState } from 'react';
import FileUpload from '../components/FileUpload';

export default function Upload() {
  const [lastResult, setLastResult] = useState(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Awards Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a DLA awards CSV. The backend loads the raw rows, vendor dimension, and award fact table in one pass.
        </p>
      </div>

      {/* Expected format callout */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">Expected CSV columns</p>
        <code className="text-xs block">
          FPDS / DLA award export columns, including vendor, award, agency, NAICS, and place-of-performance fields
        </code>
        <p className="mt-2 text-xs text-amber-700">
          Column names are flexible. The backend maps the wide export into raw ingest rows plus canonical vendor and award tables.
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
