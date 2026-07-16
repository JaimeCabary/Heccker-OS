import React from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { PlusSignIcon, Delete01Icon, Folder01Icon } from 'hugeicons-react'

export default function ShelfPanel({ shelf, onSelectSession, onNewChat, activeSessionId, onDeleteChat }) {
  const { sessions, deleteSession } = shelf

  const handleNewChat = () => {
    if (onNewChat) onNewChat()
  }

  return (
    <Flex direction="column" height="100%">
      {/* Start New Chat Action */}
      <Flex
        align="center"
        justify="center"
        gap="8px"
        bg="#18181B"
        color="#FFFFFF"
        py="12px"
        borderRadius="md"
        cursor="pointer"
        _hover={{ bg: '#27272A' }}
        transition="all 0.1s ease"
        onClick={handleNewChat}
        mb="20px"
        title="Start a brand new chat session"
      >
        <PlusSignIcon size={16} strokeWidth={2} />
        <Text fontSize="12px" fontWeight="600">
          New Chat
        </Text>
      </Flex>

      {/* Header */}
      <Text fontSize="13px" fontWeight="700" color="#71717A" mb="12px" letterSpacing="0.05em">
        PAST CHATS
      </Text>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <Flex direction="column" align="center" justify="center" flex="1" py="40px" textAlign="center">
          <Box as="img" src="/boy-work.png" alt="No sessions" w="100px" mx="auto" />
          <Text fontSize="12px" color="#A1A1AA" mt="8px" fontWeight="500">
            No saved sessions yet.
          </Text>
        </Flex>
      ) : (
        <Flex direction="column" gap="8px" overflowY="auto" maxH="calc(100vh - 220px)">
          {sessions.map((session) => {
            const isActive = activeSessionId === session.id
            return (
              <Flex
                key={session.id}
                align="center"
                justify="space-between"
                bg={isActive ? '#EDE9FF' : '#FFFFFF'}
                border="1px solid"
                borderColor={isActive ? '#C4B5FD' : '#E4E4E7'}
                p="12px 14px"
                borderRadius="md"
                cursor="pointer"
                _hover={isActive ? {} : { bg: '#FAFAFA', borderColor: '#18181B' }}
                transition="all 0.1s ease"
                onClick={() => onSelectSession && onSelectSession(session.id)}
                title={`Open chat: "${session.title}"`}
              >
                <Text
                  fontSize="12px"
                  fontWeight={isActive ? "700" : "500"}
                  color={isActive ? '#18181B' : '#71717A'}
                  noOfLines={1}
                  flex="1"
                  mr="12px"
                >
                  {session.title}
                </Text>
                <Box
                  cursor="pointer"
                  color="#A1A1AA"
                  _hover={{ color: '#C70039' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onDeleteChat) onDeleteChat(session.id)
                    else deleteSession(session.id)
                  }}
                  title="Delete chat session"
                >
                  <Delete01Icon size={12} strokeWidth={2} />
                </Box>
              </Flex>
            )
          })}
        </Flex>
      )}
    </Flex>
  )
}
