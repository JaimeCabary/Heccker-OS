import React from 'react'
import { Box, Flex, Text, Button } from '@chakra-ui/react'
import { motion } from 'framer-motion'

export default function LockScreen({ reason, onUnlock }) {
  const isSleep = reason === 'sleep' || reason === 'bedtime'

  const imageSrc = isSleep ? '/sleep.png' : '/tired.png'
  const title = isSleep ? 'Time for Bed' : 'System Locked: Overstressed'
  const subtitle = isSleep 
    ? "It's past your hard stop. Heccker-OS is locked so you don't stay up all night hyperfocusing. Go to sleep!" 
    : "You've been working too hard. Step away from the screen, stretch, and take a breather."

  return (
    <motion.div
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(24, 24, 27, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '24px'
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.4 }}
      >
        <Flex
          direction="column"
          align="center"
          bg="white"
          p="40px"
          borderRadius="24px"
          maxW="480px"
          w="full"
          boxShadow="0 25px 50px -12px rgba(0,0,0,0.5)"
          textAlign="center"
        >
          <img 
            src={imageSrc} 
            alt="Lock Screen Vector" 
            style={{ width: '200px', height: '200px', objectFit: 'contain', marginBottom: '24px', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.1))' }} 
          />
          <Text fontSize="28px" fontWeight="800" color="#18181B" mb="12px" letterSpacing="-0.03em">
            {title}
          </Text>
          <Text fontSize="16px" color="#52525B" mb="32px" lineHeight="1.6">
            {subtitle}
          </Text>
          <Button 
            size="lg" 
            w="full" 
            h="56px"
            bg="#18181B" 
            color="white" 
            _hover={{ bg: '#27272A' }}
            borderRadius="16px"
            fontWeight="600"
            onClick={onUnlock}
          >
            I promise to take a break
          </Button>
        </Flex>
      </motion.div>
    </motion.div>
  )
}
