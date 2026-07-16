import React from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { ShoppingBag01Icon, Delete02Icon, Link02Icon, AlertSquareIcon } from 'hugeicons-react'

export default function CartPanel({ cart }) {
  const { cart: items, removeItem, clearCart } = cart

  if (items.length === 0) {
    return (
      <Flex direction="column" align="center" justify="center" minH="240px" textAlign="center">
        <Box mb="16px">
          <Box as="img" src="/shopping.png" alt="No staged purchases" w="80px" mx="auto" />
        </Box>
        <Text fontSize="12px" fontWeight="600" color="#71717A" maxW="200px" lineHeight="1.5">
          No staged purchases. Ask Heccker to find products and stage them.
        </Text>
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap="14px">
      <Flex align="center" justify="space-between">
        <Text fontSize="12px" fontWeight="700" color="#18181B">
          Staged Purchases
        </Text>
        <Text
          fontSize="11px"
          fontWeight="700"
          color="#71717A"
          cursor="pointer"
          onClick={clearCart}
          _hover={{ color: '#18181B' }}
        >
          Clear all
        </Text>
      </Flex>

      {/* Warning banner */}
      <Flex
        align="center"
        gap="8px"
        bg="#FAFAFA"
        border="1px solid #E4E4E7"
        p="10px"
        borderRadius="sm"
      >
        <AlertSquareIcon size={14} color="#71717A" strokeWidth={1.5} />
        <Text fontSize="10px" fontWeight="600" color="#71717A" lineHeight="1.4">
          Staged links below. No payment processed until you visit.
        </Text>
      </Flex>

      {/* Cart List */}
      <Flex direction="column" gap="8px">
        {items.map((item) => (
          <Box
            key={item.id}
            bg="#FFFFFF"
            border="1px solid #E4E4E7"
            borderRadius="sm"
            p="12px"
            position="relative"
          >
            <Flex gap="12px" pr="20px" align="center">
              {item.image_url && (
                <Box
                  as="img"
                  src={item.image_url}
                  alt={item.item_name}
                  boxSize="40px"
                  objectFit="cover"
                  borderRadius="md"
                  border="1px solid #E4E4E7"
                />
              )}
              <Flex direction="column" gap="3px">
                <Text fontSize="12px" fontWeight="700" color="#18181B" noOfLines={2}>
                  {item.item_name}
                </Text>
                <Text fontSize="11px" fontWeight="800" color="#71717A">
                  {item.price}
                </Text>
                
                {item.source_url && (
                  <Flex
                    as="a"
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    align="center"
                    gap="4px"
                    color="#2471A3"
                    fontSize="10px"
                    fontWeight="700"
                    mt="2px"
                    _hover={{ textDecoration: 'underline' }}
                  >
                    <Link02Icon size={11} strokeWidth={2} />
                    Checkout Link
                  </Flex>
                )}
              </Flex>
            </Flex>

            <Box
              position="absolute"
              top="12px"
              right="12px"
              cursor="pointer"
              color="#DEE2E6"
              _hover={{ color: '#18181B' }}
              onClick={() => removeItem(item.id)}
            >
              <Delete02Icon size={12} />
            </Box>
          </Box>
        ))}
      </Flex>
    </Flex>
  )
}
