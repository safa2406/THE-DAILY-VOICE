import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  Camera,
  Upload,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  SwitchCamera,
  Loader2,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useEdition } from '../context/EditionContext';
import { identifyEditionFromQR } from '../utils/qrValidator';

export default function QRScannerModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { setSelectedEdition, addAvailableEdition } = useEdition();

  const [scanStatus, setScanStatus] = useState('idle'); // 'idle', 'initializing', 'scanning', 'verifying', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [verifiedEdition, setVerifiedEdition] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Stop scanner and release all camera hardware tracks
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Scanner stop/cleanup notice:', err);
      } finally {
        scannerRef.current = null;
      }
    }

    // Force stop any active media tracks in DOM video elements
    const container = document.getElementById('qr-camera-feed');
    if (container) {
      const videos = container.querySelectorAll('video');
      videos.forEach((video) => {
        if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
          video.srcObject.getTracks().forEach((track) => track.stop());
          video.srcObject = null;
        }
      });
    }
  }, []);

  // Process decoded QR string (shared by camera scanner & image file upload)
  const handleDecodedQR = useCallback(
    async (decodedText) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // Stop camera hardware immediately after detection
      await stopScanner();

      if (!isMountedRef.current) return;
      setScanStatus('verifying');
      setErrorMessage('');

      try {
        const result = await identifyEditionFromQR(decodedText);

        if (!isMountedRef.current) return;

        if (result.success && result.edition) {
          setScanStatus('success');
          setVerifiedEdition(result.edition);

          // Add to available editions (this also selects it and persists to backend database)
          if (typeof addAvailableEdition === 'function') {
            addAvailableEdition(result.edition, 'qr_scan');
          } else {
            setSelectedEdition(result.edition);
          }

          // Navigate smoothly after brief confirmation presentation
          setTimeout(() => {
            if (isMountedRef.current) {
              onClose();
              navigate('/edition');
            }
          }, 1100);
        } else {
          setScanStatus('error');
          setErrorMessage(
            result.error ||
              'Unable to identify newspaper edition. Please verify you scanned a supported Daily Voice publication.'
          );
          isProcessingRef.current = false;
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setScanStatus('error');
        setErrorMessage(
          err.message || 'An unexpected error occurred while verifying the newspaper edition.'
        );
        isProcessingRef.current = false;
      }
    },
    [stopScanner, setSelectedEdition, addAvailableEdition, onClose, navigate]
  );

  // Start live camera stream
  const startCamera = useCallback(
    async (cameraIdToUse = null) => {
      await stopScanner();

      if (!isMountedRef.current || !isOpen) return;

      setScanStatus('initializing');
      setErrorMessage('');
      isProcessingRef.current = false;

      // Give React one frame to ensure the DOM container #qr-camera-feed exists
      await new Promise((resolve) => setTimeout(resolve, 50));
      const container = document.getElementById('qr-camera-feed');
      if (!container || !isMountedRef.current) return;

      try {
        // Enumerate devices if not already done
        let cameras = availableCameras;
        if (!cameras || cameras.length === 0) {
          try {
            cameras = await Html5Qrcode.getCameras();
            if (isMountedRef.current) {
              setAvailableCameras(cameras || []);
            }
          } catch (cameraEnumErr) {
            console.warn('Camera enumeration error:', cameraEnumErr);
          }
        }

        const scanner = new Html5Qrcode('qr-camera-feed');
        scannerRef.current = scanner;

        // Choose camera config: prefer rear/environment camera on mobile
        let cameraConfig;
        if (cameraIdToUse) {
          cameraConfig = { deviceId: { exact: cameraIdToUse } };
        } else if (cameras && cameras.length > 0) {
          // Check for rear/back camera
          const rearCamera = cameras.find((c) =>
            /back|rear|environment/i.test(c.label || '')
          );
          const chosen = rearCamera || cameras[0];
          cameraConfig = { deviceId: { exact: chosen.id } };
          if (isMountedRef.current) {
            setSelectedCameraId(chosen.id);
          }
        } else {
          // Fallback to facingMode constraint
          cameraConfig = { facingMode: 'environment' };
        }

        const scanConfig = {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        };

        await scanner.start(
          cameraConfig,
          scanConfig,
          (decodedText) => {
            handleDecodedQR(decodedText);
          },
          () => {
            // Frame scan failure - expected while seeking QR code, ignore
          }
        );

        if (isMountedRef.current) {
          setScanStatus('scanning');
        }
      } catch (err) {
        console.error('Failed to start camera scanner:', err);
        if (!isMountedRef.current) return;

        setScanStatus('error');
        const errStr = (err?.name || '') + ' ' + (err?.message || err || '');
        if (/NotAllowedError|Permission/i.test(errStr)) {
          setErrorMessage(
            'Camera access was denied. Please allow camera permissions in your browser or use the image upload fallback below.'
          );
        } else if (/NotFoundError|DevicesNotFoundError/i.test(errStr)) {
          setErrorMessage(
            'No camera found on this device. Please use the image upload fallback below.'
          );
        } else if (/NotReadableError|TrackStartError/i.test(errStr)) {
          setErrorMessage(
            'Camera is in use by another application. Please close other camera apps or use the image upload option.'
          );
        } else {
          setErrorMessage(
            'Could not initialize camera scanner. Please check device permissions or upload a QR image.'
          );
        }
      }
    },
    [stopScanner, isOpen, availableCameras, handleDecodedQR]
  );

  // Manage modal open/close lifecycle
  useEffect(() => {
    isMountedRef.current = true;

    if (isOpen) {
      setVerifiedEdition(null);
      isProcessingRef.current = false;
      startCamera();
    } else {
      stopScanner();
    }

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [isOpen, startCamera, stopScanner]);

  // Handle camera selection change
  const handleCameraChange = (e) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    startCamera(newId);
  };

  // Image upload fallback handler
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScanStatus('error');
      setErrorMessage('Please upload a valid image file (PNG, JPG, or WEBP).');
      return;
    }

    // Stop active camera first
    await stopScanner();

    setScanStatus('verifying');
    setErrorMessage('');

    let dummyScanner = null;
    try {
      // Use dedicated container or dummy ID for file decoding
      dummyScanner = new Html5Qrcode('qr-file-dummy-container');
      const decodedText = await dummyScanner.scanFile(file, false);
      await handleDecodedQR(decodedText);
    } catch (scanErr) {
      console.warn('QR image decoding error:', scanErr);
      setScanStatus('error');
      setErrorMessage(
        'No valid QR code was detected in the uploaded image. Please ensure the newspaper QR is clear, well-lit, and not cropped.'
      );
    } finally {
      if (dummyScanner) {
        try {
          dummyScanner.clear();
        } catch {
          // Ignore clear error on dummy container
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1c1917]/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="bg-[#fbf9f5] w-full max-w-md rounded-2xl shadow-2xl border border-[#eae4d9] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#eae4d9] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#f3ece2] rounded-lg text-[#9a3412]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 id="qr-modal-title" className="font-serif font-bold text-[#1c1917] text-base">
                Scan Newspaper QR
              </h3>
              <p className="text-[11px] font-mono text-[#78716c]">Position QR code within the frame</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 text-[#78716c] hover:text-[#1c1917] rounded-full hover:bg-[#f3ece2] transition-colors cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Selection Dropdown (if multiple cameras detected) */}
        {availableCameras.length > 1 && scanStatus === 'scanning' && (
          <div className="px-6 pt-3 flex items-center justify-between text-xs font-mono text-[#78716c]">
            <span className="flex items-center space-x-1">
              <SwitchCamera className="w-3.5 h-3.5 text-[#9a3412]" />
              <span>Camera:</span>
            </span>
            <select
              value={selectedCameraId}
              onChange={handleCameraChange}
              className="py-1 px-2 bg-white border border-[#eae4d9] rounded-lg text-xs font-sans text-[#1c1917] focus:outline-none focus:border-[#9a3412] max-w-[200px] truncate"
            >
              {availableCameras.map((cam, idx) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Viewfinder Area */}
        <div className="p-6 flex flex-col items-center">
          <div className="relative w-64 h-64 bg-[#1c1917] rounded-2xl border-2 border-[#292524] flex items-center justify-center overflow-hidden shadow-inner">
            {/* Live Camera Feed Container */}
            <div
              id="qr-camera-feed"
              className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
            />

            {/* Scanning Reticle & Laser Overlay */}
            {scanStatus === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-[#ea580c]/80 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(234,88,12,0.3)] animate-pulse" />
                <div className="w-44 h-0.5 bg-[#ea580c] shadow-[0_0_10px_#ea580c] animate-bounce -mt-24 pointer-events-none" />
                <p className="absolute bottom-3 text-[10px] font-mono text-white bg-black/60 px-2.5 py-0.5 rounded-full pointer-events-none">
                  Align viewfinder with printed QR
                </p>
              </div>
            )}

            {/* Initializing Spinner */}
            {scanStatus === 'initializing' && (
              <div className="absolute inset-0 bg-[#1c1917] flex flex-col items-center justify-center text-[#d6cebf] p-4 text-center">
                <Loader2 className="w-8 h-8 text-[#ea580c] animate-spin mb-2" />
                <p className="text-xs font-mono">Initializing camera feed...</p>
              </div>
            )}

            {/* Verifying Spinner */}
            {scanStatus === 'verifying' && (
              <div className="absolute inset-0 bg-[#1c1917]/90 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center animate-in fade-in">
                <Loader2 className="w-8 h-8 text-[#ea580c] animate-spin mb-2" />
                <p className="text-sm font-serif font-bold">Verifying Newspaper QR...</p>
                <p className="text-[11px] font-mono text-[#a8a29e] mt-1">Connecting to edition registry...</p>
              </div>
            )}

            {/* Success Overlay */}
            {scanStatus === 'success' && (
              <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-emerald-300 p-4 text-center animate-in fade-in">
                <CheckCircle className="w-12 h-12 mb-2 text-emerald-400" />
                <p className="text-sm font-serif font-bold text-white">QR Code Verified!</p>
                <p className="text-xs font-mono text-emerald-200 mt-1">
                  Loading {verifiedEdition?.name || 'Broadsheet Edition'}...
                </p>
              </div>
            )}

            {/* Camera Error / Inactive Fallback within viewfinder */}
            {scanStatus === 'error' && (
              <div className="absolute inset-0 bg-[#1c1917] flex flex-col items-center justify-center text-center p-4">
                <Camera className="w-10 h-10 text-[#78716c] mx-auto mb-2 opacity-60" />
                <p className="text-xs text-[#a8a29e] mb-3 font-mono">Camera scanner stopped</p>
                <button
                  type="button"
                  onClick={() => startCamera(selectedCameraId)}
                  className="px-3.5 py-1.5 bg-[#9a3412] hover:bg-[#7c2d12] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            )}
          </div>

          {/* Error Message Box */}
          {scanStatus === 'error' && errorMessage && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs w-full animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Scanner Alert</p>
                <p className="text-[11px] text-rose-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Action Row: Restart Camera Button (if error) */}
          {scanStatus === 'error' && (
            <div className="mt-3 w-full flex justify-center">
              <button
                type="button"
                onClick={() => startCamera(selectedCameraId)}
                className="py-1.5 px-4 bg-[#f3ece2] hover:bg-[#e7dfd1] text-[#1c1917] text-xs font-semibold rounded-lg transition-colors border border-[#eae4d9] flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#9a3412]" />
                <span>Restart Live Scanner</span>
              </button>
            </div>
          )}

          {/* QR Image Upload Fallback */}
          <div className="mt-4 pt-4 border-t border-[#eae4d9] w-full text-center">
            <p className="text-xs text-[#78716c] mb-2 font-mono">
              Unable to use camera? Upload a QR image file
            </p>
            <label className="inline-flex items-center space-x-2 px-4 py-2 bg-white hover:bg-[#f3ece2] border border-[#eae4d9] rounded-lg text-xs font-medium text-[#1c1917] cursor-pointer shadow-xs transition-colors">
              <Upload className="w-3.5 h-3.5 text-[#9a3412]" />
              <span>Upload QR Image File</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Hidden Dummy Container for Image File Scanning */}
          <div id="qr-file-dummy-container" className="hidden" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
