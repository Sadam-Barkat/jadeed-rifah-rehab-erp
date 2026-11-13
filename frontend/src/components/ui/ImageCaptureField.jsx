import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import Modal from './Modal'
import Button from './Button'
import './ui.css'

function fileFromBlob(blob, name) {
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}

export default function ImageCaptureField({
  id,
  label,
  value,
  required = false,
  onChange,
  filenamePrefix = 'photo',
}) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [starting, setStarting] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const previewUrl = value ? URL.createObjectURL(value) : null

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function stopCamera() {
    streamRef.current?.getTracks?.().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }

  function closeCamera() {
    stopCamera()
    setCameraOpen(false)
    setStarting(false)
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera not supported on this device')
      return
    }
    setCameraOpen(true)
    setStarting(true)
    setReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setReady(true)
    } catch {
      toast.error('Could not open camera. Allow camera permission or use gallery.')
      closeCamera()
    } finally {
      setStarting(false)
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || !ready) return
    const canvas = document.createElement('canvas')
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Capture failed')
          return
        }
        const file = fileFromBlob(blob, `${filenamePrefix}-${Date.now()}.jpg`)
        onChange?.(file)
        closeCamera()
        toast.success('Photo added')
      },
      'image/jpeg',
      0.92
    )
  }

  return (
    <div className="ui-field image-capture-field">
      <label htmlFor={id}>{label}</label>
      <div className="image-capture-row">
        <input
          ref={fileRef}
          id={id}
          className="ui-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          required={required && !value}
          onChange={(e) => onChange?.(e.target.files?.[0] || null)}
        />
        <Button type="button" variant="secondary" onClick={openCamera}>
          Take photo
        </Button>
      </div>
      {value ? (
        <div className="image-capture-preview">
          <img src={previewUrl} alt={`${label} preview`} />
          <span>{value.name}</span>
        </div>
      ) : null}

      <Modal
        open={cameraOpen}
        title={`Take photo — ${label}`}
        onClose={closeCamera}
        hideFooter
        size="md"
      >
        <div className="camera-capture">
          {starting ? <p className="panel-copy">Opening camera…</p> : null}
          <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
          <div className="camera-actions">
            <Button type="button" variant="ghost" onClick={closeCamera}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={capturePhoto} disabled={!ready}>
              Capture
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
