import React from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { Audit01Icon, Activity01Icon, Alert01Icon, SecurityCheckIcon, CheckmarkCircle02Icon } from 'hugeicons-react'
import BackButton from './BackButton'

const AGENT_CONFIG = {
  security_agent: { bg: '#FFF1F2', text: '#BE123C', label: 'Security', icon: SecurityCheckIcon },
  shopping_agent:  { bg: '#F0FDF4', text: '#15803D', label: 'Shopping', icon: CheckmarkCircle02Icon },
  concierge_agent: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Concierge', icon: Activity01Icon },
  os_agent:        { bg: '#FFF7ED', text: '#C2410C', label: 'OS', icon: Activity01Icon },
  root_agent:      { bg: '#F5F3FF', text: '#6D28D9', label: 'Orchestrator', icon: Activity01Icon },
  user:            { bg: '#F9FAFB', text: '#374151', label: 'User', icon: Activity01Icon },
  system:          { bg: '#F9FAFB', text: '#6B7280', label: 'System', icon: Activity01Icon },
  error:           { bg: '#FFF1F2', text: '#BE123C', label: 'Error', icon: Alert01Icon },
}

function LogEntry({ log, isLast }) {
  const c = AGENT_CONFIG[log.tag] || AGENT_CONFIG.system
  const Icon = c.icon

  return (
    <Flex gap="16px" position="relative">
      {/* Timeline Line */}
      {!isLast && (
        <Box 
          position="absolute" 
          left="15px" 
          top="32px" 
          bottom="-12px" 
          w="2px" 
          bg="#F4F4F5" 
          zIndex={0}
        />
      )}

      {/* Timeline Icon */}
      <Flex 
        w="32px" 
        h="32px" 
        borderRadius="full" 
        bg={c.bg} 
        align="center" 
        justify="center" 
        flexShrink={0}
        zIndex={1}
        border="2px solid white"
        boxShadow="0 0 0 1px #E4E4E7"
      >
        <Icon size={14} color={c.text} strokeWidth={2} />
      </Flex>

      {/* Log Content Card */}
      <Flex direction="column" flex="1" pb="24px">
        <Flex align="center" gap="8px" mb="4px">
          <Text fontSize="13px" fontWeight="600" color="#18181B">
            {c.label}
          </Text>
          <Text fontSize="12px" color="#A1A1AA">
            {log.time}
          </Text>
        </Flex>
        
        <Box 
          bg="white" 
          border="1px solid #E4E4E7" 
          borderRadius="lg" 
          p="12px 16px"
          boxShadow="0 1px 2px rgba(0,0,0,0.02)"
        >
          <Text fontSize="13px" color="#3F3F46" lineHeight="1.6" wordBreak="break-word">
            {log.msg}
          </Text>
        </Box>
      </Flex>
    </Flex>
  )
}

export default function AuditPanel({ logs = [], onGoBack }) {
  if (logs.length === 0) {
    return (
      <Flex justify="center" w="full" h="full" bg="#FAFAFA" pt="40px" pb={{ base: '120px', md: '60px' }} px={{ base: '16px', md: '0' }} overflowY="auto" fontFamily="'Cera Round Pro', sans-serif">
        <Flex direction="column" maxW="700px" w="full" position="relative" align="center" justify="center" h="100%" minH="400px" textAlign="center">
          
          <Box position="absolute" top="0" left="0">
            <BackButton onClick={onGoBack} mb="0" />
          </Box>

          <Box mb="16px" p="16px" bg="#F4F4F5" borderRadius="full">
            <Audit01Icon size={32} color="#A1A1AA" strokeWidth={1.5} />
          </Box>
          <Text fontSize="16px" fontWeight="600" color="#18181B">System is Quiet</Text>
          <Text fontSize="14px" color="#71717A" mt="8px" maxW="280px" lineHeight="1.5">
            Events will appear here as the swarm agents act — executing security checks, tracking tools, and managing carts.
          </Text>
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex direction="column" w="full" h="full" bg="#FAFAFA" fontFamily="'Cera Round Pro', sans-serif">
      
      {/* Fixed Full-Width Header */}
      <Flex w="full" bg="#FFFFFF" borderBottom="1px solid #E4E4E7" p="16px" justify="center" flexShrink={0}>
        <Flex maxW="600px" w="full" align="center" gap="12px">
          <BackButton onClick={onGoBack} mb="0" />
          <Text fontSize="20px" fontWeight="700" color="#18181B" letterSpacing="-0.02em">Audit Logs</Text>
        </Flex>
      </Flex>

      {/* Scrollable Content */}
      <Flex flex="1" overflowY="auto" justify="center" px={{ base: '16px', md: '0' }}>
        <Flex direction="column" gap="24px" maxW="600px" w="full" pt="48px" pb="32px">
        
        <Flex align="center" justify="space-between" mb="32px">
          <Flex direction="column" gap="4px">
            <Text fontSize="14px" color="#71717A">
              Real-time audit trail of all swarm activity.
            </Text>
          </Flex>
          <Flex align="center" gap="6px" bg="#DCFCE7" px="10px" py="4px" borderRadius="full">
            <Box w="6px" h="6px" borderRadius="full" bg="#22C55E" className="animate-pulse" />
            <Text fontSize="11px" color="#166534" fontWeight="700" letterSpacing="0.05em">LIVE</Text>
          </Flex>
        </Flex>

        <Flex direction="column" position="relative">
          {[...logs].reverse().map((log, i) => (
            <LogEntry key={i} log={log} isLast={i === logs.length - 1} />
          ))}
        </Flex>

        </Flex>
      </Flex>
    </Flex>
  )
}
