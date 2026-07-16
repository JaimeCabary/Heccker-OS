import React from 'react'
import { Box, Flex, Text, Button, Input, VStack } from '@chakra-ui/react'
import { PlayIcon, PauseIcon, SquareIcon } from 'hugeicons-react'

export default function TimerPanel({ timer }) {
  if (!timer) return null
  
  const {
    minutes, setMinutes,
    seconds, setSeconds,
    isActive, setIsActive,
    timeLeft, setTimeLeft,
    isRinging, setIsRinging,
    toggleTimer,
    resetTimer,
    formatTime
  } = timer

  return (
    <VStack spacing="24px" w="full" align="center">
      <Box 
        bg="white" 
        p="32px" 
        borderRadius="2xl" 
        boxShadow="sm" 
        border="1px solid #E4E4E7" 
        w="full" 
        maxW="400px" 
        textAlign="center"
      >
        <img 
          src="/clock.png" 
          alt="Clock" 
          style={{ width: '120px', height: '120px', margin: '0 auto 24px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} 
        />
        
        {isActive || timeLeft > 0 || isRinging ? (
          <Text fontSize="48px" fontWeight="800" color={isRinging ? "#DC2626" : "#18181B"} letterSpacing="-0.04em" mb="24px" className={isRinging ? "pulse-text" : ""}>
            {formatTime(timeLeft)}
          </Text>
        ) : (
          <Flex justify="center" align="center" mb="24px" gap="4px">
            <Input 
              type="tel" 
              value={minutes} 
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))} 
              onBlur={() => setMinutes(minutes.toString().padStart(2, '0'))}
              fontSize="48px" 
              fontWeight="800" 
              color="#18181B" 
              letterSpacing="-0.04em"
              w="90px" 
              px="0"
              textAlign="right"
              variant="unstyled"
              onClick={(e) => e.target.select()}
            />
            <Text fontSize="48px" fontWeight="800" color="#18181B" letterSpacing="-0.04em" pb="6px">:</Text>
            <Input 
              type="tel" 
              value={seconds} 
              onChange={(e) => setSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))} 
              onBlur={() => setSeconds(seconds.toString().padStart(2, '0'))}
              fontSize="48px" 
              fontWeight="800" 
              color="#18181B" 
              letterSpacing="-0.04em"
              w="90px" 
              px="0"
              textAlign="left"
              variant="unstyled"
              onClick={(e) => e.target.select()}
            />
          </Flex>
        )}

        <Flex gap="12px" justify="center">
          <Button 
            colorScheme={isRinging ? "red" : (isActive ? "orange" : "purple")} 
            size="lg" 
            leftIcon={isRinging ? <SquareIcon size={20} /> : (isActive ? <PauseIcon size={20} /> : <PlayIcon size={20} />)}
            onClick={toggleTimer}
            flex="1"
            className={isRinging ? "pulse-button" : ""}
          >
            {isRinging ? "Stop Alarm" : (isActive ? "Pause" : "Start")}
          </Button>
          {!isRinging && (
            <Button 
              variant="outline" 
              size="lg" 
              onClick={resetTimer}
              px="16px"
            >
              <SquareIcon size={20} />
            </Button>
          )}
        </Flex>
      </Box>
    </VStack>
  )
}
