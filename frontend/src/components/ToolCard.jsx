import React, { useState } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import {
  Shield01Icon,
  ShoppingBag01Icon,
  Folder01Icon,
  Calendar01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Settings01Icon
} from 'hugeicons-react'

export default function ToolCard({ agent, status, detail, tool }) {
  const [isOpen, setIsOpen] = useState(false)

  let colors = {
    bg: '#FFFFFF',
    border: '#E4E4E7',
    text: '#18181B',
    icon: <Settings01Icon size={14} color="#71717A" />
  }

  const agentString = typeof agent === 'string' ? agent : (agent?.name || 'system')

  if (agentString === 'security_agent') {
    colors.icon = <Shield01Icon size={14} color="#71717A" />
  } else if (agentString === 'shopping_agent') {
    colors.icon = <ShoppingBag01Icon size={14} color="#71717A" />
  } else if (agentString === 'os_agent') {
    colors.icon = <Folder01Icon size={14} color="#71717A" />
  } else if (agentString === 'concierge_agent') {
    colors.icon = <Calendar01Icon size={14} color="#71717A" />
  }

  const agentLabel = agentString
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())

  let label = agentLabel
  // Use explicitly provided tool name if available (passed from the backend SSE event)
  const toolNameProp = tool;
  if (toolNameProp) {
    label = toolNameProp.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  } else if (detail && typeof detail === 'string' && detail.includes('called')) {
    const fnName = detail.split(' called')[0].replace(/_/g, ' ')
    label = fnName.replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <Box
      bg={colors.bg}
      border={`1px solid ${colors.border}`}
      borderRadius="sm"
      p="8px 12px"
      cursor="pointer"
      onClick={() => setIsOpen(!isOpen)}
      transition="all 0.1s ease"
    >
      <Flex align="center" justify="space-between">
        <Flex align="center" gap="8px">
          {colors.icon}
          <Text fontSize="11px" fontWeight="700" color="#18181B">
            {label}
          </Text>
          <Box
            bg="#FAFAFA"
            border="1px solid #E4E4E7"
            px="6px"
            py="1px"
            borderRadius="sm"
          >
            <Text
              fontSize="8px"
              fontWeight="800"
              color="#71717A"
              textTransform="uppercase"
            >
              {status || 'running'}
            </Text>
          </Box>
        </Flex>

        {isOpen ? (
          <ArrowUp01Icon size={12} color="#71717A" />
        ) : (
          <ArrowDown01Icon size={12} color="#71717A" />
        )}
      </Flex>

      {isOpen && detail && (
        <Box mt="6px" pt="6px" borderTop={`1px dashed ${colors.border}`}>
          <Text fontSize="11px" fontWeight="500" color="#71717A" whiteSpace="pre-wrap" lineHeight="1.4">
            {detail}
          </Text>
        </Box>
      )}
    </Box>
  )
}
