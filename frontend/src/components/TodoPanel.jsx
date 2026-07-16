import React from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { CheckListIcon, Delete02Icon } from 'hugeicons-react'

export default function TodoPanel({ todos }) {
  const { todos: items, toggleTodo, removeTodo, clearCompleted, clearAll } = todos
  const completedCount = items.filter((t) => t.done).length

  if (items.length === 0) {
    return (
      <Flex direction="column" align="center" justify="center" minH="240px" textAlign="center">
        <Box mb="16px">
          <Box as="img" src="/studybook.png" alt="No active todos" w="80px" mx="auto" />
        </Box>
        <Text fontSize="12px" fontWeight="600" color="#71717A" maxW="200px" lineHeight="1.5">
          No active todos. Ask Heccker to assign tasks or track checklist items.
        </Text>
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap="14px">
      <Flex align="center" justify="space-between">
        <Text fontSize="12px" fontWeight="700" color="#18181B">
          Active Tasks
        </Text>
        <Flex align="center" gap="12px">
          <Text fontSize="11px" fontWeight="700" color="#71717A">
            {completedCount} of {items.length} done
          </Text>
          {completedCount > 0 && (
            <Text 
              fontSize="11px" 
              fontWeight="600" 
              color="#3B82F6" 
              cursor="pointer" 
              _hover={{ textDecoration: 'underline' }}
              onClick={clearCompleted}
            >
              Clear Done
            </Text>
          )}
          {items.length > 0 && (
            <Text 
              fontSize="11px" 
              fontWeight="600" 
              color="#C70039" 
              cursor="pointer" 
              _hover={{ textDecoration: 'underline' }}
              onClick={clearAll}
            >
              Clear All
            </Text>
          )}
        </Flex>
      </Flex>

      {/* Todo List */}
      <Flex direction="column" gap="8px">
        {items.map((todo) => (
          <Flex
            key={todo.id}
            bg="#FFFFFF"
            border="1px solid #E4E4E7"
            borderRadius="sm"
            p="12px"
            align="center"
            justify="space-between"
            gap="10px"
          >
            <Flex align="center" gap="10px" flex="1" cursor="pointer" onClick={() => toggleTodo(todo.id)}>
              <Box
                w="16px"
                h="16px"
                borderRadius="xs"
                border="2px solid"
                borderColor={todo.done ? '#71717A' : '#DEE2E6'}
                bg={todo.done ? '#F4F4F5' : 'transparent'}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {todo.done && <Box w="6px" h="6px" bg="#18181B" borderRadius="xs" />}
              </Box>

              <Text
                fontSize="12px"
                fontWeight="500"
                color={todo.done ? '#9095A0' : '#18181B'}
                textDecoration={todo.done ? 'line-through' : 'none'}
              >
                {todo.task}
              </Text>
            </Flex>

            <Box
              cursor="pointer"
              color="#DEE2E6"
              _hover={{ color: '#18181B' }}
              onClick={() => removeTodo(todo.id)}
            >
              <Delete02Icon size={12} />
            </Box>
          </Flex>
        ))}
      </Flex>
    </Flex>
  )
}
