import React, { useState } from 'react'
import { Box, Flex, Text, Tooltip, Grid, Image } from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  CheckListIcon,
  Copy01Icon,
  Share01Icon,
  CheckmarkBadge01Icon,
  Folder01Icon,
  ReloadIcon
} from 'hugeicons-react'
import { MdOutlineThumbUp, MdOutlineThumbDown, MdRefresh } from 'react-icons/md'
import ToolCard from './ToolCard'

const AnimatedDots = ({ text = "Heccker is thinking" }) => (
  <Flex gap="4px" align="center" h="20px" py="4px">
    <style>{`
      @keyframes pulse-dots {
        0% { opacity: .2; transform: scale(0.8); }
        20% { opacity: 1; transform: scale(1.1); }
        100% { opacity: .2; transform: scale(0.8); }
      }
      .dot {
        width: 6px; height: 6px; background-color: #A1A1AA; border-radius: 50%;
        animation: pulse-dots 1.4s infinite ease-in-out;
      }
      .dot:nth-of-type(1) { animation-delay: 0s; }
      .dot:nth-of-type(2) { animation-delay: 0.2s; }
      .dot:nth-of-type(3) { animation-delay: 0.4s; }
    `}</style>
    <Text fontSize="12px" color="#A1A1AA" fontWeight="500" fontStyle="italic" mr="4px">{text}</Text>
    <Box className="dot" />
    <Box className="dot" />
    <Box className="dot" />
  </Flex>
)

function ImageGallery({ images }) {
  const [selectedImg, setSelectedImg] = useState(null)

  if (!images || images.length === 0) return null

  return (
    <>
      <Grid templateColumns={images.length > 1 ? "repeat(2, 1fr)" : "1fr"} gap="8px" mt="12px" w="full">
        {images.map((img, i) => (
          <Image 
            key={i} 
            src={img.src} 
            alt={img.alt} 
            borderRadius="8px" 
            cursor="pointer" 
            onClick={() => setSelectedImg(img.src)} 
            objectFit="cover" 
            w="full" 
            maxH="200px"
            _hover={{ opacity: 0.8 }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ))}
      </Grid>
      {selectedImg && (
        <Box 
          position="fixed" top={0} left={0} w="100vw" h="100vh" zIndex={9999} 
          bg="blackAlpha.800" backdropFilter="blur(10px)"
          display="flex" justifyContent="center" alignItems="center"
          onClick={() => setSelectedImg(null)}
        >
          <Image src={selectedImg} maxH="85vh" maxW="90vw" borderRadius="md" boxShadow="2xl" onClick={(e) => e.stopPropagation()} />
          <Box position="absolute" top="20px" right="20px" color="white" cursor="pointer" fontSize="24px" fontWeight="bold" onClick={() => setSelectedImg(null)}>✕</Box>
        </Box>
      )}
    </>
  )
}

export default function Message({ role, content, blocks, toolCalls, isBlocked, isError, streaming, timestamp, onRetry, artifactsList }) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [retried, setRetried] = useState(false)
  const isUser = role === 'user'

  const handleCopy = () => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = () => {
    if (!content) return
    const shareText = `**${isUser ? 'Shalom' : 'Heccker'}**: ${content}`
    navigator.clipboard.writeText(shareText)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  const handleRetry = () => {
    if (onRetry) onRetry()
    setRetried(true)
    setTimeout(() => setRetried(false), 2000)
  }

  const formatTime = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Parse confidence metadata chip if present
  let cleanContent = content || ''
  let confidenceVal = null
  let modelVal = null

  if (cleanContent.includes('---')) {
    const parts = cleanContent.split('---')
    cleanContent = parts[0].trim()
    const meta = parts[1] || ''

    const confMatch = meta.match(/Confidence:\s*(\S+)/i)
    if (confMatch) confidenceVal = confMatch[1]

    const modelMatch = meta.match(/Model:\s*(\S+)/i)
    if (modelMatch) modelVal = modelMatch[1]
  }

  // Single shared Set for the entire message render — prevents cross-block media duplication
  const msgSeenMedia = new Set()

  const renderRichMedia = (textContent) => {
    if (!textContent) return null
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/gi
    const spotRegex = /(?:https?:\/\/open\.spotify\.com\/(track|album|playlist|episode)\/|spotify:(track|album|playlist|episode):)([a-zA-Z0-9]+)/gi
    const mapRegex = /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=([^&)\s]+)/gi
    
    const images = []
    let match
    while ((match = imgRegex.exec(textContent)) !== null) {
      if (!msgSeenMedia.has(match[2])) {
        msgSeenMedia.add(match[2])
        images.push({ alt: match[1], src: match[2] })
      }
    }
    
    const ytIds = []
    while ((match = ytRegex.exec(textContent)) !== null) {
      const key = 'yt:' + match[1]
      if (!msgSeenMedia.has(key)) {
        msgSeenMedia.add(key)
        ytIds.push(match[1])
      }
    }
    
    const spotIds = []
    while ((match = spotRegex.exec(textContent)) !== null) {
      const type = match[1] || match[2]
      const id = match[3]
      const uniqueKey = 'spot:' + type + id
      if (!msgSeenMedia.has(uniqueKey)) {
        msgSeenMedia.add(uniqueKey)
        spotIds.push({ type, id })
      }
    }

    const mapQueries = []
    while ((match = mapRegex.exec(textContent)) !== null) {
      const key = 'map:' + match[1]
      if (!msgSeenMedia.has(key)) {
        msgSeenMedia.add(key)
        mapQueries.push(match[1])
      }
    }

    if (images.length === 0 && ytIds.length === 0 && spotIds.length === 0 && mapQueries.length === 0) return null

    return (
      <Flex direction="column" gap="12px" mt="12px" w="full">
        <ImageGallery images={images} />
        {ytIds.map((id, i) => (
          <Box key={`yt-${i}`} position="relative" w="full" pt="56.25%" borderRadius="8px" overflow="hidden" boxShadow="sm">
            <iframe 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              src={`https://www.youtube.com/embed/${id}`} 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Box>
        ))}
        {spotIds.map((s, i) => {
          const embedUrl = `https://open.spotify.com/embed/${s.type}/${s.id}?utm_source=generator&theme=0`
          const openUrl = `https://open.spotify.com/${s.type}/${s.id}`
          return (
            <Box key={`spot-${i}`} w="full" borderRadius="12px" overflow="hidden" boxShadow="sm" position="relative">
              <iframe
                style={{ width: '100%', height: s.type === 'episode' ? '152px' : '80px', border: 'none', borderRadius: '12px' }}
                src={embedUrl}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
              />
              {/* Fallback shown if iframe fails */}
              <Flex
                display="none"
                align="center"
                gap="12px"
                p="14px 16px"
                bg="#191414"
                borderRadius="12px"
                cursor="pointer"
                as="a"
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                _hover={{ bg: '#282828' }}
                transition="all 0.2s"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#1DB954">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <Box>
                  <Text fontSize="13px" fontWeight="700" color="#FFFFFF">Open on Spotify</Text>
                  <Text fontSize="11px" color="#B3B3B3">Click to play in Spotify</Text>
                </Box>
              </Flex>
            </Box>
          )
        })}
        {mapQueries.map((query, i) => (
          <Box key={`map-${i}`} position="relative" w="full" pt="56.25%" borderRadius="8px" overflow="hidden" boxShadow="sm">
            <iframe
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              frameBorder="0"
              src={`https://maps.google.com/maps?q=${query}&t=k&z=13&ie=UTF8&iwloc=&output=embed`}
              allowFullScreen
            />
          </Box>
        ))}
      </Flex>
    )
  }

  const renderTextContent = (textContent) => {
    let clean = textContent || ''
    if (!clean) return null

    const mediaNode = renderRichMedia(clean)
    // Strip image markdown — ImageGallery handles those separately
    clean = clean.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim()

    const mdComponents = {
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#3B82F6', textDecoration: 'underline', cursor: 'pointer', pointerEvents: 'all' }}
          onClick={(e) => { e.stopPropagation(); if (href) window.open(href, '_blank', 'noopener,noreferrer') }}
        >
          {children}
        </a>
      ),
    }

    return (
      <Flex direction="column" gap="4px">
        {clean && (
          <Box
            fontSize="14px"
            color="#18181B"
            lineHeight="1.6"
            sx={{
              p: { mb: '8px' },
              h1: { fontSize: '16px', fontWeight: '600', mb: '8px', mt: '12px', color: '#18181B' },
              h2: { fontSize: '15px', fontWeight: '600', mb: '6px', mt: '10px', color: '#18181B' },
              h3: { fontSize: '14px', fontWeight: '600', mb: '4px', mt: '8px', color: '#18181B' },
              ul: { pl: '20px', mb: '8px' },
              ol: { pl: '20px', mb: '8px' },
              li: { mb: '4px' },
              strong: { fontWeight: '600', color: '#18181B' },
              em: { fontStyle: 'italic', color: '#71717A' },
              table: { w: 'full', mb: '12px', borderCollapse: 'collapse', fontSize: '13px', display: 'block', overflowX: 'auto' },
              thead: { bg: '#F4F4F5' },
              th: { border: '1px solid #E4E4E7', p: '8px 12px', fontWeight: '600', textAlign: 'left', whiteSpace: 'nowrap' },
              td: { border: '1px solid #E4E4E7', p: '8px 12px', color: '#3F3F46' },
              tr: { _even: { bg: '#FAFAFA' } },
              code: { bg: '#F4F4F5', px: '4px', py: '1px', borderRadius: '4px', fontSize: '12px' },
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {clean}
            </ReactMarkdown>
          </Box>
        )}
        {mediaNode}
      </Flex>
    )
  }

  return (
    <Flex
      direction="column"
      align={isUser ? 'flex-end' : 'flex-start'}
      w="full"
      role="group"
      mb="24px"
    >
      <Flex gap="8px" maxW={isUser ? '75%' : '85%'} align="flex-start" position="relative">
        
        {/* Chat bubble card */}
        <Box
          bg={isUser ? '#EDE9FF' : '#FFFFFF'}
          border={isUser ? 'none' : '1px solid #E4E4E7'}
          borderRadius={isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}
          p={isUser ? '12px 16px' : '18px 20px'}
          position="relative"
        >
          {/* Security alert block banner */}
          {isBlocked && (
            <Box
              bg="#FFF5F8"
              borderLeft="3px solid #FFB3C6"
              p="10px 14px"
              borderRadius="sm"
              mb="12px"
            >
              <Text fontSize="11px" fontWeight="700" color="#C70039">
                🛡️ Security block — injection attempt blocked.
              </Text>
            </Box>
          )}

          {/* Interleaved Message Text Content & Tools */}
          {blocks && blocks.length > 0 ? (
            <Flex direction="column" gap="12px">
              {blocks.map((block, idx) => {
                if (block.type === 'text') {
                  const cleanedText = block.content.replace(/--- Confidence:.*$/, '').trim();
                  return (
                    <Box key={idx} fontSize="13px" color="#18181B" lineHeight="1.6" whiteSpace="pre-wrap" fontWeight={isUser ? '500' : '400'}>
                      {renderTextContent(cleanedText)}
                    </Box>
                  )
                } else if (block.type === 'tool') {
                  if (block.status?.toUpperCase() === 'CLEARED') {
                    const media = renderRichMedia(block.detail)
                    return media ? <Box key={idx} mt="4px">{media}</Box> : null
                  } else {
                    return (
                      <Box key={idx}>
                        <ToolCard {...block} />
                      </Box>
                    )
                  }
                } else if (block.type === 'artifact') {
                  const filename = block.path.replace(/\\/g, '/').split('/').pop();
                  const ext = filename.split('.').pop().toUpperCase();
                  const isDeleted = artifactsList && !artifactsList.some(
                    a => a.path.replace(/\\/g, '/').split('/').pop() === filename
                  );
                  
                  return (
                    <Box 
                      key={idx} 
                      mt="12px" 
                      mb="4px"
                      w="340px"
                      maxW="full"
                      bg="#FFFFFF"
                      borderRadius="xl" 
                      border="1px solid #E4E4E7" 
                      boxShadow="0 2px 4px rgba(0,0,0,0.02)"
                      overflow="hidden"
                      opacity={isDeleted ? 0.5 : 1}
                    >
                      {/* Card Header */}
                      <Flex 
                        px="16px" 
                        py="10px" 
                        borderBottom="1px solid #F4F4F5" 
                        align="center" 
                        gap="6px"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <Text fontSize="12px" fontWeight="600" color="#71717A" textTransform="uppercase" letterSpacing="0.03em">
                          {isDeleted ? "File Deleted" : "File Ready"}
                        </Text>
                      </Flex>

                      {/* Card Body */}
                      <Flex 
                        p="16px" 
                        align="center" 
                        justify="space-between"
                        cursor={isDeleted ? "not-allowed" : "pointer"}
                        _hover={isDeleted ? {} : { bg: '#FAFAFA' }}
                        transition="all 0.2s"
                        onClick={() => {
                          if (!isDeleted) {
                            window.dispatchEvent(new CustomEvent('open_artifact', { detail: filename }))
                          }
                        }}
                      >
                        <Flex align="center" gap="14px">
                          <Box p="10px" bg="#F4F4F5" borderRadius="lg">
                            <Folder01Icon size={22} color="#18181B" />
                          </Box>
                          <Flex direction="column" gap="2px">
                            <Text fontSize="14px" fontWeight="700" color="#18181B" noOfLines={1} title={filename} textDecoration={isDeleted ? "line-through" : "none"}>
                              {filename}
                            </Text>
                            <Text fontSize="12px" color="#71717A">
                              Artifact • {ext} Format
                            </Text>
                          </Flex>
                        </Flex>
                        
                        {!isDeleted && (
                          <Box color="#A1A1AA" _hover={{ color: '#18181B' }} transition="color 0.2s">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8"/>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                          </Box>
                        )}
                      </Flex>
                    </Box>
                  )
                }
                return null
              })}
              {(() => {
                const isWorking = (toolCalls && toolCalls.length > 0) || blocks?.some(b => b.type === 'tool' && b.status?.toUpperCase() !== 'CLEARED')
                const shouldShowDots = streaming && (!blocks?.length || blocks[blocks.length - 1]?.type !== 'text' || !blocks[blocks.length - 1]?.content.trim() || isWorking)
                if (shouldShowDots) {
                  return <AnimatedDots text={isWorking ? "Heccker is working" : "Heccker is thinking"} />
                }
                return null
              })()}
            </Flex>
          ) : (
            <Box fontSize="13px" color={isError ? "#C70039" : "#18181B"} lineHeight="1.6" whiteSpace="pre-wrap" fontWeight={isUser ? '500' : (isError ? '600' : '400')}>
              {renderTextContent(cleanContent)}
              {(!cleanContent && streaming) && <AnimatedDots text={(toolCalls && toolCalls.length > 0) ? "Heccker is working" : "Heccker is thinking"} />}
            </Box>
          )}

          {/* Retry Button for Errors */}
          {isError && onRetry && (
            <Box mt="12px">
              <Flex 
                as="button" 
                align="center" 
                gap="6px" 
                bg="#FFB3C6" 
                color="#900C3F" 
                px="12px" 
                py="6px" 
                borderRadius="md" 
                fontSize="12px" 
                fontWeight="600" 
                cursor="pointer" 
                _hover={{ bg: "#FF8FAB" }} 
                onClick={onRetry}
              >
                <MdRefresh size={14} /> Retry
              </Flex>
            </Box>
          )}



          {/* Inline Verified Checks (Grouped) - INSIDE the bubble */}
          {toolCalls && toolCalls.filter(t => t.status?.toUpperCase() === 'CLEARED').length > 0 && (() => {
            const cleared = toolCalls.filter(t => t.status?.toUpperCase() === 'CLEARED')
            const tipText = cleared.map(t => {
              const agentStr = typeof t.agent === 'string' ? t.agent : (t.agent?.name || 'Agent');
              return `${agentStr.replace(/_/g, ' ')} verified: ${t.detail || 'No issues'}`
            }).join('\n')
            const labelText = cleared.length > 1 ? `${cleared.length} Agents Verified` : `${typeof cleared[0].agent === 'string' ? cleared[0].agent.split('_')[0] : 'system'} verified`
            
            return (
              <Box mt="12px" display="flex">
                <Flex align="center" gap="6px" bg="#F0F7FF" border="1px solid #BEE3F8" borderRadius="100px" px="10px" py="4px" cursor="help" title={tipText}>
                  <CheckmarkBadge01Icon size={12} color="#3182CE" />
                  <Text fontSize="11px" fontWeight="600" color="#3182CE" textTransform="capitalize">
                    {labelText}
                  </Text>
                </Flex>
              </Box>
            )
          })()}

          {/* Model Rotation / Confidence Metadata badge */}
          {confidenceVal && (
            <Flex align="center" gap="6px" mt="12px" borderTop="1px solid #F4F4F5" pt="8px">
              <Text fontSize="10px" color="#A1A1AA" fontWeight="500">
                Confidence: {confidenceVal} · Model: {modelVal || 'gemini-1.5-flash'}
              </Text>
            </Flex>
          )}
        </Box>
      </Flex>

      {/* Floating action controls */}
      {(content || (toolCalls && toolCalls.length > 0)) && (
        <Flex
          direction="row"
          gap="16px"
          mt="4px"
          px="4px"
          alignSelf={isUser ? "flex-end" : "flex-start"}
          sx={{
            '@media (hover: hover)': {
              opacity: 0,
              _groupHover: { opacity: 1 }
            },
            '@media (hover: none)': {
              opacity: 1
            }
          }}
          transition="opacity 0.2s"
        >
          {!isUser && (
            <>
              {/* Thumbs Up */}
              <Box cursor="pointer" title="Good response">
                <MdOutlineThumbUp size={14} color="#A1A1AA" style={{ transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#18181B'} onMouseOut={(e) => e.currentTarget.style.color = '#A1A1AA'} />
              </Box>
              {/* Thumbs Down */}
              <Box cursor="pointer" title="Bad response">
                <MdOutlineThumbDown size={14} color="#A1A1AA" style={{ transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#18181B'} onMouseOut={(e) => e.currentTarget.style.color = '#A1A1AA'} />
              </Box>
            </>
          )}
          {/* Copy Action */}
          <Box cursor="pointer" onClick={handleCopy} title="Copy message text">
            {copied ? <CheckListIcon size={14} color="#117A65" /> : <Copy01Icon size={14} color="#A1A1AA" style={{ transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#18181B'} onMouseOut={(e) => e.currentTarget.style.color = '#A1A1AA'} />}
          </Box>
          {/* Share Action */}
          <Box cursor="pointer" onClick={handleShare} title="Share response">
            {shared ? <CheckListIcon size={14} color="#117A65" /> : <Share01Icon size={14} color="#A1A1AA" style={{ transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#18181B'} onMouseOut={(e) => e.currentTarget.style.color = '#A1A1AA'} />}
          </Box>
          {/* Retry Action */}
          <Box cursor="pointer" onClick={handleRetry} title="Retry response">
            {retried ? <CheckListIcon size={14} color="#117A65" /> : <ReloadIcon size={14} color="#A1A1AA" style={{ transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#18181B'} onMouseOut={(e) => e.currentTarget.style.color = '#A1A1AA'} />}
          </Box>
        </Flex>
      )}

      {/* Timestamp */}
      <Text
        fontSize="10px"
        color="#A1A1AA"
        mt="4px"
        mx="4px"
        fontWeight="500"
      >
        {formatTime(timestamp)}
      </Text>
    </Flex>
  )
}
