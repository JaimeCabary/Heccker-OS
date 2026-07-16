import React, { useState } from 'react'
import { Box, Flex, Text, Tooltip, Grid, GridItem } from '@chakra-ui/react'
import { Calendar01Icon, Delete02Icon, ArrowLeft01Icon, ArrowRight01Icon } from 'hugeicons-react'

import TimerPanel from './TimerPanel'

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPanel({ calendar, timer, view, setView }) {
  const { events, removeEvent, parseGoogleDate } = calendar
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  
  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  const getEventsForDay = (day) => {
    if (!day) return []
    return events.filter(e => {
      const eDate = parseGoogleDate(e.date_time)
      return eDate.getFullYear() === year && eDate.getMonth() === month && eDate.getDate() === day
    })
  }

  const selectedEvents = events.filter(e => {
    const eDate = parseGoogleDate(e.date_time)
    return eDate.getFullYear() === selectedDate.getFullYear() && eDate.getMonth() === selectedDate.getMonth() && eDate.getDate() === selectedDate.getDate()
  })

  return (
    <Flex direction="column" gap="14px">
      <Flex bg="#F4F4F5" p="4px" borderRadius="full" mb="8px">
        <Flex 
          flex="1" justify="center" py="6px" borderRadius="full" cursor="pointer"
          bg={view === 'calendar' ? '#FFFFFF' : 'transparent'} 
          boxShadow={view === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}
          onClick={() => setView('calendar')}
        >
          <Text fontSize="13px" fontWeight="600" color={view === 'calendar' ? '#18181B' : '#71717A'}>Schedule</Text>
        </Flex>
        <Flex 
          flex="1" justify="center" py="6px" borderRadius="full" cursor="pointer"
          bg={view === 'timer' ? '#FFFFFF' : 'transparent'} 
          boxShadow={view === 'timer' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}
          onClick={() => setView('timer')}
        >
          <Text fontSize="13px" fontWeight="600" color={view === 'timer' ? '#18181B' : '#71717A'}>Timer</Text>
        </Flex>
      </Flex>

      {view === 'timer' ? (
        <TimerPanel timer={timer} />
      ) : (
        <Flex direction="column" gap="14px">
      {/* Calendar Header */}
      <Flex align="center" justify="space-between" bg="#FFFFFF" p="12px" borderRadius="md" border="1px solid #E4E4E7">
        <Box cursor="pointer" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} _hover={{ color: '#059669' }}>
          <ArrowLeft01Icon size={16} />
        </Box>
        <Text fontSize="14px" fontWeight="700" color="#18181B">
          {monthNames[month]} {year}
        </Text>
        <Box cursor="pointer" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} _hover={{ color: '#059669' }}>
          <ArrowRight01Icon size={16} />
        </Box>
      </Flex>

      {/* Grid */}
      <Box bg="#FFFFFF" p="12px" borderRadius="md" border="1px solid #E4E4E7">
        <Grid templateColumns="repeat(7, 1fr)" gap="4px" mb="8px" textAlign="center">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <GridItem key={d}>
              <Text fontSize="10px" fontWeight="700" color="#A1A1AA">{d}</Text>
            </GridItem>
          ))}
        </Grid>
        <Grid templateColumns="repeat(7, 1fr)" gap="4px">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day)
            const hasEvents = dayEvents.length > 0
            const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
            
            let itemBg = 'transparent'
            let itemColor = '#18181B'
            let itemHover = '#F4F4F5'

            if (isToday) {
              itemBg = '#059669'
              itemColor = 'white'
              itemHover = '#047857'
            } else if (isSelected) {
              itemBg = 'rgba(24,24,27,0.1)'
              itemColor = '#059669'
              itemHover = 'rgba(24,24,27,0.05)'
            } else if (hasEvents) {
              itemBg = '#ECFDF5'
              itemColor = '#059669'
              itemHover = '#D1FAE5'
            }

            return (
              <GridItem key={idx}>
                {day ? (
                  <Box title={hasEvents ? `${dayEvents.length} event(s)` : ''}>
                    <Flex
                      direction="column" align="center" justify="center" h="32px" w="full"
                      borderRadius="md" cursor="pointer"
                      bg={itemBg}
                      color={itemColor}
                      fontWeight={isToday || isSelected || hasEvents ? '700' : '500'}
                      _hover={{ bg: itemHover }}
                      onClick={() => setSelectedDate(new Date(year, month, day))}
                    >
                      <Text fontSize="12px">{day}</Text>
                      {hasEvents && <Box w="4px" h="4px" bg={isToday ? "white" : "#059669"} borderRadius="full" mt="2px" />}
                    </Flex>
                  </Box>
                ) : <Box h="32px" />}
              </GridItem>
            )
          })}
        </Grid>
      </Box>

      {/* Selected Day Events */}
      <Text fontSize="12px" fontWeight="700" color="#18181B" mt="8px">
        Events for {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}
      </Text>
      <Flex direction="column" gap="8px">
        {selectedEvents.length === 0 ? (
          <Flex direction="column" align="center" justify="center" py="16px" textAlign="center">
            <Box as="img" src="/clock.png" alt="No events" w="60px" opacity="0.8" mb="8px" />
            <Text fontSize="12px" color="#A1A1AA">No events scheduled.</Text>
          </Flex>
        ) : (
          selectedEvents.map(ev => (
            <Box key={ev.id} bg="#FFFFFF" border="1px solid #E4E4E7" borderRadius="sm" p="12px" position="relative">
              <Flex direction="column" gap="4px" pr="20px">
                <Text fontSize="11px" fontWeight="700" color="#71717A">
                  {parseGoogleDate(ev.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text fontSize="12px" fontWeight="700" color="#18181B">{ev.title}</Text>
              </Flex>
              <Box position="absolute" top="12px" right="12px" cursor="pointer" color="#DEE2E6" _hover={{ color: '#DC2626' }} onClick={() => removeEvent(ev.id)}>
                <Delete02Icon size={12} />
              </Box>
            </Box>
          ))
        )}
      </Flex>
      </Flex>
      )}
    </Flex>
  )
}
