import React from 'react'
import { Flex, Box, Text } from '@chakra-ui/react'
import { Message02Icon, ShoppingBag01Icon, Audit01Icon, Settings01Icon, Folder01Icon, Calendar01Icon, CheckListIcon } from 'hugeicons-react'

export default function MobileNavBar({ 
  cartCount, 
  currentScreen,
  onOpenLogs, 
  onOpenSettings, 
  onGoHome,
  onOpenShelf,
  onOpenCart,
  onOpenCalendar,
  onOpenTodos,
  onOpenArtifacts,
  onNewChat
}) {
  return (
    <Flex
      display={{ base: 'flex', md: 'none' }}
      position="fixed"
      bottom="max(24px, env(safe-area-inset-bottom, 0px))"
      left="0"
      right="0"
      justify="center"
      align="center"
      gap="12px"
      zIndex="1000"
      pointerEvents="none"
    >
      {/* Pill 1: App Features (Light Vibe) */}
      <Flex 
        pointerEvents="auto"
        bg="rgba(255, 255, 255, 0.85)"
        backdropFilter="blur(12px)"
        borderRadius="full"
        px="6px"
        py="6px"
        align="center"
        gap="4px"
        boxShadow="0 8px 32px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.5)"
        border="1px solid rgba(24,24,27,0.05)"
      >
        <Flex 
          onClick={onOpenShelf}
          cursor="pointer"
          w="40px"
          h="40px"
          borderRadius="full"
          align="center"
          justify="center"
          bg={currentScreen === 'shelf' ? 'rgba(24,24,27,0.1)' : 'transparent'}
          _hover={{ bg: 'rgba(24,24,27,0.05)' }}
          transition="all 0.2s"
          title="Chat History"
        >
          <Folder01Icon size={20} color={currentScreen === 'shelf' ? '#059669' : '#18181B'} strokeWidth={1.5} />
        </Flex>

        <Flex 
          onClick={onOpenCalendar}
          cursor="pointer"
          w="40px"
          h="40px"
          borderRadius="full"
          align="center"
          justify="center"
          bg={currentScreen === 'calendar' ? 'rgba(24,24,27,0.1)' : 'transparent'}
          _hover={{ bg: 'rgba(24,24,27,0.05)' }}
          transition="all 0.2s"
          title="Calendar"
        >
          <Calendar01Icon size={20} color={currentScreen === 'calendar' ? '#059669' : '#18181B'} strokeWidth={1.5} />
        </Flex>

        <Flex 
          onClick={onOpenTodos}
          cursor="pointer"
          w="40px"
          h="40px"
          borderRadius="full"
          align="center"
          justify="center"
          bg={currentScreen === 'todos' ? 'rgba(24,24,27,0.1)' : 'transparent'}
          _hover={{ bg: 'rgba(24,24,27,0.05)' }}
          transition="all 0.2s"
          title="Todos"
        >
          <CheckListIcon size={20} color={currentScreen === 'todos' ? '#059669' : '#18181B'} strokeWidth={1.5} />
        </Flex>
      </Flex>

      {/* Pill 2: Main Action (Dark Vibe) */}
      <Flex 
        pointerEvents="auto"
        bg="rgba(24, 24, 27, 0.85)"
        backdropFilter="blur(12px)"
        borderRadius="full"
        px="6px"
        py="6px"
        align="center"
        gap="4px"
        boxShadow="0 8px 32px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.1)"
        border="1px solid rgba(255,255,255,0.1)"
      >
        <Flex 
          onClick={onGoHome}
          onDoubleClick={onNewChat}
          cursor="pointer"
          w="40px"
          h="40px"
          borderRadius="full"
          align="center"
          justify="center"
          bg={currentScreen === 'chat' ? 'rgba(255,255,255,0.15)' : 'transparent'}
          _hover={{ bg: 'rgba(255,255,255,0.1)' }}
          transition="all 0.2s"
          title="Chat"
        >
          <Message02Icon size={20} color={currentScreen === 'chat' ? '#A3E4D7' : '#FFFFFF'} strokeWidth={1.5} />
        </Flex>
      </Flex>

      {/* Pill 3: System & Cart (Off-white / Gray Vibe) */}
      <Flex 
        pointerEvents="auto"
        bg="rgba(244, 244, 245, 0.85)"
        backdropFilter="blur(12px)"
        borderRadius="full"
        px="6px"
        py="6px"
        align="center"
        gap="4px"
        boxShadow="0 8px 32px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.8)"
        border="1px solid rgba(24,24,27,0.08)"
      >
        <Flex 
          onClick={onOpenCart}
          cursor="pointer"
          w="40px"
          h="40px"
          borderRadius="full"
          align="center"
          justify="center"
          position="relative"
          bg={currentScreen === 'cart' ? 'rgba(24,24,27,0.1)' : 'transparent'}
          _hover={{ bg: 'rgba(24,24,27,0.05)' }}
          transition="all 0.2s"
          title="Cart"
        >
          <ShoppingBag01Icon size={20} color={currentScreen === 'cart' ? '#059669' : '#18181B'} strokeWidth={1.5} />
          {cartCount > 0 && (
            <Flex 
              position="absolute"
              top="4px"
              right="4px"
              bg="#22C55E"
              w="14px"
              h="14px"
              borderRadius="full"
              align="center"
              justify="center"
              border="2px solid #FFFFFF"
            >
              <Text fontSize="8px" fontWeight="800" color="white">{cartCount}</Text>
            </Flex>
          )}
        </Flex>

        <Flex 
          onClick={onOpenLogs}
          cursor="pointer"
          w="40px"
          h="40px"
          borderRadius="full"
          align="center"
          justify="center"
          bg={currentScreen === 'logs' ? 'rgba(24,24,27,0.1)' : 'transparent'}
          _hover={{ bg: 'rgba(24,24,27,0.05)' }}
          transition="all 0.2s"
          title="Logs"
        >
          <Audit01Icon size={20} color={currentScreen === 'logs' ? '#059669' : '#18181B'} strokeWidth={1.5} />
        </Flex>

        <Flex 
          onClick={onOpenSettings}
          cursor="pointer"
          w="40px"
          h="40px"
          borderRadius="full"
          align="center"
          justify="center"
          bg={currentScreen === 'settings' ? 'rgba(24,24,27,0.1)' : 'transparent'}
          _hover={{ bg: 'rgba(24,24,27,0.05)' }}
          transition="all 0.2s"
          title="Settings"
        >
          <Settings01Icon size={20} color={currentScreen === 'settings' ? '#059669' : '#18181B'} strokeWidth={1.5} />
        </Flex>
      </Flex>
    </Flex>
  )
}
