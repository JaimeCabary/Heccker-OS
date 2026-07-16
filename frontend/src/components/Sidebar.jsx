import React, { useState } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import {
  ShoppingBag01Icon,
  Calendar01Icon,
  CheckListIcon,
  Folder01Icon,
  Audit01Icon,
  Settings01Icon,
} from 'hugeicons-react'
import CartPanel from './CartPanel'
import CalendarPanel from './CalendarPanel'
import TodoPanel from './TodoPanel'
import ShelfPanel from './ShelfPanel'
import ArtifactPanel from './ArtifactPanel'
import AuditPanel from './AuditPanel'
import SettingsPanel from './SettingsPanel'

export default function Sidebar({ cart, calendar, todos, shelf, artifacts, timer, calendarView, setCalendarView, activeDesktopTab, setActiveDesktopTab, auditLogs = [], _user, onSelectSession, onNewChat, onDeleteChat }) {
  const tabs = [
    { id: 'cart',     label: 'Cart',     icon: <ShoppingBag01Icon size={15} />, tooltip: 'Staged purchases' },
    { id: 'calendar', label: 'Calendar', icon: <Calendar01Icon size={15} />,    tooltip: 'Upcoming events' },
    { id: 'todos',    label: 'Todos',    icon: <CheckListIcon size={15} />,     tooltip: 'Developer checklist' },
    { id: 'shelf',    label: 'Chats',    icon: <Folder01Icon size={15} />,      tooltip: 'Chat history' },
  ]

  return (
    <Flex direction="column" h={{ base: 'calc(100vh - 60px)', lg: 'full' }} bg="#FFFFFF" overflow="hidden">
      {/* Tabs */}
      <Flex borderBottom="1px solid #E4E4E7" px="12px" height="52px" align="center" gap="4px" flexWrap="wrap">
        {tabs.map((tab) => {
          const isActive = activeDesktopTab === tab.id
          const hasAlert = tab.id === 'audit' && auditLogs.length > 0
          return (
            <Flex
              key={tab.id}
              flex="1"
              justify="center"
              align="center"
              gap="4px"
              cursor="pointer"
              px="7px"
              py="6px"
              borderRadius="6px"
              onClick={() => setActiveDesktopTab(tab.id)}
              title={tab.tooltip}
              bg={isActive ? '#F4F4F5' : 'transparent'}
              transition="all 0.1s ease"
              position="relative"
            >
              {React.cloneElement(tab.icon, {
                color: isActive ? '#18181B' : '#71717A',
                strokeWidth: isActive ? 2 : 1.5
              })}
              <Text
                fontSize="11px"
                fontWeight={isActive ? '700' : '500'}
                color={isActive ? '#18181B' : '#71717A'}
              >
                {tab.label}
              </Text>
              {/* Live badge on Log tab */}
              {hasAlert && tab.id === 'audit' && activeDesktopTab !== 'audit' && (
                <Box
                  position="absolute"
                  top="4px"
                  right="2px"
                  w="6px"
                  h="6px"
                  borderRadius="full"
                  bg="#22C55E"
                />
              )}
            </Flex>
          )
        })}
      </Flex>

      {/* Panel Content */}
      <Box flex="1" overflowY="auto" p="20px">
        {activeDesktopTab === 'cart'     && <CartPanel cart={cart} />}
        {activeDesktopTab === 'calendar' && <CalendarPanel calendar={calendar} timer={timer} view={calendarView} setView={setCalendarView} />}
        {activeDesktopTab === 'todos'    && <TodoPanel todos={todos} />}
        {activeDesktopTab === 'shelf'    && (
          <ShelfPanel
            shelf={shelf}
            onSelectSession={onSelectSession}
            onNewChat={onNewChat}
            onDeleteChat={onDeleteChat}
            activeSessionId={shelf.activeSessionId}
          />
        )}
      </Box>
    </Flex>
  )
}
