import React from 'react'
import { Box, Flex, Text, Image } from '@chakra-ui/react'
import {
  Shield01Icon,
  Coins01Icon,
  ShoppingBag01Icon,
  Audit01Icon,
  Settings01Icon,
  Folder01Icon,
  Calendar01Icon,
  CheckListIcon
} from 'hugeicons-react'

export default function Header({ 
  cartCount, 
  backendOk, 
  sessionCost = 0.00, 
  onOpenSettings, 
  onOpenLogs, 
  hasNewLogs,
  onOpenArtifacts,
  hasArtifacts
}) {
  let dotColor = '#DEE2E6'
  let statusTextColor = '#71717A'
  let statusText = 'Connecting'

  if (backendOk === true) {
    dotColor = '#A3E4D7'
    statusTextColor = '#117A65'
    statusText = 'Live'
  } else if (backendOk === false) {
    dotColor = '#F1948A'
    statusTextColor = '#900C3F'
    statusText = 'Offline'
  }

  return (
    <Box
      as="header"
      height="60px"
      bg="#FFFFFF"
      borderBottom="1px solid #E4E4E7"
      px={{ base: '12px', md: '24px' }}
      display="flex"
      alignItems="center"
      justifyContent="space-between"
    >
      <Flex 
        align="center" 
        gap={{ base: '10px', md: '12px' }} 
        title="Heccker OS Swarm"
        cursor="pointer"
        transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
        _hover={{ opacity: 0.8, transform: 'scale(1.02)' }}
      >
        <Image
          src="/logo.png"
          alt="Heccker OS Logo"
          boxSize={{ base: '26px', md: '32px' }}
          objectFit="contain"
          filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.08))"
        />
        <Text 
          fontSize={{ base: '18px', md: '22px' }} 
          fontWeight="800" 
          color="#18181B" 
          letterSpacing="-0.03em"
        >
          Heccker OS
        </Text>
      </Flex>

      <Flex align="center" gap={{ base: '12px', md: '20px' }}>
        {/* Desktop Quick Nav Tabs */}
        <Flex display={{ base: 'none', md: 'flex' }} gap="16px" align="center" mr="12px">
          
          <Flex cursor="pointer" onClick={onOpenLogs} align="center" gap="6px" position="relative" _hover={{ color: '#18181B' }} title="Live agent event log">
            <Audit01Icon size={16} color="#71717A" />
            <Text fontSize="13px" fontWeight="500" color="#71717A">Log</Text>
            {hasNewLogs && <Box position="absolute" top="-2px" left="-2px" w="6px" h="6px" borderRadius="full" bg="#22C55E" />}
          </Flex>
          
          {hasArtifacts && (
            <Flex cursor="pointer" onClick={onOpenArtifacts} align="center" gap="4px" px="4px" _hover={{ color: '#18181B' }} title="Generated documents">
              <Folder01Icon size={16} color="#71717A" />
              <Text fontSize="13px" fontWeight="500" color="#71717A">Docs</Text>
            </Flex>
          )}
          
          <Flex cursor="pointer" onClick={onOpenSettings} align="center" gap="6px" _hover={{ color: '#18181B' }} title="API keys and preferences">
            <Settings01Icon size={16} color="#71717A" />
            <Text fontSize="13px" fontWeight="500" color="#71717A">Settings</Text>
          </Flex>

        </Flex>

        {/* Cost Tracker */}
        <Flex
          align="center"
          gap="6px"
          title={`Session Budget Consumed`}
        >
          <Coins01Icon size={14} color="#71717A" strokeWidth={1.5} />
          <Text fontSize="11px" fontWeight="500" color="#71717A">
            ${sessionCost.toFixed(3)}
          </Text>
        </Flex>

        {/* Staged Cart Items Count */}
        {cartCount > 0 && (
          <Flex
            display={{ base: 'none', md: 'flex' }}
            align="center"
            gap="6px"
            title={`${cartCount} items staged in shopping cart`}
          >
            <ShoppingBag01Icon size={14} color="#71717A" strokeWidth={1.5} />
            <Text fontSize="11px" fontWeight="500" color="#71717A">
              Cart: {cartCount}
            </Text>
          </Flex>
        )}

        {/* Swarm State Indicator */}
        <Flex
          align="center"
          gap="6px"
          title={`Swarm connection status: ${statusText}`}
        >
          <Box w="6px" h="6px" borderRadius="full" bg={dotColor} />
          <Text fontSize="11px" fontWeight="500" color={statusTextColor} display={{ base: 'none', md: 'block' }}>
            {statusText}
          </Text>
        </Flex>
      </Flex>
    </Box>
  )
}
