import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { useEdition } from '../context/EditionContext.jsx';
import { uploadNewspaperPdf } from '../services/api.js';
import { formatBackendEdition } from '../utils/editionAdapter.js';

export default function PDFUploaderModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { addAvailableEdition } = useEdition();

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle', 'uploading', 'success', 'error'
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusText, setStatusText] = useState('Uploading broadsheet PDF...');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSelect(file);
  };

  const validateAndSelect = (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadStatus('error');
      setErrorMessage('Unsupported file format. Please upload a standard PDF broadsheet file.');
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setUploadStatus('error');
      setErrorMessage('The selected file is empty (0 bytes). Please select a valid PDF.');
      setSelectedFile(null);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadStatus('error');
      setErrorMessage('File size exceeds the 50 MB limit. Please select a smaller broadsheet PDF.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadStatus('idle');
    setErrorMessage('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    validateAndSelect(file);
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setProgress(15);
    setStatusText('Uploading broadsheet PDF...');
    setErrorMessage('');

    // Advance progress smoothly while backend processes OCR & article extraction
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 80) return prev + 5;
        if (prev >= 80 && prev < 95) {
          setStatusText('Extracting articles and editorial desks...');
          return prev + 2;
        }
        return prev;
      });
    }, 250);

    try {
      const response = await uploadNewspaperPdf(selectedFile, (uploadPct) => {
        if (uploadPct < 75) {
          setProgress(uploadPct);
        }
      });

      clearInterval(timer);

      if (response.ok && response.data?.status === 'success' && response.data?.data) {
        setProgress(100);
        setStatusText('Broadsheet successfully processed!');
        setUploadStatus('success');

        const formattedEdition = formatBackendEdition(response.data.data);
        if (typeof addAvailableEdition === 'function') {
          addAvailableEdition(formattedEdition, 'pdf_upload');
        }

        setTimeout(() => {
          onClose();
          navigate('/edition');
        }, 1200);
      } else {
        setUploadStatus('error');
        setErrorMessage(
          response.data?.message ||
            response.error ||
            'Unable to process newspaper PDF. Please ensure the file is an accessible broadsheet.'
        );
      }
    } catch (err) {
      clearInterval(timer);
      setUploadStatus('error');
      setErrorMessage(
        err.message || 'An unexpected error occurred while uploading the broadsheet.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1c1917]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#fbf9f5] w-full max-w-md rounded-2xl shadow-2xl border border-[#eae4d9] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#eae4d9] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#f3ece2] rounded-lg text-[#9a3412]">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-[#1c1917] text-base">Upload Newspaper PDF</h3>
              <p className="text-[11px] font-mono text-[#78716c]">Import physical issue for audio narration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#78716c] hover:text-[#1c1917] rounded-full hover:bg-[#f3ece2] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        <div className="p-6">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              selectedFile
                ? 'border-[#9a3412] bg-[#fffaf5]'
                : 'border-[#eae4d9] bg-white hover:border-[#9a3412]/50 hover:bg-[#f3ece2]/30'
            }`}
          >
            {selectedFile ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-[#fbeee6] text-[#9a3412] flex items-center justify-center mb-2">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-serif font-semibold text-sm text-[#1c1917] max-w-[280px] truncate">
                  {selectedFile.name}
                </h4>
                <p className="text-[11px] font-mono text-[#78716c] mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to process
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-[#f3ece2] text-[#78716c] flex items-center justify-center mb-2">
                  <FileUp className="w-6 h-6" />
                </div>
                <p className="text-xs font-serif font-medium text-[#1c1917]">
                  Drag & drop newspaper PDF here
                </p>
                <p className="text-[11px] text-[#78716c] mt-1 font-mono">
                  Standard multi-page broadsheet editions (.pdf)
                </p>
                <label className="mt-4 px-4 py-2 bg-[#1c1917] hover:bg-[#292524] text-white text-xs font-medium rounded-lg cursor-pointer transition-colors shadow-xs">
                  <span>Browse Device Files</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Error Message */}
          {uploadStatus === 'error' && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Uploading Progress */}
          {uploadStatus === 'uploading' && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs font-mono text-[#78716c]">
                <span className="flex items-center space-x-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9a3412]" />
                  <span>{statusText || 'Extracting broadsheet articles...'}</span>
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-[#eae4d9] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#9a3412] h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Message */}
          {uploadStatus === 'success' && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-medium">File accepted! Opening edition view...</span>
            </div>
          )}

          {/* Pipeline Note */}
          <div className="mt-4 p-3 bg-[#f3ece2]/60 rounded-xl text-[11px] text-[#78716c] font-mono leading-relaxed border border-[#eae4d9]">
            Broadsheet extraction parses layout columns, identifies articles across the 6 editorial desks, and unlocks the audio narration chapters.
          </div>

          {/* Upload Action Button */}
          {selectedFile && uploadStatus !== 'uploading' && uploadStatus !== 'success' && (
            <div className="mt-5 flex space-x-2">
              <button
                onClick={() => setSelectedFile(null)}
                className="flex-1 py-2 px-3 border border-[#eae4d9] rounded-lg text-xs font-medium text-[#78716c] hover:bg-[#f3ece2] transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={handleStartUpload}
                className="flex-1 py-2 px-3 bg-[#9a3412] hover:bg-[#7c2d12] text-white rounded-lg text-xs font-semibold shadow transition-colors"
              >
                Upload & Process
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
