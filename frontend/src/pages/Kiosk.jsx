import React, { useState, useRef, useEffect } from 'react';
import { Camera, ShieldCheck, User, CreditCard, FileText, CheckCircle, AlertCircle, RefreshCcw, Loader2 } from 'lucide-react';
import { verificationApi, timetableApi } from '../services/api';
import confetti from 'canvas-confetti';

const Kiosk = () => {
  const [step, setStep] = useState(1); // 1: Select Exam, 2: Face, 3: ID, 4: Admit, 5: Result
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [images, setImages] = useState({
    face: '',
    idCard: '',
    admitCard: ''
  });

  useEffect(() => {
    timetableApi.getToday().then(res => {
      setExams(res.data);
      if (res.data.length > 0) setSelectedExamId(res.data[0].id);
    });
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions.");
    }
  };

  const captureImage = (type) => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    setImages(prev => ({ ...prev, [type]: dataUrl.split(',')[1] }));
    
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleVerify(dataUrl.split(',')[1]);
    }
  };

  const handleVerify = async (lastImage) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await verificationApi.verify({
        timetable_id: selectedExamId,
        face_image_b64: images.face,
        admit_card_b64: images.admitCard,
        id_card_b64: lastImage
      });
      
      setResult(response.data);
      if (response.data.verified) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#ec4899', '#8b5cf6']
        });
      }
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed");
      setStep(5);
    } finally {
      setLoading(false);
      // Stop camera
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    }
  };

  const resetKiosk = () => {
    setStep(1);
    setImages({ face: '', idCard: '', admitCard: '' });
    setResult(null);
    setError('');
  };

  useEffect(() => {
    if (step >= 2 && step <= 4) {
      startCamera();
    }
  }, [step]);

  return (
    <div className="kiosk-container flex flex-col items-center">
      <div className="max-w-4xl w-full">
        {/* Progress Stepper */}
        <div className="flex justify-between mb-12 relative" style={{ padding: '0 20px' }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex flex-col items-center z-10">
              <div 
                className="flex items-center justify-center"
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  background: step >= s ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${step >= s ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                  color: step >= s ? 'white' : 'var(--text-muted)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  transition: 'all 0.3s ease'
                }}
              >
                {step > s ? <CheckCircle size={20} /> : s}
              </div>
              <span style={{ fontSize: '0.7rem', marginTop: '8px', color: step >= s ? 'var(--text)' : 'var(--text-muted)' }}>
                {['Select', 'Face', 'Admit', 'ID', 'Done'][s-1]}
              </span>
            </div>
          ))}
          <div style={{ position: 'absolute', top: '20px', left: '40px', right: '40px', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 0 }}></div>
          <div style={{ 
            position: 'absolute', 
            top: '20px', 
            left: '40px', 
            width: `${(step-1) * 25}%`, 
            height: '2px', 
            background: 'var(--primary)', 
            zIndex: 0,
            transition: 'width 0.3s ease'
          }}></div>
        </div>

        <div className="glass-card card" style={{ padding: '48px' }}>
          {step === 1 && (
            <div className="text-center animate-fade-in">
              <ShieldCheck size={80} color="#6366f1" className="mb-6 mx-auto" />
              <h2 className="mb-2">Student Verification</h2>
              <p className="mb-8">Select the current exam session to begin.</p>
              
              <div className="flex flex-col gap-4 mb-8" style={{ maxWidth: '400px', margin: '0 auto 32px' }}>
                <select 
                  className="glass-input" 
                  style={{ width: '100%', appearance: 'none' }}
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>{e.subject} (Room {e.room_no})</option>
                  ))}
                  {exams.length === 0 && <option>No exams today</option>}
                </select>
              </div>
              
              <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                Start Verification <ArrowRight size={20} />
              </button>
            </div>
          )}

          {(step >= 2 && step <= 4) && (
            <div className="text-center animate-fade-in">
              <div className="mb-4">
                {step === 2 && <><User size={40} className="mb-2" /> <h3>Verify Face</h3> <p>Center your face in the frame.</p></>}
                {step === 3 && <><CreditCard size={40} className="mb-2" /> <h3>Admit Card</h3> <p>Hold your admit card clearly in front.</p></>}
                {step === 4 && <><FileText size={40} className="mb-2" /> <h3>Identity Card</h3> <p>Show your college ID card.</p></>}
              </div>

              <div className="camera-frame relative mb-8 mx-auto" style={{ width: '100%', maxWidth: '480px', height: '360px', background: 'black', borderRadius: '24px', overflow: 'hidden', border: '4px solid var(--primary)' }}>
                <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay muted playsInline />
                <div className="face-guide" style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  width: '240px', 
                  height: '240px', 
                  border: '2px dashed rgba(255,255,255,0.4)',
                  borderRadius: step === 2 ? '50%' : '16px'
                }}></div>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ height: '64px', width: '64px', borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                onClick={() => {
                  const type = step === 2 ? 'face' : (step === 3 ? 'admitCard' : 'idCard');
                  captureImage(type);
                }}
              >
                <Camera size={32} />
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="text-center animate-fade-in">
              {loading ? (
                <div className="py-20">
                  <Loader2 size={64} className="animate-spin mb-4 mx-auto" color="var(--primary)" />
                  <h3>Processing Identity...</h3>
                  <p>Comparing face data and legal documents</p>
                </div>
              ) : error ? (
                <div className="py-12">
                  <AlertCircle size={80} color="var(--error)" className="mb-6 mx-auto" />
                  <h2 style={{ color: 'var(--error)' }}>Verification Failed</h2>
                  <p className="mb-8">{error}</p>
                  <button className="btn btn-primary" onClick={resetKiosk}>
                    <RefreshCcw size={20} /> Try Again
                  </button>
                </div>
              ) : result?.verified ? (
                <div className="py-12">
                  <CheckCircle size={80} color="var(--success)" className="mb-6 mx-auto" />
                  <h2 style={{ color: 'var(--success)' }}>Access Granted</h2>
                  <div className="p-6 my-8 glass-card" style={{ maxWidth: '400px', margin: '0 auto 32px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{result.student_name}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{result.enrollment_no}</div>
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      Match Confidence: <strong>{result.confidence}%</strong>
                    </div>
                  </div>
                  <p className="mb-8">Verification complete. You may proceed to the exam hall.</p>
                  <button className="btn btn-primary" onClick={resetKiosk}>Next Student</button>
                </div>
              ) : (
                <div className="py-12">
                   <AlertCircle size={80} color="var(--error)" className="mb-6 mx-auto" />
                  <h2 style={{ color: 'var(--error)' }}>Verification Refused</h2>
                  <p className="mb-4">{result?.reason}</p>
                   {result?.student_name && (
                    <div className="glass-badge mb-8">Attempt by: {result.student_name}</div>
                   )}
                  <button className="btn btn-primary" onClick={resetKiosk}>Retry Verification</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .btn-lg { padding: 16px 32px; font-size: 1.1rem; }
        .glass-badge { background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 8px; font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};

const ArrowRight = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default Kiosk;
