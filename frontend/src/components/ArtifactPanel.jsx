import React, { useState, useEffect } from 'react'
import { Box, Flex, Text, VStack } from '@chakra-ui/react'
import { Folder01Icon, Delete01Icon } from 'hugeicons-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mammoth from 'mammoth'
import { fetchArtifactBuffer, validateOfficeBytes, downloadArtifactFile, artifactDownloadUrl } from '../utils/artifactFiles'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── File type classifier ────────────────────────────────────────────────────
function getFileType(path = '') {
  const ext = path.split('.').pop().toLowerCase()
  if (ext === 'docx' || ext === 'doc') return 'docx'
  if (ext === 'pptx') return 'pptx'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'csv') return 'csv'
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'yaml', 'yml', 'sh', 'bash', 'txt', 'md'].includes(ext)) return 'code'
  return 'binary'
}

// ── DOCX preview via mammoth ────────────────────────────────────────────────
function DocxPreview({ path }) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchArtifactBuffer(path)
      .then(buf => {
        const check = validateOfficeBytes(buf, 'docx')
        if (!check.ok) throw new Error(check.message)
        return mammoth.convertToHtml({ arrayBuffer: buf }, {
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "b => strong",
            "i => em",
          ]
        })
      })
      .then(result => {
        setHtml(result.value)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [path])

  if (loading) return <Text color="#71717A" fontSize="14px" p="32px">Rendering document...</Text>
  if (error) return <Text color="#E11D48" fontSize="14px" p="32px">⚠️ {error}</Text>

  return (
    <Box
      p={{ base: '24px', md: '48px' }}
      maxW="800px"
      mx="auto"
      bg="#FFFFFF"
      sx={{
        h1: { fontSize: '26px', fontWeight: '700', mb: '16px', mt: '28px', color: '#18181B', borderBottom: '2px solid #F4F4F5', pb: '8px' },
        h2: { fontSize: '20px', fontWeight: '700', mb: '12px', mt: '24px', color: '#18181B' },
        h3: { fontSize: '17px', fontWeight: '600', mb: '10px', mt: '20px', color: '#3F3F46' },
        p:  { fontSize: '15px', lineHeight: '1.75', color: '#3F3F46', mb: '14px' },
        ul: { pl: '24px', mb: '14px' },
        ol: { pl: '24px', mb: '14px' },
        li: { fontSize: '15px', lineHeight: '1.7', color: '#3F3F46', mb: '4px' },
        strong: { fontWeight: '700', color: '#18181B' },
        em: { fontStyle: 'italic' },
        table: { w: 'full', mb: '20px', borderCollapse: 'collapse', fontSize: '14px' },
        th: { border: '1px solid #E4E4E7', p: '8px 14px', bg: '#F4F4F5', fontWeight: '600', textAlign: 'left' },
        td: { border: '1px solid #E4E4E7', p: '8px 14px' },
        blockquote: { borderLeft: '4px solid #A78BFA', pl: '16px', color: '#71717A', fontStyle: 'italic', my: '16px', bg: '#FAFAFA', py: '4px', borderRadius: '0 4px 4px 0' },
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ── CSV table preview ───────────────────────────────────────────────────────
function CsvPreview({ content }) {
  const rows = content.trim().split('\n').map(r => r.split(','))
  const headers = rows[0] || []
  const body = rows.slice(1)
  return (
    <Box overflowX="auto" p="24px">
      <Box as="table" w="full" fontSize="13px" style={{ borderCollapse: 'collapse' }}>
        <Box as="thead">
          <Box as="tr">
            {headers.map((h, i) => (
              <Box key={i} as="th" p="10px 14px" bg="#F4F4F5" border="1px solid #E4E4E7" fontWeight="700" color="#18181B" textAlign="left" whiteSpace="nowrap">
                {h.replace(/^"|"$/g, '')}
              </Box>
            ))}
          </Box>
        </Box>
        <Box as="tbody">
          {body.map((row, i) => (
            <Box key={i} as="tr" bg={i % 2 === 0 ? '#FFFFFF' : '#FAFAFA'} _hover={{ bg: '#F4F4F5' }}>
              {row.map((cell, j) => (
                <Box key={j} as="td" p="8px 14px" border="1px solid #E4E4E7" color="#3F3F46">
                  {cell.replace(/^"|"$/g, '')}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

// ── PPTX slide preview (text-based) ────────────────────────────────────────
function PptxPreview({ content }) {
  // Backend returns slide JSON or fallback text
  let slides = []
  try {
    const data = JSON.parse(content)
    if (Array.isArray(data.slides)) slides = data.slides
  } catch {
    // Show raw content if not structured JSON
    return (
      <Box p="32px" maxW="800px" mx="auto">
        <Text fontSize="14px" color="#71717A" whiteSpace="pre-wrap">{content}</Text>
      </Box>
    )
  }

  const slideColors = ['#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626']

  return (
    <Box p="32px" maxW="960px" mx="auto">
      <Flex wrap="wrap" gap="20px">
        {slides.map((slide, i) => (
          <Box
            key={i}
            w="440px"
            minH="260px"
            borderRadius="16px"
            overflow="hidden"
            border="1px solid #E4E4E7"
            boxShadow="0 4px 16px rgba(0,0,0,0.06)"
            bg="#FFFFFF"
          >
            <Box h="6px" bg={slideColors[i % slideColors.length]} />
            <Box p="24px">
              <Text fontSize="11px" fontWeight="700" color="#A1A1AA" textTransform="uppercase" letterSpacing="0.08em" mb="8px">
                Slide {i + 1}
              </Text>
              {slide.title && (
                <Text fontSize="18px" fontWeight="700" color="#18181B" mb="12px" lineHeight="1.3">
                  {slide.title}
                </Text>
              )}
              {slide.body && slide.body.map((line, j) => (
                <Flex key={j} align="flex-start" gap="8px" mb="6px">
                  <Box w="6px" h="6px" borderRadius="full" bg={slideColors[i % slideColors.length]} mt="6px" flexShrink={0} />
                  <Text fontSize="13px" color="#52525B" lineHeight="1.5">{line}</Text>
                </Flex>
              ))}
            </Box>
          </Box>
        ))}
      </Flex>
    </Box>
  )
}

// ── Code/text preview with syntax highlighting ──────────────────────────────
function CodePreview({ content, ext }) {
  let displayContent = content
  if (ext === 'csv') return <CsvPreview content={content} />
  const codeExts = ['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'yaml', 'yml', 'sh', 'bash']
  if (codeExts.includes(ext) && !displayContent.trim().startsWith('```')) {
    displayContent = `\`\`\`${ext}\n${displayContent}\n\`\`\``
  }
  return (
    <Box p={{ base: '16px', md: '32px' }} maxW="900px" mx="auto">
      <Box
        sx={{
          h1: { fontSize: '24px', fontWeight: 'bold', mb: '16px', mt: '24px' },
          h2: { fontSize: '20px', fontWeight: 'bold', mb: '14px', mt: '20px' },
          h3: { fontSize: '18px', fontWeight: 'bold', mb: '12px', mt: '16px' },
          p:  { fontSize: '15px', lineHeight: '1.7', color: '#3F3F46', mb: '16px' },
          ul: { pl: '24px', mb: '16px' },
          ol: { pl: '24px', mb: '16px' },
          li: { fontSize: '15px', lineHeight: '1.7', color: '#3F3F46', mb: '4px' },
          code: { bg: '#F4F4F5', p: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#E11D48' },
          pre: { bg: '#18181B', p: '20px', borderRadius: '10px', overflowX: 'auto', mb: '16px', color: '#FAFAFA', 'code': { bg: 'transparent', color: 'inherit', p: 0, fontSize: '13px' } },
          table: { w: 'full', mb: '16px', borderCollapse: 'collapse' },
          th: { border: '1px solid #E4E4E7', p: '8px 12px', bg: '#F4F4F5', textAlign: 'left', fontWeight: '600' },
          td: { border: '1px solid #E4E4E7', p: '8px 12px' },
          blockquote: { borderLeft: '4px solid #E4E4E7', pl: '16px', color: '#71717A', fontStyle: 'italic', my: '16px' },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
      </Box>
    </Box>
  )
}

// ── Main ArtifactPanel ──────────────────────────────────────────────────────
export default function ArtifactPanel({ artifacts, pendingArtifactPath, onClearPendingArtifact, activeArtifact, onSetActiveArtifact }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  // Resolve pendingArtifactPath (fired by agent when it creates a new file)
  useEffect(() => {
    if (!pendingArtifactPath) return
    const basename = pendingArtifactPath.replace(/\\/g, '/').split('/').pop()
    const found = artifacts.artifacts.find(a => a.path.replace(/\\/g, '/').split('/').pop() === basename)
    onSetActiveArtifact(found || { path: pendingArtifactPath, name: basename })
    onClearPendingArtifact?.()
  }, [pendingArtifactPath])

  useEffect(() => {
    if (!activeArtifact) return
    const type = getFileType(activeArtifact.path)
    if (type === 'docx') { setContent(''); return }
    if (type === 'pdf' || type === 'image') { setContent(''); return }

    let isMounted = true
    setLoading(true)
    fetch(`${API_URL}/api/artifact?path=${encodeURIComponent(activeArtifact.path.replace(/\\/g, '/').split('/').pop())}`)
      .then(r => r.json())
      .then(data => { if (isMounted) { setContent(data.content || ''); setLoading(false) } })
      .catch(err => { if (isMounted) { setContent(`Error: ${err.message}`); setLoading(false) } })
    return () => { isMounted = false }
  }, [activeArtifact])

  const renderPreview = () => {
    if (!activeArtifact) return null
    const type = getFileType(activeArtifact.path)
    const ext = activeArtifact.path.split('.').pop().toLowerCase()

    if (loading) return <Text color="#71717A" fontSize="14px" p="32px">Loading...</Text>

    if (type === 'docx') return <DocxPreview path={activeArtifact.path} />

    if (type === 'pdf') return (
      <iframe
        src={artifactDownloadUrl(activeArtifact.path)}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="PDF Preview"
      />
    )

    if (type === 'image') return (
      <Flex h="full" align="center" justify="center" p="24px">
        <img
          src={artifactDownloadUrl(activeArtifact.path)}
          alt={activeArtifact.path.split('/').pop()}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
        />
      </Flex>
    )

    if (type === 'pptx') return <PptxPreview content={content} />
    if (type === 'csv') return <CsvPreview content={content} />
    if (type === 'xlsx') return (
      <Flex direction="column" align="center" justify="center" h="full" gap="16px" p="48px" textAlign="center">
        <Text fontSize="48px">📊</Text>
        <Text fontSize="16px" fontWeight="700" color="#18181B">Spreadsheet</Text>
        <Text fontSize="14px" color="#71717A" maxW="360px">
          Excel previews are not supported in-browser yet. Download the file to open it in Excel or Google Sheets.
        </Text>
      </Flex>
    )
    if (type === 'binary') return (
      <Flex direction="column" align="center" justify="center" h="full" gap="16px" p="48px" textAlign="center">
        <Text fontSize="48px">📦</Text>
        <Text fontSize="16px" fontWeight="700" color="#18181B">Binary File</Text>
        <Text fontSize="14px" color="#71717A" maxW="360px">
          This file type cannot be previewed in the browser. Click the download button above to open it natively.
        </Text>
      </Flex>
    )

    return <CodePreview content={content} ext={ext} />
  }

  // Newest first so the most recently created artifact is always at the top
  const sortedArtifacts = [...artifacts.artifacts].reverse()

  return (
    <Flex h="full" w="full" minH={0} bg="#FAFAFA" direction={{ base: 'column', md: 'row' }} overflow="hidden">

      {/* Left: file list — hidden on mobile when a preview is open */}
      <Box
        w={{ base: 'full', md: '300px', lg: '320px' }}
        h="full"
        borderRight={{ base: 'none', md: '1px solid #E4E4E7' }}
        bg="#FAFAFA"
        display={{ base: activeArtifact ? 'none' : 'block', md: 'block' }}
        overflowY="auto"
      >
        <Box p="20px">
          {sortedArtifacts.length === 0 ? (
            <Flex direction="column" align="center" justify="center" h="200px" color="#A1A1AA" textAlign="center">
              <Folder01Icon size={32} strokeWidth={1.5} style={{ marginBottom: '12px' }} />
              <Text fontSize="14px">No documents yet.</Text>
              <Text fontSize="12px" mt="4px">Ask Heccker to write a doc or make a PPTX.</Text>
            </Flex>
          ) : (
            <VStack spacing="10px" align="stretch">
              {sortedArtifacts.map((a) => {
                const isActive = activeArtifact?.id === a.id
                const fname = a.path.split('/').pop()
                const fext = fname.split('.').pop().toUpperCase()
                const extColors = { DOCX: '#2563EB', PPTX: '#DC2626', XLSX: '#059669', CSV: '#0891B2', PDF: '#7C3AED' }
                const badgeColor = extColors[fext] || '#71717A'
                return (
                  <Flex
                    key={a.id}
                    p="12px 14px"
                    bg={isActive ? '#EEF2FF' : '#FFFFFF'}
                    borderRadius="12px"
                    border="1px solid"
                    borderColor={isActive ? '#C7D2FE' : '#E4E4E7'}
                    align="center"
                    justify="space-between"
                    cursor="pointer"
                    _hover={{ borderColor: '#C7D2FE', boxShadow: 'sm', bg: '#F5F3FF' }}
                    transition="all 0.2s"
                    onClick={() => onSetActiveArtifact(a)}
                  >
                    <Flex align="center" gap="10px" overflow="hidden">
                      <Box px="7px" py="4px" bg={badgeColor} borderRadius="6px" flexShrink={0}>
                        <Text fontSize="9px" fontWeight="800" color="#FFFFFF" letterSpacing="0.05em">{fext}</Text>
                      </Box>
                      <Box overflow="hidden">
                        <Text fontSize="13px" fontWeight="600" color="#18181B" isTruncated>{fname}</Text>
                      </Box>
                    </Flex>
                    <Box
                      p="6px"
                      color="#A1A1AA"
                      _hover={{ color: '#E11D48', bg: '#FFE4E6' }}
                      borderRadius="md"
                      transition="all 0.2s"
                      onClick={(e) => {
                        e.stopPropagation()
                        artifacts.removeArtifact(a.id)
                        if (activeArtifact?.id === a.id) onSetActiveArtifact(null)
                      }}
                    >
                      <Delete01Icon size={15} />
                    </Box>
                  </Flex>
                )
              })}
            </VStack>
          )}
        </Box>
      </Box>

      {/* Right: preview — no internal header/back, those live in App.jsx now */}
      <Box
        flex="1"
        h="full"
        minH={0}
        display={{ base: activeArtifact ? 'block' : 'none', md: 'block' }}
        bg="#FFFFFF"
        position="relative"
        overflow="hidden"
      >
        {activeArtifact ? (
          <Flex direction="column" h="full" minH={0} overflow="hidden">
            <Box
              flex="1"
              minH={0}
              overflowY="auto"
              overflowX="hidden"
              bg="#F4F4F5"
              css={{
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                scrollbarColor: '#D4D4D8 transparent',
              }}
            >
              {renderPreview()}
            </Box>
          </Flex>
        ) : (
          <Flex h="full" direction="column" align="center" justify="center" color="#A1A1AA" bg="#FAFAFA">
            <Folder01Icon size={48} strokeWidth={1} style={{ marginBottom: '16px', color: '#D4D4D8' }} />
            <Text fontSize="16px" fontWeight="500">Select a document to preview</Text>
            <Text fontSize="13px" mt="4px">DOCX, PPTX, XLSX, CSV, PDF, images and more</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  )
}
