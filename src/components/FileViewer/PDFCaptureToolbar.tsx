import React from 'react';
import { Scan, X } from 'lucide-react';
import { usePDFCaptureStore } from '@/store/pdfCaptureStore';
import './PDFCaptureToolbar.css';

interface PDFCaptureToolbarProps {
    pdfId: string;
    pdfName: string;
}

const PDFCaptureToolbar: React.FC<PDFCaptureToolbarProps> = ({ pdfId, pdfName }) => {
    const { captureMode, startCapture, cancelCapture, setPdfContext } = usePDFCaptureStore();

    // Set PDF context when mounting
    React.useEffect(() => {
        setPdfContext(pdfId, pdfName);
    }, [pdfId, pdfName, setPdfContext]);

    return (
        <div className="pdf-capture-toolbar">
            {captureMode === 'idle' ? (
                <button
                    onClick={startCapture}
                    className="capture-btn"
                    title="Capture region to ask AI"
                >
                    <Scan size={18} />
                    <span className="capture-label">Capture</span>
                </button>
            ) : (
                <div className="capture-active">
                    <span className="pulse-dot" />
                    <span className="hint">Click and drag to select</span>
                    <button
                        onClick={cancelCapture}
                        className="cancel-btn"
                        title="Cancel"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default PDFCaptureToolbar;
