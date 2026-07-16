import React, { useRef, useEffect, useState } from 'react'
import { Box, Flex, Text, Textarea, Grid, GridItem, Image } from '@chakra-ui/react'
import {
  ArrowRight01Icon,
  Shield01Icon,
  ShoppingBag01Icon,
  Calendar01Icon,
  Folder01Icon,
  Brain01Icon,
  Attachment01Icon,
  Delete01Icon
} from 'hugeicons-react'
import Message from './Message'
import TextareaAutosize from 'react-textarea-autosize'

export default function ChatArea({
  messages,
  isStreaming,
  sendMessage,
  retryMessage,
  storageHooks,
  artifactsList
}) {
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState([])
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if ((!input.trim() && attachedFiles.length === 0) || isStreaming) return
    
    // In a fully integrated production app, the backend receives file content.
    // For now we pass the input alongside multimodal text markers.
    let finalText = input
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => f.name).join(', ')
      finalText += `\n\n[Attached Files: ${fileNames}]`
    }

    sendMessage(finalText, storageHooks)
    setInput('')
    setAttachedFiles([])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newAttachments = files.map(file => ({
      file,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file)
    }))

    setAttachedFiles(prev => [...prev, ...newAttachments])
    e.target.value = null
  }

  const handleRemoveFile = (indexToRemove) => {
    setAttachedFiles(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[indexToRemove].url)
      updated.splice(indexToRemove, 1)
      return updated
    })
  }



  return (
    <Flex height="100%" direction="column" bg="#FFFFFF" overflow="hidden">
      {/* Scrollable chat messages container */}
      <Box flex="1" overflowY="auto" p={{ base: '24px', md: '48px' }} bg="#FAFAFA">
        {messages.length === 0 ? (
          <Flex direction="column" align="center" justify="center" minH="100%" textAlign="center" py="20px">
            <Box mb="20px">
              <Box as="img" src="/girl-work.png" alt="Heccker AI" w="160px" mx="auto" />
            </Box>

            <Flex justify="center" align="center" wrap="wrap" gap="6px" mb="12px">
              <Text fontSize="20px" fontWeight="500" color="#18181B" letterSpacing="-0.02em">
                What can I help
              </Text>
              <Text fontSize="20px" fontWeight="500" color="#A1A1AA" letterSpacing="-0.02em">
                with today?
              </Text>
            </Flex>

            <Text fontSize="13px" color="#71717A" maxW="400px" mb="40px" lineHeight="1.6" fontWeight="400">
              Heccker handles platform security scanning, stages shopping carts, manages calendar events, and automates workspace operations.
            </Text>
          </Flex>
        ) : (
          <Flex direction="column" gap="18px">
            {messages.map((m) => (
              <Message key={m.id} {...m} onRetry={retryMessage ? () => retryMessage(m.id, storageHooks) : undefined} artifactsList={artifactsList} />
            ))}
          </Flex>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Footer message input container */}
      <Box
        p="20px"
        pb={{ base: 'calc(20px + env(safe-area-inset-bottom, 0px))', md: '20px' }}
        borderTop="1px solid #E4E4E7"
        bg="#FFFFFF"
      >
        <Flex
          maxW="820px"
          mx="auto"
          direction="column"
          bg="#FAFAFA"
          border="1px solid #E4E4E7"
          borderRadius="md"
          p="8px 12px"
          _focusWithin={{ borderColor: '#18181B', bg: '#FFFFFF' }}
          transition="all 0.1s ease"
        >
          {/* File Upload Hidden Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            style={{ display: 'none' }}
          />

          {/* Attached Files Thumbnail Previews */}
          {attachedFiles.length > 0 && (
            <Flex gap="8px" flexWrap="wrap" mb="8px" borderBottom="1px solid #E4E4E7" pb="8px">
              {attachedFiles.map((file, idx) => (
                <Box
                  key={idx}
                  position="relative"
                  borderRadius="sm"
                  overflow="hidden"
                  border="1px solid #E4E4E7"
                  boxSize="60px"
                  bg="#FFFFFF"
                >
                  {file.type.startsWith('image/') ? (
                    <Image src={file.url} alt="attached" boxSize="100%" objectFit="cover" />
                  ) : (
                    <Flex align="center" justify="center" h="100%" p="4px" textAlign="center">
                      <Text fontSize="8px" color="#71717A" wordBreak="break-all" fontWeight="600">
                        {file.name}
                      </Text>
                    </Flex>
                  )}
                  <Box
                    position="absolute"
                    top="2px"
                    right="2px"
                    bg="#FDEDEC"
                    borderRadius="full"
                    p="2px"
                    cursor="pointer"
                    onClick={() => handleRemoveFile(idx)}
                    title="Remove file"
                  >
                    <Delete01Icon size={10} color="#900C3F" />
                  </Box>
                </Box>
              ))}
            </Flex>
          )}

          <Flex align="center">
            {/* Attachment Button */}
            <Box
              cursor="pointer"
              color="#71717A"
              _hover={{ color: '#18181B' }}
              p="8px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              title="Attach multimodal image or file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Attachment01Icon size={18} strokeWidth={1.5} />
            </Box>

            <Textarea
              as={TextareaAutosize}
              minRows={1}
              maxRows={8}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Heccker anything..."
              resize="none"
              variant="unstyled"
              fontSize="13px"
              color="#18181B"
              flex="1"
              py="6px"
              px="8px"
            />

            <Box
              cursor={(input.trim() || attachedFiles.length > 0) ? "pointer" : "default"}
              color={(input.trim() || attachedFiles.length > 0) ? "#18181B" : "#A1A1AA"}
              onClick={handleSend}
              p="8px"
              _hover={(input.trim() || attachedFiles.length > 0) ? { color: '#09090B' } : {}}
              transition="all 0.1s ease"
              display="flex"
              alignItems="center"
              justifyContent="center"
              title="Send message (Enter)"
            >
              <ArrowRight01Icon size={18} strokeWidth={2.5} />
            </Box>
          </Flex>
        </Flex>
      </Box>
    </Flex>
  )
}
