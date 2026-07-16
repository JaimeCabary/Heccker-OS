import React from 'react'
import { Box } from '@chakra-ui/react'
import { ArrowLeft02Icon } from 'hugeicons-react'
import { keyframes } from '@emotion/react'

const nudge = keyframes`
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-4px); }
`

export default function BackButton({ onClick, mb = "32px" }) {
  return (
    <Box
      cursor="pointer"
      onClick={onClick}
      p="8px"
      borderRadius="full"
      _hover={{ bg: '#E4E4E7' }}
      transition="all 0.2s"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      mb={mb}
      title="Go Back"
      alignSelf="flex-start"
    >
      <Box animation={`${nudge} 2s ease-in-out infinite`}>
        <ArrowLeft02Icon size={24} color="#71717A" strokeWidth={2.5} />
      </Box>
    </Box>
  )
}
