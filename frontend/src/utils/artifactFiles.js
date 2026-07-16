/** Normalize artifact path to filename only (works across Windows dev + Render prod). */
export function artifactBasename(path = '') {
  return path.replace(/\\/g, '/').split('/').pop() || path
}

/** Validate downloaded artifact bytes before Office preview libraries run. */
export function validateOfficeBytes(buffer, ext = 'docx') {
  if (!buffer || buffer.byteLength < 4) {
    return { ok: false, message: 'File is empty or missing on the server. Ask Heccker to regenerate with write_workspace_file.' }
  }
  const bytes = new Uint8Array(buffer.slice(0, 4))
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b // PK

  if (['docx', 'pptx', 'xlsx'].includes(ext) && !isZip) {
    try {
      const text = new TextDecoder().decode(buffer.slice(0, 200))
      if (text.trim().startsWith('{') && (text.includes('error') || text.includes('detail'))) {
        return { ok: false, message: 'File not found on server (it may have expired after a redeploy). Regenerate the document.' }
      }
    } catch { /* ignore */ }
    return {
      ok: false,
      message: `Invalid ${ext.toUpperCase()} file — not a real Office document. Regenerate using write_workspace_file (not echo/terminal).`,
    }
  }
  return { ok: true }
}

export async function fetchArtifactBuffer(path) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const name = artifactBasename(path)
  const res = await fetch(`${API_URL}/api/download_artifact?path=${encodeURIComponent(name)}`)
  if (!res.ok) {
    let detail = `Download failed (${res.status})`
    try {
      const err = await res.json()
      if (err.detail) detail = err.detail
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  return res.arrayBuffer()
}

/** Trigger a browser download (works reliably cross-origin vs window.open). */
export async function downloadArtifactFile(path) {
  const name = artifactBasename(path)
  const buf = await fetchArtifactBuffer(name)
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const mime = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    csv: 'text/csv',
  }[ext] || 'application/octet-stream'
  const blob = new Blob([buf], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function artifactDownloadUrl(path) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const name = artifactBasename(path)
  return `${API_URL}/api/download_artifact?path=${encodeURIComponent(name)}`
}
