import { useState, useRef } from 'react';
import { uploadCSV } from '../services/api';

const ACCEPTED_TYPES = '.csv,text/csv';

/**
 * FileUpload
 *
 * Handles CSV selection, shows a progress bar during upload,
 * and displays a summary of inserted / skipped rows on completion.
 *
 * Props:
 *   onUploadSuccess {function} - called with the server response after success
 */
export default function FileUpload({ onUploadSuccess }) {
  const [file,         setFile]         = useState(null);
  const [progress,     setProgress]     = useState(0);
  const [status,       setStatus]       = useState('idle'); // idle | uploading | success | error
  const [result,       setResult]       = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging,   setIsDragging]   = useState(false);
  const inputRef = useRef(null);

  function handleFileSelect(selected) {
    if (!selected) return;
    if (!selected.name.endsWith('.csv')) {
      setErrorMessage('Only CSV files are accepted.');
      setStatus('error');
      return;
    }
    setFile(selected);
    setStatus('idle');
    setErrorMessage('');
    setResult(null);
    setProgress(0);
  }

  function handleInputChange(e) {
    handleFileSelect(e.target.files[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading');
    setProgress(0);
    setErrorMessage('');
    setResult(null);

    try {
      const data = await uploadCSV(file, (pct) => setProgress(pct));
      setResult(data);
      setStatus('success');
      setProgress(100);
      if (onUploadSuccess) onUploadSuccess(data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed.';
      setErrorMessage(msg);
      setStatus('error');
    }
  }

  function handleReset() {
    setFile(null);
    setProgress(0);
    setStatus('idle');
    setResult(null);
    setErrorMessage('');
    if (inputRef.current) inputRef.current.value = '';
  }

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-xl border-2 border-dashed p-10 cursor-pointer
          transition-colors select-none
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
        `}
      >
        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-gray-700">
          {file ? file.name : 'Drag & drop a CSV file, or click to browse'}
        </p>
        {file && (
          <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleInputChange}
          className="sr-only"
        />
      </div>

      {/* Progress bar */}
      {status === 'uploading' && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">
            Please wait — large files may take several minutes to process on the server.
          </p>
        </div>
      )}

      {/* Success summary */}
      {status === 'success' && result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold mb-2">Upload complete</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Total rows processed: <strong>{result.total?.toLocaleString()}</strong></li>
            <li>Inserted: <strong>{result.inserted?.toLocaleString()}</strong></li>
            <li>Skipped / errors: <strong>{result.skipped?.toLocaleString()}</strong></li>
          </ul>
          {result.errors?.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-green-700">
                Show first {result.errors.length} error(s)
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">
                    Row {i + 1}: {e.reason}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Error message */}
      {status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || status === 'uploading'}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white
                     hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'uploading' ? 'Uploading…' : 'Upload'}
        </button>
        {(file || status !== 'idle') && (
          <button
            onClick={handleReset}
            disabled={status === 'uploading'}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700
                       hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
